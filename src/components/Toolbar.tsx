import type { ThemeName } from '../types'

interface ToolbarProps {
  autoRun: boolean
  theme: ThemeName
  isDirty: boolean
  status: string
  onRun: () => void
  onAutoRunToggle: () => void
  onThemeToggle: () => void
  onLoad: () => void
  onSave: () => void
  onCopy: () => void
  onClear: () => void
  onLoadSample: () => void
}

export function Toolbar({
  autoRun,
  theme,
  isDirty,
  status,
  onRun,
  onAutoRunToggle,
  onThemeToggle,
  onLoad,
  onSave,
  onCopy,
  onClear,
  onLoadSample,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <span className="toolbar-title">HTML Email Previewer</span>
        <span className="toolbar-subtitle">Power Automate templates, offline</span>
      </div>

      <div className="toolbar-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onRun}
          title="Render the editor contents (Ctrl+Enter)"
        >
          {isDirty ? '▶ Run •' : '▶ Run'}
        </button>

        <label className="toggle" title="Re-render automatically as you type">
          <input type="checkbox" checked={autoRun} onChange={onAutoRunToggle} />
          <span>Auto-run</span>
        </label>

        <span className="toolbar-separator" aria-hidden="true" />

        <button type="button" className="btn" onClick={onLoad}>
          Load
        </button>
        <button type="button" className="btn" onClick={onSave}>
          Save
        </button>
        <button type="button" className="btn" onClick={onCopy}>
          Copy
        </button>
        <button type="button" className="btn" onClick={onClear}>
          Clear
        </button>
        <button
          type="button"
          className="btn"
          onClick={onLoadSample}
          title="Replace the editor contents with the bundled sample template"
        >
          Sample
        </button>

        <span className="toolbar-separator" aria-hidden="true" />

        <button
          type="button"
          className="btn btn-icon"
          onClick={onThemeToggle}
          aria-pressed={theme === 'dark'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀ Light' : '☽ Dark'}
        </button>
      </div>

      <div className="toolbar-status" role="status" aria-live="polite">
        {status}
      </div>
    </header>
  )
}
