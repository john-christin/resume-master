import { useState, useEffect, useRef } from 'react'
import type { ApplicationExtra, ApplicationHit, AppChatReply, ChatMessage, Profile, SWResponse } from '../../shared/types'

type Format = 'pdf' | 'docx'

/**
 * Applications of the profiles picked in the extension, newest first.
 * An empty query lists the latest ones; a query narrows by company, role or link.
 */
export function useApplicationSearch(profileIds: string[]) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ApplicationHit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const profileKey = profileIds.join(',')

  async function run(q: string) {
    setSearching(true)
    setError('')
    const res: SWResponse<ApplicationHit[]> = await chrome.runtime.sendMessage({
      type: 'SEARCH_APPLICATIONS',
      query: q,
      profileIds,
    })
    setSearching(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setResults(res.data)
  }

  // A different profile selection makes the previous list stale
  useEffect(() => {
    setResults(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileKey])

  return { query, setQuery, results, setResults, searching, error, search: () => run(query.trim()), loadRecent: () => run('') }
}

export function hitLabel(hit: ApplicationHit) {
  return `${hit.company || 'Unknown company'} – ${hit.job_title}`
}

export function HitList({ hits, onPick }: { hits: ApplicationHit[]; onPick: (hit: ApplicationHit) => void }) {
  if (hits.length === 0) return <p className="px-3 py-2 text-xs text-slate-500">No matching applications</p>
  return (
    <>
      {hits.map((hit) => (
        <button
          key={hit.id}
          onClick={() => onPick(hit)}
          className="block w-full text-left px-3 py-2 hover:bg-slate-800 transition-colors"
        >
          <p className="text-xs text-slate-200 truncate">
            {hit.applied && <span className="text-emerald-400 mr-1">✓</span>}
            {hitLabel(hit)}
          </p>
          <p className="text-[10px] text-slate-500 truncate">
            {[hit.profile_name, new Date(hit.created_at).toLocaleDateString()].filter(Boolean).join(' · ')}
          </p>
        </button>
      ))}
    </>
  )
}

export default function ApplicationsPanel({ profiles, selected, onSelect }: {
  profiles: Profile[]; selected: ApplicationHit | null; onSelect: (hit: ApplicationHit | null) => void
}) {
  const profileIds = profiles.map((p) => p.id)
  const { query, setQuery, results, searching, error, search, loadRecent } = useApplicationSearch(profileIds)

  // Show the latest applications right away
  useEffect(() => {
    if (results === null && !selected && !error && !searching) loadRecent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, selected, error, searching, profileIds.join(',')])

  if (selected) {
    return <ApplicationDetail hit={selected} onBack={() => onSelect(null)} onChange={onSelect} />
  }

  return (
    <div className="px-3 py-3 space-y-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            search()
          }
        }}
        placeholder="Paste company or job title, then Enter"
        className="av-input w-full text-xs"
      />
      <p className="text-[10px] text-slate-600">
        {query.trim() ? 'Results' : 'Latest applications'} for {profiles.map((p) => p.name).join(', ')}
      </p>
      {error && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</div>}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden">
        {searching && !results ? (
          <p className="px-3 py-2 text-xs text-slate-500">Loading…</p>
        ) : (
          <HitList hits={results ?? []} onPick={onSelect} />
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide leading-none mb-1">{label}</p>
      <p className="text-xs text-slate-200">{value}</p>
    </div>
  )
}

function fileName(path: string | null) {
  return path ? (path.split('/').pop() ?? '').replace(/\.(pdf|docx)$/, '') : ''
}

/** "Joshua Preston" → "Joshua_Preston" */
function toSlug(name: string) {
  return name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
}

function ApplicationDetail({ hit, onBack, onChange }: {
  hit: ApplicationHit; onBack: () => void; onChange: (hit: ApplicationHit) => void
}) {
  const [downloading, setDownloading] = useState<Format | null>(null)
  const [savingApplied, setSavingApplied] = useState(false)
  const [error, setError] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [extra, setExtra] = useState<ApplicationExtra | null>(null)

  // Location, salary, skills… aren't in the list rows, so load the full application
  useEffect(() => {
    let cancelled = false
    setExtra(null)
    chrome.runtime.sendMessage({ type: 'GET_APPLICATION', appId: hit.id }).then((res: SWResponse<ApplicationExtra>) => {
      if (!cancelled && res.ok) setExtra(res.data)
    })
    return () => { cancelled = true }
  }, [hit.id])

  const resumeBase = fileName(hit.resume_path)
  const coverBase = fileName(hit.cover_letter_path)
  const slug = toSlug(hit.profile_name || 'Resume')

  /** Resume + cover letter, both in the same format. */
  async function handleDownloadBoth(format: Format) {
    setDownloading(format)
    setError('')
    const files = [
      ...(resumeBase ? [{ url: `/api/download/${resumeBase}.${format}`, filename: `${slug}_Resume.${format}` }] : []),
      ...(coverBase ? [{ url: `/api/download/${coverBase}.${format}`, filename: `${slug}_Cover_Letter.${format}` }] : []),
    ]
    const res: SWResponse = await chrome.runtime.sendMessage({ type: 'DOWNLOAD_APP_FILES', files })
    setDownloading(null)
    if (!res.ok) setError(res.error)
  }

  async function handleApplied(applied: boolean) {
    setSavingApplied(true)
    setError('')
    const res: SWResponse<{ applied: boolean; applied_at: string | null }> = await chrome.runtime.sendMessage({
      type: 'SET_APPLIED',
      appId: hit.id,
      applied,
    })
    setSavingApplied(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onChange({ ...hit, applied: res.data.applied, applied_at: res.data.applied_at })
  }

  return (
    <div className="px-3 py-3 space-y-3">
      <button onClick={onBack} className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
        ← Back to list
      </button>

      {/* Main details */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 space-y-1">
        <p className="text-sm font-medium text-slate-200">{hit.job_title}</p>
        <p className="text-xs text-slate-400">{hit.company || 'Unknown company'}</p>
        <p className="text-[10px] text-slate-500">
          {[hit.profile_name, new Date(hit.created_at).toLocaleString()].filter(Boolean).join(' · ')}
        </p>
        {hit.job_url && (
          <a href={hit.job_url} target="_blank" rel="noreferrer"
            className="block text-[11px] text-indigo-400 hover:text-indigo-300 truncate">
            {hit.job_url}
          </a>
        )}
        <label className="flex items-center gap-2 pt-1.5 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={hit.applied}
            disabled={savingApplied}
            onChange={(e) => handleApplied(e.target.checked)}
            className="accent-indigo-500"
          />
          Applied
          {hit.applied && hit.applied_at && (
            <span className="text-[10px] text-slate-500">{new Date(hit.applied_at).toLocaleDateString()}</span>
          )}
        </label>
      </div>

      {/* Job details */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 space-y-2">
        {!extra ? (
          <p className="text-xs text-slate-500">Loading details…</p>
        ) : (
          <>
            <DetailRow label="Location" value={extra.location} />
            <DetailRow label="Salary range" value={extra.salary_range} />
            <DetailRow label="Resume type" value={extra.resume_type} />
            <DetailRow
              label="Call"
              value={extra.call_status
                ? [extra.call_stage, extra.call_status, extra.call_scheduled_at && new Date(extra.call_scheduled_at).toLocaleString()]
                    .filter(Boolean).join(' · ')
                : null}
            />
            {extra.required_skills.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Required skills</p>
                <div className="flex flex-wrap gap-1">
                  {extra.required_skills.map((skill) => (
                    <span key={skill} className="px-1.5 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300">{skill}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Documents: resume + cover letter together */}
      {resumeBase || coverBase ? (
        <div className="flex gap-2">
          {(['pdf', 'docx'] as const).map((format) => (
            <button
              key={format}
              onClick={() => handleDownloadBoth(format)}
              disabled={downloading !== null}
              className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
            >
              {downloading === format ? 'Downloading…' : `↓ Download both (${format === 'pdf' ? 'PDF' : 'Word'})`}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">No documents generated for this application yet.</p>
      )}

      {error && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</div>}

      {/* Chat about this application */}
      <button
        onClick={() => setChatOpen((o) => !o)}
        className="w-full py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        {chatOpen ? 'Hide chat' : 'Chat about this application'}
      </button>
      {chatOpen && <AppChat appId={hit.id} />}
    </div>
  )
}

/** Compact chat bound to one application. */
function AppChat({ appId }: { appId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setMessages([])
    setLoading(true)
    chrome.runtime.sendMessage({ type: 'GET_APP_CHAT', appId }).then((res: SWResponse<ChatMessage[]>) => {
      if (cancelled) return
      setLoading(false)
      if (!res.ok) setError(res.error)
      else setMessages(res.data.map((m) => ({ role: m.role, content: m.content })))
    })
    return () => { cancelled = true }
  }, [appId])

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
    const res: SWResponse<AppChatReply> = await chrome.runtime.sendMessage({ type: 'APP_CHAT', appId, content: text })
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setMessages([...next, { role: 'assistant', content: res.data.message.content }])
  }

  function handleCopy(idx: number, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(idx)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 flex flex-col">
      <div className="max-h-64 overflow-y-auto av-panel px-3 py-3 space-y-3">
        {messages.length === 0 && !loading && (
          <p className="text-center text-slate-600 text-xs py-4">Ask about this application.</p>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-200 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'assistant' && (
              <button onClick={() => handleCopy(idx, msg.content)}
                className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors px-1">
                {copied === idx ? '✓ Copied' : 'Copy'}
              </button>
            )}
          </div>
        ))}
        {loading && <p className="text-xs text-slate-500">Thinking…</p>}
        {error && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</div>}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-slate-800 px-3 py-2 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Ask a question… (Enter to send)"
          rows={2}
          className="av-input flex-1 resize-none text-xs"
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
  )
}
