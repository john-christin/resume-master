import { useState, useEffect } from 'react'
import type { Profile, SWResponse } from '../shared/types'

type View = 'loading' | 'login' | 'select-profiles' | 'ready'

const DEFAULT_BASE_URL = 'https://aurexviper.pro'

export default function Popup() {
  const [view, setView] = useState<View>('loading')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [confirmedProfiles, setConfirmedProfiles] = useState<Profile[]>([])
  const [storedUsername, setStoredUsername] = useState('')
  const [confirming, setConfirming] = useState(false)
  // Settings panel
  const [showSettings, setShowSettings] = useState(false)
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL)
  const [savingUrl, setSavingUrl] = useState(false)

  useEffect(() => {
    loadState()
    const handler = () => loadState()
    chrome.storage.onChanged.addListener(handler)
    return () => chrome.storage.onChanged.removeListener(handler)
  }, [])

  async function loadState() {
    const data = await chrome.storage.local.get([
      'access_token',
      'username',
      'confirmed_profiles',
    ]) as {
      access_token?: string
      username?: string
      confirmed_profiles?: Profile[]
    }
    const urlData = await chrome.storage.sync.get('base_url') as { base_url?: string }
    setBaseUrl(urlData.base_url || DEFAULT_BASE_URL)

    if (!data.access_token) {
      setView('login')
      return
    }

    setStoredUsername(data.username || '')
    const confirmed = data.confirmed_profiles || []
    setConfirmedProfiles(confirmed)

    if (confirmed.length > 0) {
      setView('ready')
    } else {
      setView('select-profiles')
      await fetchProfiles()
    }
  }

  async function fetchProfiles() {
    const res: SWResponse<Profile[]> = await chrome.runtime.sendMessage({ type: 'GET_PROFILES' })
    if (res.ok) {
      setProfiles(res.data)
      setCheckedIds(new Set(res.data.map((p) => p.id)))
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setSubmitting(true)
    try {
      const res: SWResponse = await chrome.runtime.sendMessage({
        type: 'LOGIN',
        username,
        password,
      })
      if (!res.ok) {
        setLoginError(res.error)
        return
      }
      setView('select-profiles')
      await fetchProfiles()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmProfiles() {
    const selected = profiles.filter((p) => checkedIds.has(p.id))
    if (selected.length === 0) return
    setConfirming(true)
    await chrome.runtime.sendMessage({ type: 'SET_CONFIRMED_PROFILES', profiles: selected })
    setConfirmedProfiles(selected)
    setConfirming(false)
    setView('ready')
  }

  async function handleChangeProfiles() {
    setView('select-profiles')
    await fetchProfiles()
  }

  async function handleLogout() {
    await chrome.runtime.sendMessage({ type: 'LOGOUT' })
    setUsername('')
    setPassword('')
    setLoginError('')
    setConfirmedProfiles([])
    setView('login')
  }

  async function handleSaveBaseUrl() {
    setSavingUrl(true)
    await chrome.runtime.sendMessage({ type: 'SET_BASE_URL', url: baseUrl.trim() || DEFAULT_BASE_URL })
    setSavingUrl(false)
    setShowSettings(false)
  }

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Loading ──────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div className="w-[380px] h-[200px] flex items-center justify-center bg-slate-950">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Login ────────────────────────────────────────────────────────────
  if (view === 'login') {
    return (
      <div className="w-[380px] bg-slate-950 text-white">
        <div className="px-6 pt-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold">AV</div>
            <span className="font-semibold text-slate-100">AurexViper Resume</span>
          </div>
          <p className="text-slate-400 text-xs mt-1">Sign in to get started</p>
        </div>

        <form onSubmit={handleLogin} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              required autoFocus
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="your username" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="••••••••" />
          </div>
          {loginError && (
            <p className="text-red-400 text-xs bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{loginError}</p>
          )}
          <button type="submit" disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors">
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>

          {/* Base URL config for self-hosted */}
          <div className="pt-1 border-t border-slate-800">
            <label className="block text-xs font-medium text-slate-500 mb-1">Server URL</label>
            <div className="flex gap-2">
              <input type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                placeholder="https://aurexviper.pro" />
              <button type="button" onClick={handleSaveBaseUrl} disabled={savingUrl}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors">
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    )
  }

  // ── Select Profiles ──────────────────────────────────────────────────
  if (view === 'select-profiles') {
    return (
      <div className="w-[380px] bg-slate-950 text-white">
        <div className="px-6 pt-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold">AV</div>
            <div>
              <span className="font-semibold text-slate-100">AurexViper Resume</span>
              {storedUsername && <span className="text-slate-400 text-xs ml-2">· {storedUsername}</span>}
            </div>
          </div>
          <p className="text-slate-400 text-xs mt-1">Select profiles to queue for</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {profiles.length === 0 ? (
            <p className="text-slate-500 text-sm">No profiles found. Create one on the website first.</p>
          ) : (
            <div className="space-y-2">
              {profiles.map((p) => (
                <label key={p.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    checkedIds.has(p.id)
                      ? 'bg-indigo-950/50 border-indigo-700'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}>
                  <input type="checkbox" checked={checkedIds.has(p.id)} onChange={() => toggleCheck(p.id)}
                    className="w-4 h-4 accent-indigo-500 flex-shrink-0" />
                  <span className="text-sm text-slate-200 truncate">{p.name}</span>
                </label>
              ))}
            </div>
          )}

          {profiles.length > 0 && (
            <button onClick={handleConfirmProfiles}
              disabled={confirming || checkedIds.size === 0}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors">
              {confirming ? 'Confirming…' : `Confirm ${checkedIds.size} Profile${checkedIds.size !== 1 ? 's' : ''}`}
            </button>
          )}

          <button onClick={handleLogout}
            className="w-full py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-300 text-sm transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // ── Ready ────────────────────────────────────────────────────────────
  return (
    <div className="w-[380px] bg-slate-950 text-white">
      <div className="px-6 pt-6 pb-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold">AV</div>
            <div>
              <span className="font-semibold text-slate-100">AurexViper Resume</span>
              {storedUsername && <span className="text-slate-400 text-xs ml-2">· {storedUsername}</span>}
            </div>
          </div>
          <button onClick={() => setShowSettings((s) => !s)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            title="Settings">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {showSettings ? (
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs font-medium text-slate-400">Server URL</p>
          <input type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
            placeholder="https://aurexviper.pro" />
          <div className="flex gap-2">
            <button onClick={handleSaveBaseUrl} disabled={savingUrl}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm transition-colors">
              {savingUrl ? 'Saving…' : 'Save URL'}
            </button>
            <button onClick={() => setShowSettings(false)}
              className="flex-1 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-400 text-sm transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="px-6 py-5 space-y-4">
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-400 mb-2">Queuing for:</p>
            <div className="space-y-1.5">
              {confirmedProfiles.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                  <span className="text-xs text-slate-200 truncate">{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Ready — open the sidebar on any job page
          </div>

          <div className="flex gap-2">
            <button onClick={handleChangeProfiles}
              className="flex-1 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-300 text-sm transition-colors">
              Change Profiles
            </button>
            <button onClick={handleLogout}
              className="flex-1 py-2 rounded-lg border border-slate-700 hover:border-red-900 text-slate-400 hover:text-red-400 text-sm transition-colors">
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
