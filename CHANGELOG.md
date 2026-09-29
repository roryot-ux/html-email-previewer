# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.2.0 - 2026-09-29

### Added

- **Template fields in Document Builder.** The document preview is now
  interactive, so converted documents can be turned into reusable templates.
  - Click an empty table cell, empty paragraph, empty list item or heading, or
    a position inside existing text, then **Insert Field** and enter a name.
    `ApplicantName` becomes `{{ApplicantName}}`.
  - Fields are highlighted in the preview. The selected insertion point shows
    as a dashed outline and a caret.
  - **Fields panel** listing every field in document order, with an occurrence
    count. Clicking a name highlights it and scrolls the preview to it; clicking
    again moves to the next occurrence. Clicking a field in the preview selects
    it in the panel.
  - **Rename** updates every occurrence; renaming to an existing name merges
    the two. **Remove** deletes every occurrence and leaves those places empty.
  - `{{FieldName}}` text already in the Word document is detected as a field.
  - The generated HTML, **Copy HTML** and **Download HTML** update immediately.
    Fields are stored as plain `{{FieldName}}` text; the preview highlights are
    stripped from the output.

### Changed

- Empty Word paragraphs are now kept (as empty `<p>` elements) instead of
  dropped, so they can receive fields. They render with no height, so the
  output looks the same.
- The Document Builder preview iframe is sandboxed with `allow-same-origin`
  (still without `allow-scripts`) so the app can edit the live preview. Clicks
  on links in it are no longer followed. See [SECURITY.md](SECURITY.md).

## 1.1.0 - 2026-09-29

### Added

- **Document Builder** tab: upload a Word `.docx` file and convert it to clean,
  conservative HTML as a starting point for Power Automate emails and
  HTML-to-PDF document generation.
  - Converted in the browser with [Mammoth](https://github.com/mwilliamson/mammoth.js);
    the document is never uploaded anywhere.
  - Keeps headings, paragraphs, bold, italic, lists, tables, links and images.
    Word's *Title* and *Subtitle* styles map to `h1` / `h2`.
  - Output is a full HTML document: one centred 680 px table wrapper, plain
    block elements and inline `style` attributes — no `<style>` blocks, CSS Grid
    or Flexbox.
  - Rendered preview (same sandboxed iframe as the editor) beside the generated
    HTML, with **Copy HTML** and **Download HTML** buttons.
  - Conversion warnings panel listing Mammoth's messages (for example
    unrecognised Word styles) and embedded base64 images.
- Tab switcher in the toolbar (**Email Editor** / **Document Builder**). Both
  tabs stay mounted, so switching keeps the editor's undo history and the last
  converted document. The active tab is remembered in `localStorage`.

### Changed

- The editor's toolbar buttons and the `Ctrl+S` shortcut apply only while the
  Email Editor tab is active.
- New runtime dependency: `mammoth`.

## 1.0.0 - 2026-09-17

First working version.

### Added

- Split-screen layout in the style of the W3Schools try-it editor: Monaco
  editor on the left, rendered preview on the right.
- Resizable divider between the panels — pointer drag, double-click to reset to
  50/50, and keyboard resizing (`←` / `→` / `Home` / `End`) for the focused
  divider.
- **Run** button with a `Ctrl+Enter` shortcut, and a dot on the button while the
  editor holds unrendered changes.
- **Auto-run** toggle, debounced at 400 ms after the last keystroke.
- Dark and light themes covering both the app chrome and the editor.
- Load an `.html` / `.htm` file from disk into the editor.
- Save the editor contents to disk, via the File System Access API where the
  browser offers it and a download elsewhere. Also bound to `Ctrl+S`.
- Copy the raw HTML to the clipboard, with a fallback for non-secure contexts.
- Clear the editor, undoable with `Ctrl+Z` because external updates go through
  Monaco's edit operations rather than `setValue`.
- Bundled sample Power Automate approval-email template, loadable at any time
  from the **Sample** button.
- Editor contents, auto-run state, theme and split position persisted in
  `localStorage`.
- Preview renders in an `<iframe>` whose `srcDoc` is the editor text verbatim,
  so Power Automate expressions such as `@{outputs('Get_item')?['body/Title']}`
  stay visible as text while the surrounding HTML renders normally.
- Status line reporting the outcome of load, save, copy and clear.

### Security

- The preview iframe is sandboxed without `allow-scripts` and without
  `allow-same-origin`, so a pasted template can neither execute script nor
  reach into the app. See [SECURITY.md](SECURITY.md).

### Notes

- Monaco and its web workers are bundled from `node_modules`; there are no CDN
  requests, no backend and no external APIs.
- Monaco's JSON and TypeScript language services are intentionally not
  imported, which keeps roughly 6.5 MB of unused worker output out of the
  build.
