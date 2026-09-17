// `edcore.main` ships without type declarations (of the ESM entry points, only
// `editor.api.d.ts` and the language/basic-language contributions have them).
// It is imported purely for its side effects — registering the standalone
// editor contributions — while the typed API surface comes from `editor.api`.
declare module 'monaco-editor/esm/vs/editor/edcore.main'
