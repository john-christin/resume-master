import { useState, useEffect, useRef, useCallback } from 'react'
import type { ChatMessage, ChatRequest, ChatResponse, GenerateResult, ProfileDetails, SWResponse } from '../shared/types'
import FileCard from './components/FileCard'

interface AuthState {
  isLoggedIn: boolean
  username: string
  profileId: string | null
  profileName: string | null
}

type Stage =
  | { name: 'form' }
  | { name: 'generating' }
  | { name: 'results'; result: GenerateResult }

interface Pos { x: number; y: number }

const BUTTON_SIZE = 52
const PANEL_W = 380
const DRAG_THRESHOLD = 5

function clampPos(x: number, y: number): Pos {
  return {
    x: Math.max(8, Math.min(window.innerWidth - BUTTON_SIZE - 8, x)),
    y: Math.max(8, Math.min(window.innerHeight - BUTTON_SIZE - 8, y)),
  }
}

function defaultPos(): Pos {
  return clampPos(window.innerWidth - BUTTON_SIZE - 20, window.innerHeight - BUTTON_SIZE - 20)
}

function panelPos(btn: Pos): { top: number; left: number } {
  const gap = 12
  const pad = 8
  const estimatedH = 540

  // Prefer left of button, fall back to right
  let left = btn.x - PANEL_W - gap
  if (left < pad) left = btn.x + BUTTON_SIZE + gap
  left = Math.min(left, window.innerWidth - PANEL_W - pad)
  left = Math.max(left, pad)

  // Align top with button, shift up if overflows bottom
  let top = btn.y
  if (top + estimatedH > window.innerHeight - pad) top = window.innerHeight - estimatedH - pad
  if (top < pad) top = pad

  return { top, left }
}

export default function Widget() {
  const [pos, setPos] = useState<Pos>(defaultPos)
  const [open, setOpen] = useState(false)
  const [auth, setAuth] = useState<AuthState>({
    isLoggedIn: false, username: '', profileId: null, profileName: null,
  })
  const [stage, setStage] = useState<Stage>({ name: 'form' })
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [jobUrl, setJobUrl] = useState(window.location.href)
  const [jobDescription, setJobDescription] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'app' | 'chat' | 'details'>('app')
  const posRef = useRef(pos)
  posRef.current = pos

  // Restore saved position + last generation result
  useEffect(() => {
    chrome.storage.local.get(['widget_pos', 'last_result']).then(({ widget_pos, last_result }) => {
      if (widget_pos) setPos(clampPos((widget_pos as Pos).x, (widget_pos as Pos).y))
      if (last_result) setStage({ name: 'results', result: last_result as GenerateResult })
    })
  }, [])

  // Persist position with debounce
  useEffect(() => {
    const t = setTimeout(() => chrome.storage.local.set({ widget_pos: pos }), 600)
    return () => clearTimeout(t)
  }, [pos])

  useEffect(() => {
    loadAuth()
    const handler = () => loadAuth()
    chrome.storage.onChanged.addListener(handler)
    return () => chrome.storage.onChanged.removeListener(handler)
  }, [])

  async function loadAuth() {
    const data = (await chrome.storage.local.get([
      'access_token', 'username', 'active_profile_id', 'active_profile_name',
    ])) as { access_token?: string; username?: string; active_profile_id?: string; active_profile_name?: string }
    setAuth({
      isLoggedIn: !!data.access_token,
      username: data.username || '',
      profileId: data.active_profile_id || null,
      profileName: data.active_profile_name || null,
    })
  }

  // Drag-to-reposition the widget button
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startMouse = { x: e.clientX, y: e.clientY }
    const startPos = posRef.current
    let didDrag = false

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startMouse.x
      const dy = ev.clientY - startMouse.y
      if (!didDrag && Math.hypot(dx, dy) > DRAG_THRESHOLD) didDrag = true
      if (didDrag) setPos(clampPos(startPos.x + dx, startPos.y + dy))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!didDrag) setOpen((o) => !o)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  async function handleGenerate() {
    if (!auth.profileId) return
    setError('')
    setStage({ name: 'generating' })

    const res: SWResponse<GenerateResult> = await chrome.runtime.sendMessage({
      type: 'GENERATE',
      payload: {
        profile_id: auth.profileId,
        job_title: jobTitle,
        company: company || undefined,
        job_url: jobUrl || undefined,
        job_description: jobDescription,
      },
    })

    if (!res.ok) {
      setError(res.error)
      setStage({ name: 'form' })
      return
    }
    // Persist result so it survives navigation to the application page
    chrome.storage.local.set({ last_result: res.data })
    setStage({ name: 'results', result: res.data })
  }

  function handleReset() {
    chrome.storage.local.remove('last_result')
    setStage({ name: 'form' })
    setJobTitle('')
    setCompany('')
    setJobUrl(window.location.href)
    setJobDescription('')
    setError('')
  }

  const panel = panelPos(pos)
  const canGenerate = auth.isLoggedIn && !!auth.profileId && jobTitle.trim() && jobDescription.trim()

  return (
    <>
      {/* Floating trigger button */}
      <div
        onMouseDown={handleDragStart}
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          zIndex: 2147483647,
          pointerEvents: 'auto',
          cursor: 'grab',
          userSelect: 'none',
        }}
        title="AurexViper Resume Assistant"
      >
        <div
          className={`w-full h-full rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-200 ${
            open ? 'bg-indigo-500 scale-95' : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105'
          }`}
        >
          {open ? (
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 48 46" className="w-7 h-7" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill="white" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
            </svg>
          )}
        </div>
      </div>

      {/* Floating panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            top: panel.top,
            left: panel.left,
            width: PANEL_W,
            maxHeight: 560,
            zIndex: 2147483646,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          }}
          className="bg-slate-950 border border-slate-800"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 48 46" className="w-4 h-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fill="white" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">AurexViper</p>
                {auth.isLoggedIn && auth.profileName && (
                  <p className="text-[10px] text-slate-500 truncate">{auth.profileName}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors flex-shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          {auth.isLoggedIn && auth.profileId && (
            <div className="flex border-b border-slate-800 flex-shrink-0">
              {(['app', 'chat', 'details'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    activeTab === tab
                      ? 'text-indigo-400 border-b-2 border-indigo-500'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab === 'app' ? 'Application' : tab === 'chat' ? 'Q&A Chat' : 'Details'}
                </button>
              ))}
            </div>
          )}

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto av-panel min-h-0">
            {!auth.isLoggedIn ? (
              <NotLoggedIn />
            ) : !auth.profileId ? (
              <NoProfile />
            ) : activeTab === 'details' ? (
              <DetailsPanel profileId={auth.profileId} />
            ) : activeTab === 'chat' ? (
              <ChatPanel
                profileId={auth.profileId}
                jobTitle={stage.name === 'results' ? stage.result.job_title : jobTitle}
                company={stage.name === 'results' ? (stage.result.company ?? company) : company}
                jobDescription={jobDescription}
              />
            ) : stage.name === 'form' ? (
              <JobForm
                jobTitle={jobTitle}
                company={company}
                jobUrl={jobUrl}
                jobDescription={jobDescription}
                error={error}
                canGenerate={!!canGenerate}
                onJobTitle={setJobTitle}
                onCompany={setCompany}
                onJobUrl={setJobUrl}
                onJobDescription={setJobDescription}
                onGenerate={handleGenerate}
              />
            ) : stage.name === 'generating' ? (
              <Generating />
            ) : (
              <Results result={stage.result} onReset={handleReset} />
            )}
          </div>
        </div>
      )}
    </>
  )
}

function CopyButton({ value, id, copied, onCopy }: {
  value: string; id: string; copied: string | null; onCopy: (id: string, value: string) => void
}) {
  const done = copied === id
  return (
    <button
      onClick={() => onCopy(id, value)}
      title={done ? 'Copied!' : 'Copy'}
      className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
        done ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-300 hover:bg-slate-800'
      }`}
    >
      {done ? (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  )
}

function DetailsPanel({ profileId }: { profileId: string }) {
  const [details, setDetails] = useState<ProfileDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    chrome.runtime.sendMessage({ type: 'GET_PROFILE_DETAILS', profileId }).then(
      (res: SWResponse<ProfileDetails>) => {
        if (res.ok) setDetails(res.data)
        else setError(res.error)
        setLoading(false)
      },
    )
  }, [profileId])

  function handleCopy(id: string, value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !details) {
    return (
      <div className="px-4 py-6 text-xs text-red-400">{error || 'Failed to load details'}</div>
    )
  }

  const nameParts = details.name.trim().split(/\s+/)
  const firstName = nameParts[0] ?? ''
  const lastName = nameParts.slice(1).join(' ')

  // Best-effort parse of "City, State ZIP" for US addresses
  const locParts = details.location ? parseLocation(details.location) : null

  const rows: { id: string; label: string; value: string }[] = [
    { id: 'firstName', label: 'First Name', value: firstName },
    ...(lastName ? [{ id: 'lastName', label: 'Last Name', value: lastName }] : []),
    ...(details.location ? [{ id: 'location', label: 'Location', value: details.location }] : []),
    ...(locParts?.city ? [{ id: 'city', label: 'City', value: locParts.city }] : []),
    ...(locParts?.state ? [{ id: 'state', label: 'State', value: locParts.state }] : []),
    ...(locParts?.zip ? [{ id: 'zip', label: 'ZIP Code', value: locParts.zip }] : []),
    ...(details.phone ? [{ id: 'phone', label: 'Phone', value: details.phone }] : []),
    ...(details.email ? [{ id: 'email', label: 'Email', value: details.email }] : []),
    ...(details.linkedin ? [{ id: 'linkedin', label: 'LinkedIn URL', value: details.linkedin }] : []),
  ]

  return (
    <div className="px-4 py-3">
      <div className="divide-y divide-slate-800/70">
        {rows.map(({ id, label, value }) => (
          <div key={id} className="flex items-center gap-2 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide leading-none mb-1">{label}</p>
              <p className="text-xs text-slate-200 truncate">{value}</p>
            </div>
            <CopyButton value={value} id={id} copied={copied} onCopy={handleCopy} />
          </div>
        ))}
      </div>
    </div>
  )
}

function parseLocation(loc: string): { city?: string; state?: string; zip?: string } {
  // Handles "City, ST 12345" or "City, State" or "City, ST"
  const commaIdx = loc.indexOf(',')
  if (commaIdx === -1) return {}
  const city = loc.slice(0, commaIdx).trim()
  const rest = loc.slice(commaIdx + 1).trim()
  const tokens = rest.split(/\s+/)
  const state = tokens[0] ?? ''
  const zip = tokens[1] && /^\d{5}(-\d{4})?$/.test(tokens[1]) ? tokens[1] : ''
  return { city, state, ...(zip ? { zip } : {}) }
}

interface ChatPanelProps {
  profileId: string
  jobTitle: string
  company: string
  jobDescription: string
}

function ChatPanel({ profileId, jobTitle, company, jobDescription }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setError('')
    setLoading(true)

    const payload: ChatRequest = {
      profile_id: profileId,
      job_title: jobTitle || undefined,
      company: company || undefined,
      job_description: jobDescription || undefined,
      messages: next,
    }

    const res: SWResponse<ChatResponse> = await chrome.runtime.sendMessage({
      type: 'CHAT',
      payload,
    })

    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setMessages([...next, { role: 'assistant', content: res.data.message }])
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleCopy(idx: number, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(idx)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  function handleClear() {
    setMessages([])
    setError('')
  }

  const hasContext = !!(jobTitle || jobDescription)

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Context hint */}
      {!hasContext && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-900/50 text-[11px] text-amber-400 flex-shrink-0">
          Fill in the job title/description for more tailored answers.
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto av-panel px-3 py-3 space-y-3 min-h-0">
        {messages.length === 0 && !loading && (
          <div className="text-center text-slate-600 text-xs py-8">
            Ask any application question.<br />
            <span className="text-slate-700">e.g. "Why do you want to work here?"</span>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-slate-800 text-slate-200 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'assistant' && (
              <button
                onClick={() => handleCopy(idx, msg.content)}
                className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors px-1"
              >
                {copied === idx ? '✓ Copied' : 'Copy'}
              </button>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2">
            <div className="bg-slate-800 rounded-xl rounded-bl-sm px-3 py-2.5 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-slate-800 px-3 py-2.5 flex flex-col gap-2">
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="self-start text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            Clear conversation
          </button>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question… (Enter to send)"
            rows={2}
            className="av-input flex-1 resize-none text-xs"
            style={{ minHeight: 52, maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m-7 7l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function NotLoggedIn() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-10 gap-3">
      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
        <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <p className="text-sm text-slate-400">Click the extension icon to sign in</p>
    </div>
  )
}

function NoProfile() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-10 gap-3">
      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
        <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-sm text-slate-400">Select a profile via the extension icon to begin</p>
    </div>
  )
}

interface JobFormProps {
  jobTitle: string; company: string; jobUrl: string; jobDescription: string
  error: string; canGenerate: boolean
  onJobTitle: (v: string) => void; onCompany: (v: string) => void
  onJobUrl: (v: string) => void; onJobDescription: (v: string) => void
  onGenerate: () => void
}

function JobForm({ jobTitle, company, jobUrl, jobDescription, error, canGenerate,
  onJobTitle, onCompany, onJobUrl, onJobDescription, onGenerate }: JobFormProps) {
  return (
    <div className="px-4 py-4 space-y-3">
      <Field label="Job Title *">
        <input type="text" value={jobTitle} onChange={(e) => onJobTitle(e.target.value)}
          placeholder="e.g. Senior Software Engineer" className="av-input" />
      </Field>
      <Field label="Company">
        <input type="text" value={company} onChange={(e) => onCompany(e.target.value)}
          placeholder="e.g. Acme Corp" className="av-input" />
      </Field>
      <Field label="Job URL">
        <input type="url" value={jobUrl} onChange={(e) => onJobUrl(e.target.value)} className="av-input" />
      </Field>
      <Field label="Job Description *">
        <textarea value={jobDescription} onChange={(e) => onJobDescription(e.target.value)}
          placeholder="Paste the full job description here…" rows={9} className="av-input resize-none" />
      </Field>
      {error && (
        <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</div>
      )}
      <button onClick={onGenerate} disabled={!canGenerate}
        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors">
        Generate Application
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Generating() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 gap-4">
      <div className="w-9 h-9 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-400 text-center">Generating your tailored resume and cover letter…</p>
      <p className="text-xs text-slate-600 text-center">This may take 30–60 seconds</p>
    </div>
  )
}

function Results({ result, onReset }: { result: GenerateResult; onReset: () => void }) {
  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 rounded-lg px-3 py-2">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Generated for <span className="font-medium text-emerald-300 truncate">{result.job_title}</span>
      </div>
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Your Documents</p>
        <FileCard title="Resume" fileUrl={result.resume_url} fillIndex={0} profileName={result.profile_name} />
        <FileCard title="Cover Letter" fileUrl={result.cover_letter_url} fillIndex={1} profileName={result.profile_name} />
      </div>
      <div className="rounded-xl bg-slate-900/50 border border-slate-800 px-3 py-2.5">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          <span className="text-slate-400 font-medium">Tip:</span> Use "Fill file input" to attach the file directly to the upload field on this page.
        </p>
      </div>
      <button onClick={onReset}
        className="w-full py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 text-sm transition-colors">
        Generate Another
      </button>
    </div>
  )
}
