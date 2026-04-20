export interface Education {
  id?: string;
  school: string;
  degree: string;
  field: string;
  gpa?: string;
  start_date: string;
  end_date?: string;
}

export interface Experience {
  id?: string;
  company: string;
  location?: string;
  title: string;
  description: string;
  start_date: string;
  end_date?: string;
}

export interface Profile {
  id: string;
  owner_id: string;
  name: string;
  location?: string;
  phone?: string;
  email?: string;
  linkedin?: string;
  summary?: string;
  educations: Education[];
  experiences: Experience[];
  is_owner: boolean;
  is_shared: boolean;
  owner_username?: string;
  created_at: string;
  updated_at?: string;
}

export interface ProfileCreate {
  name: string;
  location?: string;
  phone?: string;
  email?: string;
  linkedin?: string;
  summary?: string;
  educations: Education[];
  experiences: Experience[];
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  username: string;
  role: "admin" | "bidder" | "caller";
  status: "pending" | "approved" | "rejected";
  profile_count: number;
}

export interface GenerateRequest {
  profile_id: string;
  job_title: string;
  job_url?: string;
  job_description: string;
  resume_type?: string;
  skip_duplicate_check?: boolean;
}

export interface JobDescriptionEntry {
  job_title: string;
  job_url?: string;
  job_description: string;
  resume_type?: string;
  skip_duplicate_check?: boolean;
}

export interface DuplicateInfo {
  duplicate: boolean;
  similarity: number;
  existing_application: {
    id: string;
    job_title: string;
    company: string;
    created_at: string;
  };
}

export interface BatchGenerateRequest {
  profile_id: string;
  jobs: JobDescriptionEntry[];
}

export interface TailoredExperience {
  company: string;
  location?: string;
  title: string;
  start_date: string;
  end_date?: string;
  bullets: string[];
}

export interface SkillCategory {
  category: string;
  skills: string[];
}

export interface GeneratePreview {
  summary: string;
  skills: SkillCategory[];
  tailored_experiences: TailoredExperience[];
  cover_letter: string;
}

export interface GenerateResponse {
  application_id: string;
  preview: GeneratePreview;
  resume_url: string;
  cover_letter_url: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}

export interface BatchGenerateResponse {
  results: GenerateResponse[];
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_cost: number;
}

export interface ApplicationSummary {
  id: string;
  job_title: string;
  company?: string;
  job_url?: string;
  resume_type?: string;
  resume_path?: string;
  cover_letter_path?: string;
  profile_name?: string;
  location?: string;
  user_username?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_cost?: number;
  created_at: string;
}

export interface ApplicationDetail extends ApplicationSummary {
  job_description: string;
  tailored_bullets?: string;
  cover_letter_text?: string;
}

export interface PaginatedApplications {
  items: ApplicationSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface UserListItem {
  id: string;
  username: string;
  role: string;
  status: string;
  profile_count: number;
  application_count: number;
  total_cost: number;
  created_at: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface TokenPricing {
  id: string;
  input_price_per_1k: number;
  output_price_per_1k: number;
  effective_from: string;
}

export interface AIModelConfig {
  id: string;
  provider: string;
  display_name: string;
  model_id: string;
  api_key_set: boolean;
  endpoint?: string;
  api_version?: string;
  input_price_per_1k: number;
  output_price_per_1k: number;
  is_active: boolean;
  role?: string | null; // "primary" | "utility" | null
  created_at: string;
  updated_at?: string;
}

export interface ProfileShareUser {
  user_id: string;
  username: string;
  shared_at?: string;
}

export interface UserSearchResult {
  id: string;
  username: string;
}
