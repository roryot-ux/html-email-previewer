/**
 * Template fields in the Document Builder preview.
 *
 * Fields are plain `{{FieldName}}` text in the generated HTML — nothing about
 * them is tied to any particular downstream system. In the live preview each
 * one is wrapped in a highlight <span>, and a caret marker shows where the next
 * field will go; serializeDocument() strips all of that back out, so the HTML
 * that is copied or downloaded contains only the `{{FieldName}}` text.
 *
 * The preview document lives in an iframe, i.e. a different JavaScript realm,
 * so node checks use `nodeType` rather than `instanceof`.
 */

export interface FieldInfo {
  name: string
  count: number
}

const FIELD_PATTERN = /\{\{([A-Za-z_][A-Za-z0-9_.-]*)\}\}/g
const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/

const FIELD_ATTR = 'data-builder-field'
const ACTIVE_ATTR = 'data-builder-active'
const TARGET_ATTR = 'data-builder-target'
const CARET_ATTR = 'data-builder-caret'
const STYLE_ATTR = 'data-builder-style'

const EMPTY_BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6'

// Preview-only styling; removed again by serializeDocument().
const BUILDER_CSS = `
[${FIELD_ATTR}] { background:#fff4c2; outline:1px solid #e0b000; border-radius:2px; cursor:pointer; }
[${FIELD_ATTR}][${ACTIVE_ATTR}] { background:#ffd84d; outline:2px solid #c27c00; }
[${TARGET_ATTR}] { outline:2px dashed #0f6cbd; outline-offset:1px; }
[${CARET_ATTR}] { display:inline-block; width:2px; height:1.1em; margin:0 1px; vertical-align:text-bottom; background:#0f6cbd; }
${EMPTY_BLOCKS.split(', ').map((tag) => `${tag}:empty`).join(', ')} { min-height:1.5em; }
td:empty, th:empty { height:1.5em; }
p:empty:hover, li:empty:hover, td:empty:hover, th:empty:hover { background:#eef5fc; }
`

/** Accepts `Name` or `{{Name}}`; returns the bare name, or null if invalid. */
export function normaliseFieldName(input: string): string | null {
  const name = input.trim().replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '')
  return NAME_PATTERN.test(name) ? name : null
}

function createFieldSpan(doc: Document, name: string) {
  const span = doc.createElement('span')
  span.setAttribute(FIELD_ATTR, name)
  span.textContent = `{{${name}}}`
  return span
}

function fieldSpans(doc: Document, name?: string) {
  const selector = name ? `[${FIELD_ATTR}="${CSS.escape(name)}"]` : `[${FIELD_ATTR}]`
  return Array.from(doc.body.querySelectorAll<HTMLElement>(selector))
}

/** Injects the preview styles and wraps existing `{{Name}}` text in highlights. */
export function decorateDocument(doc: Document) {
  if (!doc.head.querySelector(`[${STYLE_ATTR}]`)) {
    const style = doc.createElement('style')
    style.setAttribute(STYLE_ATTR, '')
    style.textContent = BUILDER_CSS
    doc.head.appendChild(style)
  }

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

  for (const textNode of textNodes) {
    const text = textNode.data
    if (!text.includes('{{') || textNode.parentElement?.closest(`[${FIELD_ATTR}]`)) {
      continue
    }
    const fragment = doc.createDocumentFragment()
    let last = 0
    for (const match of text.matchAll(FIELD_PATTERN)) {
      const start = match.index ?? 0
      fragment.append(text.slice(last, start), createFieldSpan(doc, match[1]))
      last = start + match[0].length
    }
    if (last === 0) continue
    fragment.append(text.slice(last))
    textNode.replaceWith(fragment)
  }
}

/** Unique fields in document order, with how often each occurs. */
export function listFields(doc: Document): FieldInfo[] {
  const counts = new Map<string, number>()
  for (const span of fieldSpans(doc)) {
    const name = span.getAttribute(FIELD_ATTR) ?? ''
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return Array.from(counts, ([name, count]) => ({ name, count }))
}

/** The field name under a clicked element, if any. */
export function fieldAt(element: Element): string | null {
  return element.closest(`[${FIELD_ATTR}]`)?.getAttribute(FIELD_ATTR) ?? null
}

export function clearTarget(doc: Document) {
  doc.querySelectorAll(`[${CARET_ATTR}]`).forEach((node) => node.remove())
  doc
    .querySelectorAll(`[${TARGET_ATTR}]`)
    .forEach((node) => node.removeAttribute(TARGET_ATTR))
}

function isEmpty(element: Element) {
  const text = (element.textContent ?? '').replace(/ /g, '').trim()
  return !text && !element.querySelector('img, table')
}

function describe(element: Element) {
  const tag = element.tagName.toLowerCase()
  if (tag === 'td' || tag === 'th') return 'table cell'
  if (tag === 'p') return 'paragraph'
  if (tag === 'li') return 'list item'
  if (/^h[1-6]$/.test(tag)) return 'heading'
  return 'content area'
}

type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  caretRangeFromPoint?: (x: number, y: number) => Range | null
}

function caretFromPoint(doc: Document, x: number, y: number) {
  const caretDoc = doc as CaretDocument
  if (caretDoc.caretPositionFromPoint) {
    const position = caretDoc.caretPositionFromPoint(x, y)
    return position ? { node: position.offsetNode, offset: position.offset } : null
  }
  const range = caretDoc.caretRangeFromPoint?.(x, y)
  return range ? { node: range.startContainer, offset: range.startOffset } : null
}

function createCaret(doc: Document) {
  const caret = doc.createElement('span')
  caret.setAttribute(CARET_ATTR, '')
  return caret
}

/**
 * Chooses where the next field goes, from a click in the preview. Empty
 * paragraphs, list items, headings, table cells and content areas are filled;
 * inside existing text the field goes at the clicked character position.
 * Returns a short description of the location, or null if the click was not
 * somewhere a field can go.
 */
export function selectTarget(
  doc: Document,
  clicked: Element,
  x: number,
  y: number,
): string | null {
  clearTarget(doc)

  const container = clicked.closest(`${EMPTY_BLOCKS}, td, th, div, body`)
  if (container && isEmpty(container)) {
    // A cell holding an empty paragraph gets the field inside that paragraph.
    const host = container.querySelector(EMPTY_BLOCKS) ?? container
    host.appendChild(createCaret(doc))
    container.setAttribute(TARGET_ATTR, '')
    return `empty ${describe(container)}`
  }

  const caret = caretFromPoint(doc, x, y)
  // Whitespace-only text is the formatting between block elements; a field
  // dropped there would float outside any paragraph.
  if (
    !caret ||
    caret.node.nodeType !== Node.TEXT_NODE ||
    !(caret.node as Text).data.trim() ||
    caret.node.parentElement?.closest(`[${FIELD_ATTR}]`)
  ) {
    return null
  }

  const range = doc.createRange()
  range.setStart(caret.node, caret.offset)
  range.insertNode(createCaret(doc))
  const block = caret.node.parentElement?.closest(`${EMPTY_BLOCKS}, td, th`)
  return `cursor position in ${block ? describe(block) : 'text'}`
}

/** Puts a field at the selected target. Returns false if nothing was selected. */
export function insertField(doc: Document, name: string): boolean {
  const caret = doc.querySelector(`[${CARET_ATTR}]`)
  if (!caret) return false
  caret.replaceWith(createFieldSpan(doc, name))
  clearTarget(doc)
  return true
}

export function renameField(doc: Document, from: string, to: string) {
  for (const span of fieldSpans(doc, from)) {
    span.setAttribute(FIELD_ATTR, to)
    span.textContent = `{{${to}}}`
  }
}

/** Removes every occurrence, leaving the place it was inserted empty. */
export function removeField(doc: Document, name: string) {
  for (const span of fieldSpans(doc, name)) span.remove()
}

/** Highlights every occurrence of one field (or none) and returns them. */
export function highlightField(doc: Document, name: string | null) {
  doc
    .querySelectorAll(`[${ACTIVE_ATTR}]`)
    .forEach((node) => node.removeAttribute(ACTIVE_ATTR))
  if (!name) return []
  const spans = fieldSpans(doc, name)
  spans.forEach((span) => span.setAttribute(ACTIVE_ATTR, ''))
  return spans
}

/** The document as clean HTML: fields as `{{Name}}` text, preview aids removed. */
export function serializeDocument(doc: Document): string {
  const root = doc.documentElement.cloneNode(true) as Element
  root
    .querySelectorAll(`[${STYLE_ATTR}], [${CARET_ATTR}]`)
    .forEach((node) => node.remove())
  root
    .querySelectorAll(`[${FIELD_ATTR}]`)
    .forEach((span) => span.replaceWith(span.textContent ?? ''))
  root.querySelectorAll(`[${TARGET_ATTR}], [${ACTIVE_ATTR}]`).forEach((node) => {
    node.removeAttribute(TARGET_ATTR)
    node.removeAttribute(ACTIVE_ATTR)
  })
  root.normalize()
  return `<!DOCTYPE html>\n${root.outerHTML}\n`
}
