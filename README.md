# HTML Email Previewer

A local, offline split-screen editor for the HTML email templates used in
Microsoft Power Automate "Send an email (V2)" actions. Type or paste a template
on the left, see it rendered on the right — no online try-it editors, no upload,
no backend.

Power Automate expressions such as `@{outputs('Get_item')?['body/Title']}` stay
visible as literal text while the surrounding HTML renders normally, so you can
check layout without first stripping the placeholders out.

![Editor on the left, rendered email on the right](docs/screenshot.png)

## Requirements

| Tool | Verified with |
| --- | --- |
| Node.js | v24.21.0 |
| npm | 11.19.0 |
| Git | 2.55.0.windows.2 |

Node 20.19+ or 22.12+ is the practical floor, since that is what Vite 7 supports.

## Getting started

```bash
npm install     # one-off; pulls React, Vite and Monaco into node_modules
npm run dev     # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check, then emit a production bundle to dist/
npm run preview    # serve the built bundle locally
npm run typecheck  # types only, no output
```

## Using it

| Control | What it does |
| --- | --- |
| **Run** | Renders the current editor contents. A dot on the button means the editor has unrendered changes. Shortcut: `Ctrl+Enter`. |
| **Auto-run** | Re-renders automatically ~400 ms after you stop typing. |
| **Load** | Opens an `.html` / `.htm` file from disk into the editor. |
| **Save** | Writes the editor contents to disk (a native save dialog where the browser supports the File System Access API, otherwise a download). Shortcut: `Ctrl+S`. |
| **Copy** | Copies the raw HTML to the clipboard, ready to paste into the Power Automate action. |
| **Clear** | Empties the editor. Undoable with `Ctrl+Z` in the editor. |
| **Sample** | Loads the bundled example approval-email template. |
| **Light / Dark** | Switches the app chrome and the editor theme. The preview always renders on the template's own background, as an email client would. |

Drag the divider between the panels to resize them; double-click it to snap back
to 50/50. The divider is also focusable — `←` / `→` nudge it, `Home` / `End`
jump to the extremes.

The editor contents, auto-run state, theme and split position are kept in
`localStorage`, so a reload brings you back where you left off.

## How Power Automate expressions survive

The preview is an `<iframe>` whose `srcDoc` receives the editor text completely
untransformed — no templating engine, no string interpolation, no sanitising
pass. To an HTML parser, `@{outputs('Get_item')?['body/Title']}` is ordinary
character data, so it renders as-is in text nodes and is preserved verbatim in
attribute values. Nothing in the app treats `@{`, `{` or `}` as special.

### Known limitations

- **Expressions inside `<style>` blocks or `style="..."` attributes.** This is a
  CSS parsing matter rather than something the previewer controls: a browser's
  CSS parser cannot make sense of `@{...}` in a declaration, so it discards the
  declaration (or the enclosing rule) as invalid. The expression still shows up
  untouched in the HTML you copy out, and Power Automate will substitute it at
  run time — but the preview will not reflect whatever style it produces. Keep
  expressions out of CSS if you want a faithful preview.
- **No JavaScript in the preview.** The iframe sandbox deliberately omits
  `allow-scripts`, matching email clients, which strip scripts anyway.
- **This is not an email-client compatibility checker.** It shows you what
  Chromium makes of your markup. Outlook's Word-based rendering engine is
  stricter; treat the preview as a layout sanity check, not a guarantee.

## Offline by construction

- No CDN: Monaco is imported from `node_modules`, bundled by Vite, and its web
  workers are produced as local assets. The codicon font is emitted into
  `dist/assets` too.
- No backend and no network calls: loading and saving go through browser file
  APIs, and there is nothing to talk to.
- No telemetry.

Monaco's imports in `src/monaco/setup.ts` are deliberately selective: the JSON
and TypeScript language services that the default `monaco-editor` entry point
pulls in are omitted, which keeps roughly 6.5 MB of unused worker code out of
the build.

## Project layout

```
index.html                 Vite entry document
src/main.tsx               React bootstrap
src/App.tsx                State, keyboard shortcuts, wiring
src/styles.css             Theme variables and layout
src/sampleTemplate.ts      Bundled example template
src/types.ts               Shared types
src/components/
  CodeEditor.tsx           Monaco wrapper (undo-preserving external updates)
  Preview.tsx              Sandboxed iframe preview
  SplitPane.tsx            Draggable / keyboard-resizable divider
  Toolbar.tsx              Buttons and toggles
src/hooks/
  usePersistentState.ts    useState backed by localStorage
src/lib/
  fileIo.ts                Load, save and clipboard helpers
src/monaco/
  setup.ts                 Local Monaco + worker registration
  monaco-esm.d.ts          Declaration for the untyped edcore.main entry
```

## Licence

Private project, no licence granted.
