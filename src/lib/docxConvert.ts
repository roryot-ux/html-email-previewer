/**
 * Word (.docx) to conservative HTML conversion.
 *
 * Mammoth does the heavy lifting and runs entirely in the browser — the file is
 * read into an ArrayBuffer and never leaves the machine. Its output is a bare
 * semantic fragment, so this module then adds the inline styles and table
 * attributes that email clients (Outlook in particular) and Power Automate's
 * HTML-to-PDF conversion honour, and wraps the result in a minimal document.
 *
 * Deliberately no CSS Grid, Flexbox or <style> blocks: layout is one centred
 * table, everything else is plain block elements with inline `style` attributes.
 */
import mammoth from 'mammoth/mammoth.browser'

export interface DocxConversion {
  html: string
  warnings: string[]
}

// Map a few common Word styles that Mammoth's default style map leaves out.
const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
]

const FONT_STACK = 'Arial, Helvetica, sans-serif'
const TEXT_COLOR = '#1f2328'
const CONTENT_WIDTH = 680

const INLINE_STYLES: Record<string, string> = {
  h1: 'margin:0 0 12px 0; font-size:24px; line-height:1.3; font-weight:bold;',
  h2: 'margin:0 0 10px 0; font-size:20px; line-height:1.3; font-weight:bold;',
  h3: 'margin:0 0 8px 0; font-size:17px; line-height:1.3; font-weight:bold;',
  h4: 'margin:0 0 8px 0; font-size:15px; line-height:1.3; font-weight:bold;',
  h5: 'margin:0 0 8px 0; font-size:14px; line-height:1.3; font-weight:bold;',
  h6: 'margin:0 0 8px 0; font-size:13px; line-height:1.3; font-weight:bold;',
  p: 'margin:0 0 12px 0; line-height:1.5;',
  ul: 'margin:0 0 12px 0; padding-left:24px;',
  ol: 'margin:0 0 12px 0; padding-left:24px;',
  li: 'margin:0 0 4px 0; line-height:1.5;',
  table: 'border-collapse:collapse; width:100%; margin:0 0 12px 0;',
  th: 'border:1px solid #c8ccd1; padding:6px 8px; text-align:left; vertical-align:top; font-weight:bold; background-color:#f3f4f6;',
  td: 'border:1px solid #c8ccd1; padding:6px 8px; text-align:left; vertical-align:top;',
  a: 'color:#0f6cbd; text-decoration:underline;',
  img: 'max-width:100%; height:auto; border:0;',
}

// Elements printed on their own lines in the generated HTML.
const BLOCK_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
])

function escapeText(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(value: string) {
  return escapeText(value).replace(/"/g, '&quot;')
}

function applyInlineStyles(root: HTMLElement) {
  for (const element of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    const tag = element.tagName.toLowerCase()
    let style = INLINE_STYLES[tag]
    if (!style) continue

    // Paragraphs inside table cells would otherwise pad every cell.
    if (tag === 'p' && element.closest('td, th')) {
      style = 'margin:0; line-height:1.5;'
    }
    element.setAttribute('style', style)

    if (tag === 'table') {
      // Attribute fallbacks for clients that ignore CSS on tables.
      element.setAttribute('width', '100%')
      element.setAttribute('cellpadding', '0')
      element.setAttribute('cellspacing', '0')
      element.setAttribute('border', '0')
    }
  }
}

function openTag(element: Element) {
  const attrs = Array.from(element.attributes)
    .map((attr) => ` ${attr.name}="${escapeAttr(attr.value)}"`)
    .join('')
  return `<${element.tagName.toLowerCase()}${attrs}>`
}

function inlineHtml(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? '')
  if (node instanceof Element) return node.outerHTML
  return ''
}

/** Prints block elements one per line, indented; inline content stays intact. */
function prettyPrint(parent: Node, depth: number): string[] {
  const indent = '  '.repeat(depth)
  const lines: string[] = []
  let inlineRun = ''

  const flushInline = () => {
    const text = inlineRun.trim()
    if (text) lines.push(indent + text)
    inlineRun = ''
  }

  for (const child of Array.from(parent.childNodes)) {
    if (!(child instanceof Element) || !BLOCK_TAGS.has(child.tagName.toLowerCase())) {
      inlineRun += inlineHtml(child)
      continue
    }
    flushInline()

    const tag = child.tagName.toLowerCase()
    const hasBlockChild = Array.from(child.children).some((c) =>
      BLOCK_TAGS.has(c.tagName.toLowerCase()),
    )
    if (hasBlockChild) {
      lines.push(indent + openTag(child))
      lines.push(...prettyPrint(child, depth + 1))
      lines.push(`${indent}</${tag}>`)
    } else {
      lines.push(`${indent}${openTag(child)}${child.innerHTML}</${tag}>`)
    }
  }
  flushInline()
  return lines
}

function wrapDocument(body: string, title: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeText(title)}</title>
</head>
<body style="margin:0; padding:0; background-color:#ffffff; font-family:${FONT_STACK}; font-size:14px; color:${TEXT_COLOR};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="${CONTENT_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; width:100%; max-width:${CONTENT_WIDTH}px;">
        <tr>
          <td align="left" style="font-family:${FONT_STACK}; font-size:14px; line-height:1.5; color:${TEXT_COLOR};">
${body}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`
}

export async function convertDocxToHtml(file: File): Promise<DocxConversion> {
  const arrayBuffer = await file.arrayBuffer()
  // Empty paragraphs are kept so they can be clicked to receive a field.
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    { styleMap: STYLE_MAP, ignoreEmptyParagraphs: false },
  )

  const warnings = Array.from(
    new Set(
      result.messages.map((message) =>
        message.type === 'error' ? `Error: ${message.message}` : message.message,
      ),
    ),
  )

  // DOMParser gives an inert document: nothing in it loads or runs. The result
  // is only ever rendered inside the script-less sandboxed preview iframe.
  const container = new DOMParser().parseFromString(result.value, 'text/html').body
  applyInlineStyles(container)

  const imageCount = container.querySelectorAll('img').length
  if (imageCount > 0) {
    warnings.push(
      `${imageCount} image(s) embedded as base64 data URIs. These render in HTML-to-PDF, ` +
        'but many email clients (including Outlook) block them — host the images and replace the src for email use.',
    )
  }
  if (!container.textContent?.trim() && imageCount === 0) {
    warnings.push('The document produced no content.')
  }

  const title = file.name.replace(/\.docx$/i, '')
  const body = prettyPrint(container, 6).join('\n')
  return { html: wrapDocument(body, title), warnings }
}
