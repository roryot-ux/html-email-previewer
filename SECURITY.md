# Security

## Scope

HTML Email Previewer is a local developer tool. It has no backend, makes no
network requests of its own, calls no external APIs, loads nothing from a CDN,
and collects no telemetry. Everything happens in the browser tab that the Vite
dev server (or the built `dist/` bundle) is serving.

## Threat model

The interesting input is the HTML template itself, which is usually pasted in
from somewhere else. The app therefore treats editor content as untrusted and
renders it under these constraints:

- **The preview runs in a sandboxed `<iframe>`.** The sandbox grants only
  `allow-popups` and `allow-popups-to-escape-sandbox`, so links remain clickable.
  It deliberately withholds:
  - `allow-scripts` — script in a template cannot execute. This also matches
    how email clients behave, so the preview is the more faithful one for the
    task.
  - `allow-same-origin` — the frame gets an opaque origin and cannot read the
    app's DOM, `localStorage`, or anything else same-origin.
- **The template is never evaluated.** It is handed to `srcDoc` as a string.
  There is no `eval`, no `new Function`, no `innerHTML` on the app's own DOM,
  and no templating pass over the content. This is also why Power Automate
  expressions come through untouched.
- **`dangerouslySetInnerHTML` is not used anywhere in the app.**

## What this tool does not protect you from

- **`localStorage` is plain text.** The editor contents are persisted so a
  reload does not lose your work. Anyone with access to your browser profile
  can read them. Do not paste live secrets — bearer tokens, connection strings,
  API keys — into a template you intend to keep. Use the **Clear** button when
  you are done with sensitive content.
- **Templates you save are written verbatim.** Nothing is scrubbed on the way
  out to disk or to the clipboard.
- **The preview is Chromium, not Outlook.** A template that looks correct here
  can still render differently in a real email client. That is a correctness
  matter rather than a security one, but it is worth stating.

## Serving it

`npm run dev` binds to localhost only. Do not add `--host` (or set
`server.host`) on an untrusted network: that exposes the dev server, and Vite's
dev server is not hardened for public exposure. The production bundle in
`dist/` is static and can be served by anything, including opened straight from
the file system, since `base` is relative.

## Dependencies

The runtime dependency surface is intentionally small — React, React DOM and
Monaco Editor, with Vite and TypeScript as build-time tooling. To review it:

```bash
npm audit
npm ls --depth=0
```

`npm install` reported 0 vulnerabilities at the time of the 1.0.0 commit.

## Reporting a problem

This is a private project. Report anything you find directly to the repository
owner, or open an issue if the repository has been published — but describe the
class of issue rather than posting a working exploit.
