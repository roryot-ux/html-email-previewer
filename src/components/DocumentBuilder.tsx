import { useCallback, useRef, useState } from 'react'
import { convertDocxToHtml } from '../lib/docxConvert'
import {
  clearTarget,
  decorateDocument,
  fieldAt,
  type FieldInfo,
  highlightField,
  insertField,
  listFields,
  normaliseFieldName,
  removeField,
  renameField,
  selectTarget,
  serializeDocument,
} from '../lib/fieldEditing'
import { copyToClipboard, SaveCancelledError, saveHtmlFile } from '../lib/fileIo'
import { Preview } from './Preview'
import { SplitPane } from './SplitPane'

interface DocumentBuilderProps {
  splitPercent: number
  onSplitChange: (percent: number) => void
  /** Reports outcomes on the shared toolbar status line. */
  announce: (message: string) => void
}

const FIELD_NAME_HINT =
  'Letters, numbers, underscores, dots and hyphens; must not start with a number.'

/**
 * Converts an uploaded .docx into conservative HTML, entirely in the browser,
 * and shows the generated markup beside a rendered preview in which
 * `{{FieldName}}` template fields can be inserted, renamed and removed.
 */
export function DocumentBuilder({
  splitPercent,
  onSplitChange,
  announce,
}: DocumentBuilderProps) {
  // `html` is the output; `loadedHtml` is what the preview iframe was loaded
  // with. Field edits are made to the live preview document and serialized
  // into `html`, so the iframe is not reloaded (and does not lose its scroll
  // position) on every edit.
  const [html, setHtml] = useState('')
  const [loadedHtml, setLoadedHtml] = useState('')
  const [frameKey, setFrameKey] = useState(0)
  const [warnings, setWarnings] = useState<string[]>([])
  const [docName, setDocName] = useState('')
  const [converting, setConverting] = useState(false)
  const [fields, setFields] = useState<FieldInfo[]>([])
  const [targetLabel, setTargetLabel] = useState<string | null>(null)
  const [activeField, setActiveField] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  // Which occurrence to scroll to next when a field is clicked repeatedly.
  const occurrenceRef = useRef(0)

  const getDoc = () => frameRef.current?.contentDocument ?? null

  const sync = useCallback((doc: Document) => {
    setHtml(serializeDocument(doc))
    setFields(listFields(doc))
  }, [])

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
        setLoadedHtml(result.html)
        setFrameKey((key) => key + 1)
        setWarnings(result.warnings)
        setDocName(file.name)
        setFields([])
        setTargetLabel(null)
        setActiveField(null)
        announce(`Converted ${file.name}`)
      } catch (error) {
        announce(`Could not convert file: ${(error as Error).message}`)
      } finally {
        setConverting(false)
      }
    },
    [announce],
  )

  const handlePreviewClick = useCallback((event: MouseEvent) => {
    const doc = getDoc()
    const clicked = event.target as Element | null
    if (!doc || !clicked || clicked.nodeType !== Node.ELEMENT_NODE) return

    // Clicks choose positions; they should not follow links.
    if (clicked.closest('a')) event.preventDefault()

    const field = fieldAt(clicked)
    if (field) {
      clearTarget(doc)
      setTargetLabel(null)
      highlightField(doc, field)
      setActiveField(field)
      occurrenceRef.current = 0
      return
    }

    highlightField(doc, null)
    setActiveField(null)
    setTargetLabel(selectTarget(doc, clicked, event.clientX, event.clientY))
  }, [])

  const handleFrameLoad = useCallback(() => {
    const doc = getDoc()
    if (!doc) return
    decorateDocument(doc)
    setFields(listFields(doc))
    doc.addEventListener('click', handlePreviewClick)
  }, [handlePreviewClick])

  const handleInsert = useCallback(() => {
    const doc = getDoc()
    if (!doc) return
    const input = window.prompt(`Field name\n${FIELD_NAME_HINT}`, '')
    if (input === null) return
    const name = normaliseFieldName(input)
    if (!name) {
      announce(`"${input}" is not a valid field name`)
      return
    }
    if (!insertField(doc, name)) {
      announce('Click a location in the preview first')
      return
    }
    setTargetLabel(null)
    sync(doc)
    announce(`Inserted {{${name}}}`)
  }, [announce, sync])

  const handleRename = useCallback(
    (from: string) => {
      const doc = getDoc()
      if (!doc) return
      const input = window.prompt(`Rename {{${from}}} to\n${FIELD_NAME_HINT}`, from)
      if (input === null) return
      const to = normaliseFieldName(input)
      if (!to) {
        announce(`"${input}" is not a valid field name`)
        return
      }
      if (to === from) return
      const merged = fields.some((field) => field.name === to)
      renameField(doc, from, to)
      if (activeField === from) {
        highlightField(doc, to)
        setActiveField(to)
      }
      sync(doc)
      announce(
        merged
          ? `Renamed {{${from}}} to {{${to}}} (merged with the existing field)`
          : `Renamed {{${from}}} to {{${to}}}`,
      )
    },
    [activeField, announce, fields, sync],
  )

  const handleRemove = useCallback(
    (field: FieldInfo) => {
      const doc = getDoc()
      if (!doc) return
      const where = field.count === 1 ? '' : ` from all ${field.count} places`
      if (!window.confirm(`Remove {{${field.name}}}${where}?`)) return
      removeField(doc, field.name)
      if (activeField === field.name) setActiveField(null)
      sync(doc)
      announce(`Removed {{${field.name}}}`)
    },
    [activeField, announce, sync],
  )

  const handleFieldClick = useCallback(
    (name: string) => {
      const doc = getDoc()
      if (!doc) return
      occurrenceRef.current = activeField === name ? occurrenceRef.current + 1 : 0
      const spans = highlightField(doc, name)
      setActiveField(name)
      spans[occurrenceRef.current % spans.length]?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      })
    },
    [activeField],
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

        <span className="toolbar-separator" aria-hidden="true" />

        <button
          type="button"
          className="btn"
          onClick={handleInsert}
          disabled={!targetLabel}
          title="Insert a {{FieldName}} field at the selected location"
        >
          Insert Field
        </button>
        {loadedHtml && (
          <span className="doc-builder-target">
            {targetLabel
              ? `Insert at: ${targetLabel}`
              : 'Click an empty cell, empty paragraph or a spot in the text to choose where a field goes.'}
          </span>
        )}

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

      <div className="doc-builder-main">
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
                <span className="pane-header-meta">click to place fields</span>
              </div>
              <div className="pane-body pane-body-preview">
                {loadedHtml ? (
                  // Same-origin so the app can place fields in the live
                  // document, but still without allow-scripts: nothing in the
                  // converted document can run.
                  <iframe
                    key={frameKey}
                    ref={frameRef}
                    className="preview-frame"
                    title="Document preview"
                    sandbox="allow-same-origin"
                    srcDoc={loadedHtml}
                    onLoad={handleFrameLoad}
                  />
                ) : (
                  <Preview html="" emptyHint="Upload a .docx file to see it rendered here." />
                )}
              </div>
            </section>
          }
        />

        <aside className="doc-fields" aria-label="Fields">
          <div className="pane-header">
            <span>Fields</span>
            <span className="pane-header-meta">{fields.length}</span>
          </div>
          {fields.length === 0 ? (
            <p className="doc-fields-empty">
              No fields yet. Click a location in the preview, then Insert Field.
            </p>
          ) : (
            <ul className="doc-fields-list">
              {fields.map((field) => (
                <li
                  key={field.name}
                  className={
                    field.name === activeField ? 'doc-field doc-field-active' : 'doc-field'
                  }
                >
                  <button
                    type="button"
                    className="doc-field-name"
                    onClick={() => handleFieldClick(field.name)}
                    title={
                      field.count > 1
                        ? 'Show in preview (click again for the next occurrence)'
                        : 'Show in preview'
                    }
                  >
                    {field.name}
                    {field.count > 1 && (
                      <span className="doc-field-count"> ×{field.count}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => handleRename(field.name)}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => handleRemove(field)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

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
