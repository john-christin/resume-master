import type { ChatResponse, ExtractedJobData, FetchedFile, MessageToSW, Profile, ProfileDetails, SWResponse, TabDraft } from '../shared/types'

const DEFAULT_BASE_URL = 'https://aurexviper.pro'

async function getBaseUrl(): Promise<string> {
  const { base_url } = await chrome.storage.sync.get('base_url')
  return (base_url as string) || DEFAULT_BASE_URL
}

async function getToken(): Promise<string | null> {
  const { access_token } = await chrome.storage.local.get('access_token')
  return (access_token as string) || null
}

/**
 * Keep the session in step with the server: store the renewed token it sends back
 * while we're active, and drop the stale one on 401 so the popup and widget show the
 * sign-in screen instead of failing to load data. The profile selection is kept.
 */
async function syncSession(res: Response, sentToken: string | null): Promise<void> {
  const renewed = res.headers.get('X-Access-Token')
  if (renewed && res.ok) {
    await chrome.storage.local.set({ access_token: renewed })
  } else if (res.status === 401 && sentToken) {
    // Only if nobody signed in again while this request was in flight
    if (sentToken === (await getToken())) {
      await chrome.storage.local.remove(['access_token', 'username', 'user_role', 'user_status'])
    }
  }
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const [token, base] = await Promise.all([getToken(), getBaseUrl()])
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  })
  await syncSession(res, token)
  return res
}

// ── Per-tab drafts ───────────────────────────────────────────────────────────
// One TabDraft per browser tab in chrome.storage.session. The service worker is the
// only writer: surfaces send patches, and writes for the same tab run one after the
// other so two of them can't overwrite each other.

const draftKey = (tabId: number) => `draft_${tabId}`
const draftWriteChains = new Map<number, Promise<void>>()

function mutateDraft(tabId: number, change: (draft: TabDraft | undefined) => TabDraft | undefined): Promise<void> {
  const previous = draftWriteChains.get(tabId) ?? Promise.resolve()
  // a failed earlier write must not block the ones after it
  const next = previous.catch(() => {}).then(async () => {
    const key = draftKey(tabId)
    const stored = (await chrome.storage.session.get(key))[key] as TabDraft | undefined
    const updated = change(stored)
    if (updated) await chrome.storage.session.set({ [key]: updated })
    else await chrome.storage.session.remove(key)
  })
  draftWriteChains.set(tabId, next)
  next.catch(() => {}).finally(() => {
    if (draftWriteChains.get(tabId) === next) draftWriteChains.delete(tabId)
  })
  return next
}

async function loadDraft(tabId: number): Promise<TabDraft | null> {
  await draftWriteChains.get(tabId)?.catch(() => {}) // see writes that are still in flight
  const key = draftKey(tabId)
  return ((await chrome.storage.session.get(key))[key] as TabDraft | undefined) ?? null
}

const EMPTY_DRAFT: TabDraft = {
  pageUrl: null,
  jobTitle: '',
  company: '',
  jobUrl: '',
  actualUrl: '',
  posted: '',
  jobDescription: '',
  result: null,
  activeTab: 'app',
  selectedApp: null,
}

// Chrome reuses tab ids only after a restart (which clears session storage), but a
// closed tab's draft is dropped right away anyway
chrome.tabs.onRemoved.addListener((tabId) => {
  mutateDraft(tabId, () => undefined).catch(() => {})
})

// "Apply" often opens the employer's site in a new tab: it inherits the job and the
// generated documents (not the page, the open panel tab or the selected application),
// so the files can be attached there.
chrome.tabs.onCreated.addListener((tab) => {
  const { id, openerTabId } = tab
  if (id === undefined || openerTabId === undefined) return
  loadDraft(openerTabId)
    .then((opener) => {
      if (!opener) return
      return mutateDraft(id, (existing) => existing ?? {
        ...EMPTY_DRAFT,
        jobTitle: opener.jobTitle,
        company: opener.company,
        jobUrl: opener.jobUrl,
        actualUrl: opener.actualUrl,
        posted: opener.posted,
        jobDescription: opener.jobDescription,
        result: opener.result,
      })
    })
    .catch(() => {})
})

// The result used to be one global value shared by every tab
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove('last_result')
})

chrome.runtime.onMessage.addListener(
  (msg: MessageToSW, sender, sendResponse) => {
    handle(msg, sender)
      .then(sendResponse)
      .catch((e: Error) => sendResponse({ ok: false, error: e.message }))
    return true // keep channel open for async
  },
)

async function handle(msg: MessageToSW, sender: chrome.runtime.MessageSender): Promise<SWResponse> {
  switch (msg.type) {
    case 'GET_DRAFT': {
      const tabId = sender.tab?.id
      if (tabId === undefined) return { ok: false, error: 'No tab' }
      return { ok: true, data: await loadDraft(tabId) }
    }

    case 'PATCH_DRAFT': {
      const tabId = sender.tab?.id
      if (tabId === undefined) return { ok: false, error: 'No tab' }
      await mutateDraft(tabId, (draft) => ({ ...(draft ?? EMPTY_DRAFT), ...msg.patch }))
      return { ok: true, data: null }
    }

    case 'CLEAR_DRAFT': {
      const tabId = sender.tab?.id
      if (tabId === undefined) return { ok: false, error: 'No tab' }
      await mutateDraft(tabId, () => undefined)
      return { ok: true, data: null }
    }

    case 'LOGIN': {
      const base = await getBaseUrl()
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: msg.username, password: msg.password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Login failed' }))
        return { ok: false, error: err.detail || 'Login failed' }
      }
      const data = await res.json()
      await chrome.storage.local.set({
        access_token: data.access_token,
        username: data.username,
        user_role: data.role,
        user_status: data.status,
      })
      return { ok: true, data }
    }

    case 'LOGOUT': {
      await chrome.storage.local.remove([
        'access_token',
        'username',
        'user_role',
        'user_status',
        'active_profile_id',
        'active_profile_name',
        'confirmed_profiles',
      ])
      return { ok: true, data: null }
    }

    case 'GET_PROFILES': {
      const res = await authFetch('/api/profiles?accessible_only=true')
      if (!res.ok) return { ok: false, error: 'Failed to load profiles' }
      const data = await res.json()
      return { ok: true, data }
    }

    case 'GENERATE': {
      const res = await authFetch('/api/generate', {
        method: 'POST',
        body: JSON.stringify(msg.payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Generation failed' }))
        return { ok: false, error: err.detail || 'Generation failed' }
      }
      const data = await res.json()
      return { ok: true, data }
    }

    case 'QUEUE_JOB': {
      const res = await authFetch('/api/queue', {
        method: 'POST',
        body: JSON.stringify(msg.payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Queue failed' }))
        return { ok: false, error: err.detail || 'Failed to add to queue' }
      }
      const data = await res.json()
      return { ok: true, data }
    }

    case 'CHECK_DUPLICATES': {
      const res = await authFetch('/api/queue/check-duplicates', {
        method: 'POST',
        body: JSON.stringify({
          profile_id: msg.profileId,
          company: msg.company,
          job_title: msg.jobTitle,
          job_urls: msg.jobUrls,
        }),
      })
      if (!res.ok) return { ok: false, error: 'Could not check for duplicates' }
      return { ok: true, data: await res.json() }
    }

    case 'AI_AUTOFILL': {
      const res = await authFetch('/api/ext/extract', {
        method: 'POST',
        body: JSON.stringify({ url: msg.url, text: msg.text }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Extraction failed' }))
        return { ok: false, error: err.detail || 'AI auto-fill failed' }
      }
      const data: ExtractedJobData = await res.json()
      return { ok: true, data }
    }

    case 'SET_CONFIRMED_PROFILES': {
      await chrome.storage.local.set({ confirmed_profiles: msg.profiles })
      return { ok: true, data: msg.profiles }
    }

    case 'GET_CONFIRMED_PROFILES': {
      const { confirmed_profiles } = await chrome.storage.local.get('confirmed_profiles')
      return { ok: true, data: (confirmed_profiles as Profile[]) || [] }
    }

    case 'SET_BASE_URL': {
      await chrome.storage.sync.set({ base_url: msg.url })
      return { ok: true, data: msg.url }
    }

    case 'GET_BASE_URL': {
      const url = await getBaseUrl()
      return { ok: true, data: url }
    }

    case 'FETCH_FILE': {
      const token = await getToken()
      const base = await getBaseUrl()
      const res = await fetch(`${base}${msg.url}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      await syncSession(res, token)
      if (!res.ok) return { ok: false, error: res.status === 401 ? 'Session expired. Please sign in again.' : 'Failed to fetch file' }

      const contentType = res.headers.get('content-type') || 'application/octet-stream'
      const filename = msg.url.split('/').pop() || 'download'
      const buffer = await res.arrayBuffer()

      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)

      const payload: FetchedFile = { base64, contentType, filename }
      return { ok: true, data: payload }
    }

    case 'GET_PROFILE_DETAILS': {
      const res = await authFetch(`/api/profiles/${msg.profileId}`)
      if (!res.ok) return { ok: false, error: 'Failed to load profile details' }
      const data = await res.json()
      const details: ProfileDetails = {
        name: data.name,
        location: data.location ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        linkedin: data.linkedin ?? null,
      }
      return { ok: true, data: details }
    }

    case 'DOWNLOAD_FILE': {
      const downloadId = await chrome.downloads.download({
        url: msg.dataUrl,
        filename: msg.filename,
        conflictAction: 'overwrite',
        saveAs: false,
      })
      return { ok: true, data: { downloadId } }
    }

    case 'CHAT': {
      const res = await authFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify(msg.payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Chat failed' }))
        return { ok: false, error: err.detail || 'Chat failed' }
      }
      const data: ChatResponse = await res.json()
      return { ok: true, data }
    }

    case 'SEARCH_APPLICATIONS': {
      // Only the profiles picked in the extension; none picked means nothing to list
      if (msg.profileIds.length === 0) return { ok: true, data: [] }
      const params = new URLSearchParams({ page_size: '10' })
      if (msg.query.trim()) params.set('search', msg.query.trim())
      for (const id of msg.profileIds) params.append('profile_id', id)
      const res = await authFetch(`/api/applications?${params}`)
      if (!res.ok) return { ok: false, error: 'Search failed' }
      const data = await res.json()
      return { ok: true, data: data.items }
    }

    case 'GET_APPLICATION': {
      const res = await authFetch(`/api/applications/${msg.appId}`)
      if (!res.ok) return { ok: false, error: 'Could not load application details' }
      return { ok: true, data: await res.json() }
    }

    case 'SET_APPLIED': {
      const res = await authFetch(`/api/applications/${msg.appId}/applied`, {
        method: 'PATCH',
        body: JSON.stringify({ applied: msg.applied }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Update failed' }))
        return { ok: false, error: err.detail || 'Could not update applied status' }
      }
      return { ok: true, data: await res.json() }
    }

    case 'DOWNLOAD_APP_FILES': {
      const [token, base] = await Promise.all([getToken(), getBaseUrl()])
      for (const file of msg.files) {
        const res = await fetch(`${base}${file.url}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        await syncSession(res, token)
        if (!res.ok) return { ok: false, error: res.status === 401 ? 'Session expired. Please sign in again.' : `Failed to fetch ${file.filename}` }
        const bytes = new Uint8Array(await res.arrayBuffer())
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
        const type = res.headers.get('content-type') || 'application/octet-stream'
        await chrome.downloads.download({
          url: `data:${type};base64,${btoa(binary)}`,
          filename: file.filename,
          conflictAction: 'overwrite',
          saveAs: false,
        })
      }
      return { ok: true, data: null }
    }

    case 'GET_APP_CHAT': {
      const res = await authFetch(`/api/applications/${msg.appId}/chat`)
      if (!res.ok) return { ok: false, error: 'Could not load the conversation' }
      const data = await res.json()
      return { ok: true, data: data.messages }
    }

    case 'APP_CHAT': {
      const res = await authFetch(`/api/applications/${msg.appId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ content: msg.content, model_config_id: null }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Chat failed' }))
        return { ok: false, error: err.detail || 'Chat failed' }
      }
      const data = await res.json()
      return { ok: true, data }
    }

    default:
      return { ok: false, error: 'Unknown message type' }
  }
}
