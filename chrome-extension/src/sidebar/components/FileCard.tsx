import { useState, useEffect, useRef } from 'react'
import type { FetchedFile, SWResponse } from '../../shared/types'

interface Props {
  title: string
  fileUrl: string    // e.g. "/api/generate/download/resume.pdf"
  fillIndex: number  // which file input on the page to target (0 = first, 1 = second, …)
  profileName?: string
}

type LoadState = 'loading' | 'ready' | 'error'
type FillStatus = 'idle' | 'filled' | 'not-found' | 'error'

/** "Joshua Preston" → "Joshua_Preston" */
function toSlug(name: string) {
  return name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
}

/** Build the user-facing filename: "Joshua_Preston_Resume.pdf" */
function buildFilename(serverFilename: string, profileName: string | undefined, title: string) {
  const ext = serverFilename.split('.').pop() || 'pdf'
  const label = title.replace(/\s+/g, '_') // "Cover Letter" → "Cover_Letter"
  if (profileName) return `${toSlug(profileName)}_${label}.${ext}`
  return serverFilename
}

export default function FileCard({ title, fileUrl, fillIndex, profileName }: Props) {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [blob, setBlob] = useState<Blob | null>(null)
  const [filename, setFilename] = useState('')
  const [fillStatus, setFillStatus] = useState<FillStatus>('idle')
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadState('loading')
    setBlob(null)
    setFillStatus('idle')

    chrome.runtime.sendMessage({ type: 'FETCH_FILE', url: fileUrl }).then(
      (res: SWResponse<FetchedFile>) => {
        if (cancelled) return
        if (!res.ok) { setLoadState('error'); return }
        const { base64, contentType, filename: fname } = res.data
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        setBlob(new Blob([bytes], { type: contentType }))
        setFilename(fname)
        setLoadState('ready')
      },
    )

    return () => {
      cancelled = true
      if (highlightTimer.current) clearTimeout(highlightTimer.current)
    }
  }, [fileUrl])

  function handleFillInput() {
    if (!blob) return

    // Query all file inputs in the host page (content script has full DOM access)
    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="file"]'),
    )

    if (inputs.length === 0) {
      setFillStatus('not-found')
      return
    }

    // Target the Nth input; fall back to the last one if there aren't enough
    const input = inputs[Math.min(fillIndex, inputs.length - 1)]

    try {
      const renamedFilename = buildFilename(filename, profileName, title)
      const file = new File([blob], renamedFilename, { type: blob.type })
      const dt = new DataTransfer()
      dt.items.add(file)

      // Use the native prototype setter so React synthetic events fire correctly
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'files',
      )?.set
      if (nativeSetter) {
        nativeSetter.call(input, dt.files)
      } else {
        input.files = dt.files
      }

      // Dispatch both events — some frameworks listen to one or the other
      input.dispatchEvent(new Event('change', { bubbles: true }))
      input.dispatchEvent(new Event('input', { bubbles: true }))

      // Briefly highlight the filled input so the user can see what happened
      const prev = { outline: input.style.outline, outlineOffset: input.style.outlineOffset }
      input.style.outline = '3px solid #6366f1'
      input.style.outlineOffset = '3px'
      highlightTimer.current = setTimeout(() => {
        input.style.outline = prev.outline
        input.style.outlineOffset = prev.outlineOffset
      }, 2500)

      // Scroll the input into view
      input.scrollIntoView({ behavior: 'smooth', block: 'center' })

      setFillStatus('filled')
      // Reset status badge after a few seconds
      setTimeout(() => setFillStatus('idle'), 4000)
    } catch {
      setFillStatus('error')
    }
  }

  async function handleDownload() {
    if (!blob) return
    const renamedFilename = buildFilename(filename, profileName, title)
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
    chrome.runtime.sendMessage({ type: 'DOWNLOAD_FILE', filename: renamedFilename, dataUrl })
  }

  // Drag support — works on custom drop zones that read dataTransfer.items.
  // NOTE: native <input type="file"> elements ignore this because they only
  // accept OS-originated file drags (dataTransfer.files). Use "Fill input" instead.
  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    if (!blob) return
    const renamedFilename = buildFilename(filename, profileName, title)
    e.dataTransfer.items.add(new File([blob], renamedFilename, { type: blob.type }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const isPdf = filename.endsWith('.pdf')

  return (
    <div
      draggable={loadState === 'ready'}
      onDragStart={handleDragStart}
      className={`rounded-xl border transition-all duration-200 overflow-hidden select-none ${
        loadState === 'ready'
          ? 'border-slate-700 bg-slate-900'
          : 'border-slate-800 bg-slate-900/50'
      }`}
    >
      {/* Top row: icon + title */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isPdf ? 'bg-red-950 text-red-400' : 'bg-indigo-950 text-indigo-400'
          }`}
        >
          {isPdf ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clipRule="evenodd" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{title}</p>
          {loadState === 'loading' && (
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span className="inline-block w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin" />
              Preparing…
            </p>
          )}
          {loadState === 'error' && (
            <p className="text-xs text-red-400 mt-0.5">Failed to load file</p>
          )}
          {loadState === 'ready' && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{filename}</p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {loadState === 'ready' && (
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={handleFillInput}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              fillStatus === 'filled'
                ? 'bg-emerald-950/50 border-emerald-800 text-emerald-400'
                : fillStatus === 'not-found'
                ? 'bg-amber-950/50 border-amber-800 text-amber-400'
                : fillStatus === 'error'
                ? 'bg-red-950/50 border-red-800 text-red-400'
                : 'bg-indigo-950/50 border-indigo-800 text-indigo-300 hover:bg-indigo-900/50'
            }`}
          >
            {fillStatus === 'filled' && '✓ Filled!'}
            {fillStatus === 'not-found' && 'No input found'}
            {fillStatus === 'error' && 'Fill failed'}
            {(fillStatus === 'idle') && '↓ Fill file input'}
          </button>

          <button
            onClick={handleDownload}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
          >
            ↓ Download
          </button>
        </div>
      )}
    </div>
  )
}
