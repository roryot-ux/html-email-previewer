import { useCallback, useRef, useState } from 'react'
import { convertDocxToHtml } from '../lib/docxConvert'
import { copyToClipboard, SaveCancelledError, saveHtmlFile } from '../lib/fileIo'
import { Preview } from './Preview'
import { SplitPane } from './SplitPane'

interface DocumentBuilderProps {
  splitPercent: number
  onSplitChange: (percent: number) => void
  /** Reports outcomes on the shared toolbar status line. */
  announce: (message: string) => void
}

/**
 * Converts an uploaded .docx into conservative HTML, entirely in the browser,
 * and shows the generated markup beside a rendered preview.
 */
export function DocumentBuilder({
  splitPercent,
  onSplitChange,
  announce,
}: DocumentBuilderProps) {
  const [html, setHtml] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [docName, setDocName] = useState('')
  const [converting, setConverting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileChosen = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      // Reset so picking the same file twice in a row still fires a change.
      event.target.value = ''
      if (!file) return

      if (!/\.docx$/i.test(file.name)) {
        announce('Please choose a Word .docx file')
        return
      }

      setConverting(true)
      try {
        const result = await convertDocxToHtml(file)
        setHtml(result.html)
        setWarnings(result.warnings)
        setDocName(file.name)
        announce(`Converted ${file.name}`)
      } catch (error) {
        announce(`Could not convert file: ${(error as Error).message}`)
      } finally {
        setConverting(false)
      }
    },
    [announce],
  )

  const handleCopy = useCallback(async () => {
    try {
      await copyToClipboard(html)
      announce('HTML copied to clipboard')
    } catch (error) {
      announce(`Could not copy: ${(error as Error).message}`)
    }
  }, [announce, html])

  const handleDownload = useCallback(async () => {
    try {
      const suggested = docName.replace(/\.docx$/i, '') + '.html'
      const savedAs = await saveHtmlFile(html, suggested)
      announce(`Saved ${savedAs}`)
    } catch (error) {
      if (error instanceof SaveCancelledError) {
        announce('Save cancelled')
        return
      }
      announce(`Could not save file: ${(error as Error).message}`)
    }
  }, [announce, docName, html])

  return (
    <div className="doc-builder">
      <div className="doc-builder-bar">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={converting}
        >
          {converting ? 'Converting…' : 'Upload .docx'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => void handleCopy()}
          disabled={!html}
        >
          Copy HTML
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => void handleDownload()}
          disabled={!html}
        >
          Download HTML
        </button>
        <span className="doc-builder-note">
          Converted locally in your browser — the document is not uploaded anywhere.
        </span>
      </div>

      {docName && (
        <div className="doc-warnings" role="region" aria-label="Conversion warnings">
          <div className="doc-warnings-title">
            {warnings.length === 0
              ? 'No conversion warnings'
              : `Conversion warnings (${warnings.length})`}
          </div>
          {warnings.length > 0 && (
            <ul className="doc-warnings-list">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <SplitPane
        splitPercent={splitPercent}
        onSplitChange={onSplitChange}
        left={
          <section className="pane">
            <div className="pane-header">
              <span>Generated HTML</span>
              <span className="pane-header-meta">{docName || 'no document'}</span>
            </div>
            <div className="pane-body">
              <textarea
                className="doc-html-output"
                value={html}
                readOnly
                spellCheck={false}
                aria-label="Generated HTML"
                placeholder="Upload a .docx file to generate HTML."
              />
            </div>
          </section>
        }
        right={
          <section className="pane">
            <div className="pane-header">
              <span>Document preview</span>
            </div>
            <div className="pane-body pane-body-preview">
              <Preview html={html} emptyHint="Upload a .docx file to see it rendered here." />
            </div>
          </section>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden-file-input"
        onChange={(event) => void handleFileChosen(event)}
      />
    </div>
  )
}
