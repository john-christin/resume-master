export interface StoredUser {
  id: string
  username: string
  role: string
  status: string
}

export interface Profile {
  id: string
  name: string
}

export interface GenerateRequest {
  profile_id: string
  job_title: string
  company?: string
  job_url?: string
  job_description: string
}

export interface GenerateResult {
  application_id: string
  profile_name?: string
  job_title: string
  company?: string
  resume_url: string
  cover_letter_url: string
  cost: number
}

export interface FetchedFile {
  base64: string
  contentType: string
  filename: string
}

export interface ProfileDetails {
  name: string
  location: string | null
  phone: string | null
  email: string | null
  linkedin: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  profile_id: string
  job_title?: string
  company?: string
  job_description?: string
  messages: ChatMessage[]
}

export interface ChatResponse {
  message: string
  prompt_tokens: number
  completion_tokens: number
}

// Messages sent from content script / popup → service worker
export type MessageToSW =
  | { type: 'LOGIN'; username: string; password: string }
  | { type: 'LOGOUT' }
  | { type: 'GET_PROFILES' }
  | { type: 'GENERATE'; payload: GenerateRequest }
  | { type: 'FETCH_FILE'; url: string }
  | { type: 'GET_PROFILE_DETAILS'; profileId: string }
  | { type: 'DOWNLOAD_FILE'; filename: string; dataUrl: string }
  | { type: 'CHAT'; payload: ChatRequest }

export type SWResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }
