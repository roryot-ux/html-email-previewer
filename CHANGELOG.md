# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
