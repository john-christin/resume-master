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

export interface ApplicationHit {
  id: string
  job_title: string
  company: string | null
  profile_name: string | null
  job_url: string | null
  resume_path: string | null
  cover_letter_path: string | null
  applied: boolean
  applied_at: string | null
  created_at: string
}

export interface ApplicationExtra {
  location: string | null
  salary_range: string | null
  resume_type: string | null
  required_skills: string[]
  call_stage: string | null
  call_status: string | null
  call_scheduled_at: string | null
}

export interface AppChatReply {
  message: { role: 'user' | 'assistant'; content: string }
}

export interface QueueJobPayload {
  profile_id: string
  job_url?: string
  job_source_url?: string
  posted_text?: string
  company?: string
  job_title?: string
  job_description?: string
  doc_style_id?: string
  allow_duplicate?: boolean
}

export interface DuplicateCheck {
  applications: {
    id: string
    company: string | null
    job_title: string
    applied: boolean
    applied_at: string | null
    created_at: string
  }[]
  queued: { id: string; company: string | null; job_title: string | null; status: string }[]
}

export interface ExtractedJobData {
  job_title?: string
  company?: string
  job_description?: string
  posted?: string
}

// Messages sent from content script / popup → service worker
export type MessageToSW =
  | { type: 'LOGIN'; username: string; password: string }
  | { type: 'LOGOUT' }
  | { type: 'GET_PROFILES' }
  | { type: 'GENERATE'; payload: GenerateRequest }
  | { type: 'QUEUE_JOB'; payload: QueueJobPayload }
  | { type: 'CHECK_DUPLICATES'; profileId: string; company?: string; jobTitle?: string; jobUrls: string[] }
  | { type: 'AI_AUTOFILL'; url: string; text: string }
  | { type: 'SET_CONFIRMED_PROFILES'; profiles: Profile[] }
  | { type: 'GET_CONFIRMED_PROFILES' }
  | { type: 'SET_BASE_URL'; url: string }
  | { type: 'GET_BASE_URL' }
  | { type: 'FETCH_FILE'; url: string }
  | { type: 'GET_PROFILE_DETAILS'; profileId: string }
  | { type: 'DOWNLOAD_FILE'; filename: string; dataUrl: string }
  | { type: 'CHAT'; payload: ChatRequest }
  | { type: 'SEARCH_APPLICATIONS'; query: string; profileIds: string[] }
  | { type: 'GET_APPLICATION'; appId: string }
  | { type: 'SET_APPLIED'; appId: string; applied: boolean }
  | { type: 'DOWNLOAD_APP_FILES'; files: { url: string; filename: string }[] }
  | { type: 'GET_APP_CHAT'; appId: string }
  | { type: 'APP_CHAT'; appId: string; content: string }

export type SWResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }
