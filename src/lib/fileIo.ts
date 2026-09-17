/**
 * File and clipboard helpers.
 *
 * Everything here uses browser APIs only — there is no server to talk to, so
 * loading and saving happen through the File System Access API where the
 * browser supports it and through a plain download otherwise.
 */

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: { description: string; accept: Record<string, string[]> }[]
}

interface FileSystemWritable {
  write: (data: string) => Promise<void>
  close: () => Promise<void>
}

interface FileSystemHandleLike {
  name: string
  createWritable: () => Promise<FileSystemWritable>
}

type WindowWithSavePicker = Window & {
  showSaveFilePicker?: (
    options?: SaveFilePickerOptions,
  ) => Promise<FileSystemHandleLike>
}

export class SaveCancelledError extends Error {
  constructor() {
    super('Save cancelled')
    this.name = 'SaveCancelledError'
  }
}

function downloadFallback(html: string, suggestedName: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = suggestedName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoke after the click has been processed by the browser.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return suggestedName
}

/** Saves the HTML and returns the file name that was written. */
export async function saveHtmlFile(
  html: string,
  suggestedName = 'email-template.html',
): Promise<string> {
  const picker = (window as WindowWithSavePicker).showSaveFilePicker
  if (!picker) {
    return downloadFallback(html, suggestedName)
  }

  let handle: FileSystemHandleLike
  try {
    handle = await picker.call(window, {
      suggestedName,
      types: [
        {
          description: 'HTML file',
          accept: { 'text/html': ['.html', '.htm'] },
        },
      ],
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new SaveCancelledError()
    }
    // Picker unavailable in this context (e.g. blocked permission) — fall back.
    return downloadFallback(html, suggestedName)
  }

  const writable = await handle.createWritable()
  await writable.write(html)
  await writable.close()
  return handle.name
}

export async function readHtmlFile(file: File): Promise<string> {
  return file.text()
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  // Fallback for non-secure contexts, where navigator.clipboard is absent.
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) {
    throw new Error('Clipboard copy was rejected by the browser')
  }
}
