import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react'
import { convertDocxToHtml } from '../lib/docxConvert'
import {
  clearTarget,
  currentOccurrence,
  decorateDocument,
  fieldAt,
  type FieldInfo,
  type FieldOccurrence,
  findHtmlFields,
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
  // The selected field occurrence, shared by the Fields panel, preview and HTML.
  const [selection, setSelection] = useState<FieldOccurrence | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const htmlRef = useRef<HTMLPreElement | null>(null)

  const getDoc = () => frameRef.current?.contentDocument ?? null

  const sync = useCallback((doc: Document) => {
    // Edits can shift or remove the selected occurrence; the preview's marker
    // on it is the source of truth for where it is now.
    const current = currentOccurrence(doc)
    highlightField(doc, current)
    setSelection(current)
    setHtml(serializeDocument(doc))
    setFields(listFields(doc))
  }, [])

  /** Selects one occurrence everywhere and scrolls the chosen panes to it. */
  const select = useCallback(
    (next: FieldOccurrence, scroll: { preview: boolean; html: boolean }) => {
      const doc = getDoc()
      if (!doc) return
      const span = highlightField(doc, next)
      setSelection(next)
      if (scroll.preview) span?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      if (scroll.html) {
        htmlRef.current
          ?.querySelector(
            `[data-field="${CSS.escape(next.name)}"][data-occurrence="${next.index}"]`,
          )
          ?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
      }
    },
    [],
  )

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
        setSelection(null)
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

    const field = fieldAt(doc, clicked)
    if (field) {
      clearTarget(doc)
      setTargetLabel(null)
      select(field, { preview: false, html: true })
      return
    }

    highlightField(doc, null)
    setSelection(null)
    setTargetLabel(selectTarget(doc, clicked, event.clientX, event.clientY))
  }, [select])

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
      sync(doc)
      announce(
        merged
          ? `Renamed {{${from}}} to {{${to}}} (merged with the existing field)`
          : `Renamed {{${from}}} to {{${to}}}`,
      )
    },
    [announce, fields, sync],
  )

  const handleRemove = useCallback(
    (field: FieldInfo) => {
      const doc = getDoc()
      if (!doc) return
      const where = field.count === 1 ? '' : ` from all ${field.count} places`
      if (!window.confirm(`Remove {{${field.name}}}${where}?`)) return
      removeField(doc, field.name)
      sync(doc)
      announce(`Removed {{${field.name}}}`)
    },
    [announce, sync],
  )

  // Repeated clicks on the same name cycle through its occurrences.
  const handleFieldClick = useCallback(
    (field: FieldInfo) => {
      const index =
        selection?.name === field.name ? (selection.index + 1) % field.count : 0
      select({ name: field.name, index }, { preview: true, html: true })
    },
    [select, selection],
  )

  const handleHtmlClick = useCallback(
    (event: React.MouseEvent<HTMLPreElement>) => {
      const mark = (event.target as HTMLElement).closest<HTMLElement>('mark[data-field]')
      if (!mark?.dataset.field) return
      select(
        { name: mark.dataset.field, index: Number(mark.dataset.occurrence) },
        { preview: true, html: false },
      )
    },
    [select],
  )

  // The generated HTML as text, with each {{Field}} wrapped in a clickable mark.
  const htmlContent = useMemo(() => {
    const nodes: ReactNode[] = []
    let last = 0
    for (const field of findHtmlFields(html)) {
      const isActive = selection?.name === field.name
      const isCurrent = isActive && selection?.index === field.index
      nodes.push(
        html.slice(last, field.start),
        <mark
          key={field.start}
          className={
            'doc-html-field' +
            (isActive ? ' doc-html-field-active' : '') +
            (isCurrent ? ' doc-html-field-current' : '')
          }
          data-field={field.name}
          data-occurrence={field.index}
        >
          {html.slice(field.start, field.end)}
        </mark>,
      )
      last = field.end
    }
    nodes.push(html.slice(last))
    return nodes
  }, [html, selection])

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
                <pre
                  ref={htmlRef}
                  className="doc-html-output"
                  tabIndex={0}
                  aria-label="Generated HTML"
                  onClick={handleHtmlClick}
                >
                  {html ? (
                    htmlContent
                  ) : (
                    <span className="doc-html-placeholder">
                      Upload a .docx file to generate HTML.
                    </span>
                  )}
                </pre>
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
                    field.name === selection?.name
                      ? 'doc-field doc-field-active'
                      : 'doc-field'
                  }
                >
                  <button
                    type="button"
                    className="doc-field-name"
                    onClick={() => handleFieldClick(field)}
                    title={
                      field.count > 1
                        ? 'Show in preview and HTML (click again for the next occurrence)'
                        : 'Show in preview and HTML'
                    }
                  >
                    {field.name}
                    {field.count > 1 && (
                      <span className="doc-field-count">
                        {field.name === selection?.name
                          ? ` ${selection.index + 1} of ${field.count}`
                          : ` ×${field.count}`}
                      </span>
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
