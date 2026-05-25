import type { ChatResponse, FetchedFile, MessageToSW, ProfileDetails, SWResponse } from '../shared/types'

const API_BASE = 'https://aurexviper.pro'

async function getToken(): Promise<string | null> {
  const { access_token } = await chrome.storage.local.get('access_token')
  return (access_token as string) || null
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken()
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  })
}

chrome.runtime.onMessage.addListener(
  (msg: MessageToSW, _sender, sendResponse) => {
    handle(msg)
      .then(sendResponse)
      .catch((e: Error) => sendResponse({ ok: false, error: e.message }))
    return true // keep channel open for async
  },
)

async function handle(msg: MessageToSW): Promise<SWResponse> {
  switch (msg.type) {
    case 'LOGIN': {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
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
      ])
      return { ok: true, data: null }
    }

    case 'GET_PROFILES': {
      // accessible_only=true ensures admins only see their own+shared profiles, not all users'
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

    case 'FETCH_FILE': {
      const token = await getToken()
      const res = await fetch(`${API_BASE}${msg.url}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) return { ok: false, error: 'Failed to fetch file' }

      const contentType =
        res.headers.get('content-type') || 'application/octet-stream'
      const filename = msg.url.split('/').pop() || 'download'
      const buffer = await res.arrayBuffer()

      // Convert to base64 for message passing (ArrayBuffer is not serializable)
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

    default:
      return { ok: false, error: 'Unknown message type' }
  }
}
