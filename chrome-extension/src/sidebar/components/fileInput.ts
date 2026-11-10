import type { FetchedFile, SWResponse } from '../../shared/types'

export type AttachResult = 'filled' | 'not-found' | 'error'

/** Fetch a file through the service worker (it holds the auth token). */
export async function fetchFileBlob(url: string): Promise<{ blob: Blob; filename: string } | null> {
  const res: SWResponse<FetchedFile> = await chrome.runtime.sendMessage({ type: 'FETCH_FILE', url })
  if (!res.ok) return null
  const { base64, contentType, filename } = res.data
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { blob: new Blob([bytes], { type: contentType }), filename }
}

/**
 * Put a file into one of the page's file inputs: the Nth one, or the last if there
 * aren't enough. Highlights the input and scrolls to it so the user sees what happened.
 */
export function attachToFileInput(blob: Blob, filename: string, fillIndex: number): AttachResult {
  // The content script has full DOM access to the host page
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'))
  if (inputs.length === 0) return 'not-found'
  const input = inputs[Math.min(fillIndex, inputs.length - 1)]

  try {
    const file = new File([blob], filename, { type: blob.type })
    const dt = new DataTransfer()
    dt.items.add(file)

    // Use the native prototype setter so React synthetic events fire correctly
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files')?.set
    if (nativeSetter) {
      nativeSetter.call(input, dt.files)
    } else {
      input.files = dt.files
    }

    // Dispatch both events — some frameworks listen to one or the other
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.dispatchEvent(new Event('input', { bubbles: true }))

    const prev = { outline: input.style.outline, outlineOffset: input.style.outlineOffset }
    input.style.outline = '3px solid #6366f1'
    input.style.outlineOffset = '3px'
    setTimeout(() => {
      input.style.outline = prev.outline
      input.style.outlineOffset = prev.outlineOffset
    }, 2500)

    input.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return 'filled'
  } catch {
    return 'error'
  }
}
