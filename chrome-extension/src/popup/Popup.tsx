import { useState, useEffect } from 'react'
import type { Profile, SWResponse } from '../shared/types'

type View = 'loading' | 'login' | 'select-profile' | 'ready'

export default function Popup() {
  const [view, setView] = useState<View>('loading')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [storedUsername, setStoredUsername] = useState('')
  const [activeProfileName, setActiveProfileName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

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
      'active_profile_id',
      'active_profile_name',
    ]) as {
      access_token?: string
      username?: string
      active_profile_id?: string
      active_profile_name?: string
    }

    if (!data.access_token) {
      setView('login')
      return
    }

    setStoredUsername(data.username || '')
    setActiveProfileName(data.active_profile_name || '')

    if (data.active_profile_id) {
      setSelectedProfileId(data.active_profile_id)
      setView('ready')
    } else {
      setView('select-profile')
      await fetchProfiles()
    }
  }

  async function fetchProfiles() {
    const res: SWResponse<Profile[]> = await chrome.runtime.sendMessage({ type: 'GET_PROFILES' })
    if (res.ok) {
      setProfiles(res.data)
      if (res.data.length > 0) setSelectedProfileId(res.data[0].id)
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
      setView('select-profile')
      await fetchProfiles()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveProfile() {
    const profile = profiles.find((p) => p.id === selectedProfileId)
    if (!profile) return
    setProfileSaving(true)
    await chrome.storage.local.set({
      active_profile_id: profile.id,
      active_profile_name: profile.name,
    })
    setActiveProfileName(profile.name)
    setProfileSaving(false)
    setView('ready')
  }

  async function handleChangeProfile() {
    setView('select-profile')
    await fetchProfiles()
  }

  async function handleLogout() {
    await chrome.runtime.sendMessage({ type: 'LOGOUT' })
    setUsername('')
    setPassword('')
    setLoginError('')
    setView('login')
  }

  if (view === 'loading') {
    return (
      <div className="w-[380px] h-[200px] flex items-center justify-center bg-slate-950">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (view === 'login') {
    return (
      <div className="w-[380px] bg-slate-950 text-white">
        <div className="px-6 pt-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold">
              AV
            </div>
            <span className="font-semibold text-slate-100">AurexViper Resume</span>
          </div>
          <p className="text-slate-400 text-xs mt-1">Sign in to get started</p>
        </div>

        <form onSubmit={handleLogin} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="your username"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {loginError && (
            <p className="text-red-400 text-xs bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
              {loginError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    )
  }

  if (view === 'select-profile') {
    return (
      <div className="w-[380px] bg-slate-950 text-white">
        <div className="px-6 pt-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold">
              AV
            </div>
            <div>
              <span className="font-semibold text-slate-100">AurexViper Resume</span>
              {storedUsername && (
                <span className="text-slate-400 text-xs ml-2">· {storedUsername}</span>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Select a profile to use
            </label>
            {profiles.length === 0 ? (
              <p className="text-slate-500 text-sm">No profiles found. Create one on the website first.</p>
            ) : (
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {profiles.length > 0 && (
            <button
              onClick={handleSaveProfile}
              disabled={profileSaving || !selectedProfileId}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {profileSaving ? 'Saving…' : 'Use This Profile'}
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-300 text-sm transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // ready view
  return (
    <div className="w-[380px] bg-slate-950 text-white">
      <div className="px-6 pt-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold">
            AV
          </div>
          <div>
            <span className="font-semibold text-slate-100">AurexViper Resume</span>
            {storedUsername && (
              <span className="text-slate-400 text-xs ml-2">· {storedUsername}</span>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800">
          <div className="w-8 h-8 rounded-full bg-indigo-900 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Active Profile</p>
            <p className="text-sm font-medium text-white truncate">{activeProfileName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Ready — open the sidebar on any job page
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleChangeProfile}
            className="flex-1 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-300 text-sm transition-colors"
          >
            Change Profile
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 py-2 rounded-lg border border-slate-700 hover:border-red-900 text-slate-400 hover:text-red-400 text-sm transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
