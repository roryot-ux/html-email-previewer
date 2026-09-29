import { useCallback, useEffect, useRef, useState } from 'react'
import { CodeEditor } from './components/CodeEditor'
import { DocumentBuilder } from './components/DocumentBuilder'
import { Preview } from './components/Preview'
import { SplitPane } from './components/SplitPane'
import { Toolbar } from './components/Toolbar'
import { usePersistentState } from './hooks/usePersistentState'
import {
  copyToClipboard,
  readHtmlFile,
  SaveCancelledError,
  saveHtmlFile,
} from './lib/fileIo'
import { SAMPLE_TEMPLATE } from './sampleTemplate'
import type { TabName, ThemeName } from './types'

const AUTO_RUN_DELAY_MS = 400
const STATUS_TIMEOUT_MS = 4000

export default function App() {
  const [source, setSource] = usePersistentState('hep.source', SAMPLE_TEMPLATE)
  const [autoRun, setAutoRun] = usePersistentState('hep.autoRun', true)
  const [theme, setTheme] = usePersistentState<ThemeName>('hep.theme', 'dark')
  const [splitPercent, setSplitPercent] = usePersistentState('hep.split', 50)
  const [activeTab, setActiveTab] = usePersistentState<TabName>('hep.tab', 'editor')
  const [docSplitPercent, setDocSplitPercent] = usePersistentState('hep.docSplit', 50)

  // What the preview is currently showing. Kept separate from `source` so the
  // Run button and the auto-run toggle have something to gate on.
  const [rendered, setRendered] = useState(source)
  const [status, setStatus] = useState('')
  const [fileName, setFileName] = useState('email-template.html')

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const announce = useCallback((message: string) => setStatus(message), [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Clear the status line a few seconds after the last message.
  useEffect(() => {
    if (!status) return
    const timer = window.setTimeout(() => setStatus(''), STATUS_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [status])

  const run = useCallback(() => {
    setRendered(source)
  }, [source])

  // Auto-run: debounce so the iframe is not reloaded on every keystroke.
  useEffect(() => {
    if (!autoRun || source === rendered) return
    const timer = window.setTimeout(() => setRendered(source), AUTO_RUN_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [autoRun, source, rendered])

  const handleLoadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChosen = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      // Reset so picking the same file twice in a row still fires a change.
      event.target.value = ''
      if (!file) return

      try {
        const text = await readHtmlFile(file)
        setSource(text)
        setRendered(text)
        setFileName(file.name)
        announce(`Loaded ${file.name}`)
      } catch (error) {
        announce(`Could not read file: ${(error as Error).message}`)
      }
    },
    [announce, setSource],
  )

  const handleSave = useCallback(async () => {
    try {
      const savedAs = await saveHtmlFile(source, fileName)
      setFileName(savedAs)
      announce(`Saved ${savedAs}`)
    } catch (error) {
      if (error instanceof SaveCancelledError) {
        announce('Save cancelled')
        return
      }
      announce(`Could not save file: ${(error as Error).message}`)
    }
  }, [announce, fileName, source])

  const handleCopy = useCallback(async () => {
    try {
      await copyToClipboard(source)
      announce('HTML copied to clipboard')
    } catch (error) {
      announce(`Could not copy: ${(error as Error).message}`)
    }
  }, [announce, source])

  const handleClear = useCallback(() => {
    setSource('')
    setRendered('')
    announce('Editor cleared — press Ctrl+Z in the editor to undo')
  }, [announce, setSource])

  const handleLoadSample = useCallback(() => {
    setSource(SAMPLE_TEMPLATE)
    setRendered(SAMPLE_TEMPLATE)
    announce('Sample template loaded')
  }, [announce, setSource])

  // Ctrl+S saves instead of letting the browser save the app page itself.
  // Only on the editor tab, where there is editor content to save.
  useEffect(() => {
    if (activeTab !== 'editor') return
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTab, handleSave])

  return (
    <div className="app">
      <Toolbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        autoRun={autoRun}
        theme={theme}
        isDirty={source !== rendered}
        status={status}
        onRun={run}
        onAutoRunToggle={() => setAutoRun((value) => !value)}
        onThemeToggle={() =>
          setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
        }
        onLoad={handleLoadClick}
        onSave={() => void handleSave()}
        onCopy={() => void handleCopy()}
        onClear={handleClear}
        onLoadSample={handleLoadSample}
      />

      {/* Both tabs stay mounted so switching keeps the Monaco undo history
          and the last converted document. */}
      <div className="tab-panel" hidden={activeTab !== 'editor'}>
        <SplitPane
          splitPercent={splitPercent}
          onSplitChange={setSplitPercent}
          left={
            <section className="pane">
              <div className="pane-header">
                <span>HTML</span>
                <span className="pane-header-meta">{fileName}</span>
              </div>
              <div className="pane-body">
                <CodeEditor
                  value={source}
                  theme={theme}
                  onChange={setSource}
                  onRun={run}
                />
              </div>
            </section>
          }
          right={
            <section className="pane">
              <div className="pane-header">
                <span>Preview</span>
                <span className="pane-header-meta">
                  {autoRun ? 'auto-run on' : 'auto-run off'}
                </span>
              </div>
              <div className="pane-body pane-body-preview">
                <Preview html={rendered} />
              </div>
            </section>
          }
        />
      </div>

      <div className="tab-panel" hidden={activeTab !== 'documentBuilder'}>
        <DocumentBuilder
          splitPercent={docSplitPercent}
          onSplitChange={setDocSplitPercent}
          announce={announce}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm,text/html"
        className="hidden-file-input"
        onChange={(event) => void handleFileChosen(event)}
      />
    </div>
  )
}
