/**
 * Local Monaco bootstrap.
 *
 * Monaco is imported from node_modules and bundled by Vite, and its web worker
 * comes from Vite's `?worker` import. Nothing is fetched from a CDN at runtime,
 * which is what keeps the app usable fully offline.
 *
 * The imports are deliberately selective rather than `import 'monaco-editor'`:
 * the full entry point drags in the JSON and TypeScript language services and
 * their workers (~6.5 MB of extra output) which an HTML email editor never
 * needs.
 */

// Typed API surface, plus the standalone editor contributions (find, folding,
// suggest, bracket matching, context menu, ...) pulled in for their side
// effects. Together these are `monaco-editor` minus the languages.
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import 'monaco-editor/esm/vs/editor/edcore.main'

// Monarch tokenizers for syntax highlighting. The HTML tokenizer switches into
// the CSS and JavaScript tokenizers for <style> and <script> blocks, so those
// two are registered as well.
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution'
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution'
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'

// Rich HTML language service: tag completion, auto-closing tags, formatting.
import 'monaco-editor/esm/vs/language/html/monaco.contribution'

import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'

window.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    switch (label) {
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker()
      default:
        return new EditorWorker()
    }
  },
}

export const MONACO_THEMES = {
  dark: 'vs-dark',
  light: 'vs',
} as const

export { monaco }
