import { useState, useEffect } from 'react'
import type { ApplicationExtra, ApplicationHit, Profile, SWResponse } from '../../shared/types'
import { attachToFileInput, fetchFileBlob } from './fileInput'

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
  const [busy, setBusy] = useState<string | null>(null)
  const [flashed, setFlashed] = useState<{ key: string; text: string; ok: boolean } | null>(null)
  const [savingApplied, setSavingApplied] = useState(false)
  const [error, setError] = useState('')
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

  const documents = [
    { key: 'resume', label: 'Resume', base: resumeBase, filename: `${slug}_Resume.pdf`, fillIndex: 0 },
    { key: 'cover', label: 'Cover Letter', base: coverBase, filename: `${slug}_Cover_Letter.pdf`, fillIndex: 1 },
  ].filter((doc) => doc.base)

  /** Briefly show the outcome on the button that was pressed. */
  function flash(key: string, text: string, ok: boolean) {
    setFlashed({ key, text, ok })
    setTimeout(() => setFlashed((cur) => (cur?.key === key ? null : cur)), 2500)
  }

  async function handleDownload(doc: (typeof documents)[number]) {
    const key = `download-${doc.key}`
    setBusy(key)
    setError('')
    const res: SWResponse = await chrome.runtime.sendMessage({
      type: 'DOWNLOAD_APP_FILES',
      files: [{ url: `/api/download/${doc.base}.pdf`, filename: doc.filename }],
    })
    setBusy(null)
    if (!res.ok) setError(res.error)
    else flash(key, '✓ Downloaded', true)
  }

  /** Put the PDF into the job page's file input (resume first, cover letter second). */
  async function handleAttach(doc: (typeof documents)[number]) {
    const key = `attach-${doc.key}`
    setBusy(key)
    setError('')
    const file = await fetchFileBlob(`/api/download/${doc.base}.pdf`)
    setBusy(null)
    if (!file) {
      setError(`Failed to load the ${doc.label.toLowerCase()}`)
      return
    }
    const result = attachToFileInput(file.blob, doc.filename, doc.fillIndex)
    if (result === 'filled') flash(key, '✓ Attached', true)
    else flash(key, result === 'not-found' ? 'No file input on this page' : 'Attach failed', false)
  }

  async function handleCopyCoverLetter() {
    if (!extra?.cover_letter_text) return
    try {
      await navigator.clipboard.writeText(extra.cover_letter_text)
      flash('copy-cover', '✓ Copied', true)
    } catch {
      flash('copy-cover', 'Copy failed', false)
    }
  }

  function actionLabel(key: string, label: string) {
    if (flashed?.key === key) return flashed.text
    return busy === key ? 'Working…' : label
  }

  function actionClass(key: string, primary = false) {
    const base = 'py-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-40'
    if (flashed?.key === key) {
      return `${base} border ${flashed.ok ? 'bg-emerald-950/50 border-emerald-800 text-emerald-400' : 'bg-amber-950/50 border-amber-800 text-amber-400'}`
    }
    return primary
      ? `${base} bg-indigo-600 hover:bg-indigo-500 text-white`
      : `${base} border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-600`
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

      {/* Documents: download or attach each as PDF, copy the cover letter text */}
      {documents.length > 0 || extra?.cover_letter_text ? (
        <div className="grid grid-cols-2 gap-2">
          {documents.map((doc) => (
            <div key={doc.key} className="contents">
              <button
                onClick={() => handleDownload(doc)}
                disabled={busy !== null}
                className={actionClass(`download-${doc.key}`, true)}
              >
                {actionLabel(`download-${doc.key}`, `↓ Download ${doc.label}`)}
              </button>
              <button
                onClick={() => handleAttach(doc)}
                disabled={busy !== null}
                className={actionClass(`attach-${doc.key}`)}
              >
                {actionLabel(`attach-${doc.key}`, `📎 Attach ${doc.label}`)}
              </button>
            </div>
          ))}
          {extra?.cover_letter_text && (
            <button
              onClick={handleCopyCoverLetter}
              className={`col-span-2 ${actionClass('copy-cover')}`}
            >
              {actionLabel('copy-cover', 'Copy Cover Letter')}
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          {extra ? 'No documents generated for this application yet.' : 'Loading documents…'}
        </p>
      )}

      {error && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</div>}
    </div>
  )
}
