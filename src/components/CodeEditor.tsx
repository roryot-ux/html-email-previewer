import { useEffect, useRef } from 'react'
import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api'
import { monaco, MONACO_THEMES } from '../monaco/setup'
import type { ThemeName } from '../types'

interface CodeEditorProps {
  value: string
  theme: ThemeName
  onChange: (value: string) => void
  /** Invoked on Ctrl+Enter / Cmd+Enter so Run has a keyboard shortcut. */
  onRun: () => void
}

export function CodeEditor({ value, theme, onChange, onRun }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)

  // Keep the latest callbacks in refs so the editor is created exactly once.
  const onChangeRef = useRef(onChange)
  const onRunRef = useRef(onRun)
  onChangeRef.current = onChange
  onRunRef.current = onRun

  // Mount value is read through a ref for the same reason.
  const initialValueRef = useRef(value)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const editor = monaco.editor.create(host, {
      value: initialValueRef.current,
      language: 'html',
      theme: MONACO_THEMES.dark,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: 'on',
      tabSize: 2,
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      fixedOverflowWidgets: true,
    })
    editorRef.current = editor

    const changeSub = editor.onDidChangeModelContent(() => {
      onChangeRef.current(editor.getValue())
    })

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunRef.current()
    })

    return () => {
      changeSub.dispose()
      editor.getModel()?.dispose()
      editor.dispose()
      editorRef.current = null
    }
  }, [])

  // External value changes (load file, clear, load sample) are pushed into the
  // model. The guard stops it from clobbering the cursor while typing, and the
  // edit goes through pushEditOperations rather than setValue so the previous
  // contents stay on the undo stack — Ctrl+Z recovers a Clear.
  useEffect(() => {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model || model.getValue() === value) return

    editor.pushUndoStop()
    model.pushEditOperations(
      [],
      [{ range: model.getFullModelRange(), text: value }],
      () => null,
    )
    editor.pushUndoStop()
  }, [value])

  useEffect(() => {
    monaco.editor.setTheme(MONACO_THEMES[theme])
  }, [theme])

  return <div className="editor-host" ref={hostRef} />
}
