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

export interface TechStack {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SectionItem {
  key: string;
  visible: boolean;
}

export interface StyleConfig {
  font_name: string;
  font_size_name: number;
  font_size_section: number;
  font_size_body: number;
  font_size_contact: number;
  header_layout: "centered" | "left";
  accent_color: string;
  section_separator: "line" | "thick_line" | "double_line" | "none";
  name_bold: boolean;
  name_uppercase: boolean;
  section_caps: boolean;
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  space_before_section: number;
  space_after_section: number;
  name_color: string;
  line_spacing: number;
  section_bold: boolean;
  bullet_char: string;
  contact_separator: string;

  // Section ordering + visibility
  sections: SectionItem[];

  // Section heading visual style
  section_heading_style: "plain" | "underline" | "line_below" | "thick_line_below" | "double_line_below" | "boxed" | "bar";

  // Spacing
  space_between_entries: number;

  // Entry layout
  entry_title_size: number;
  entry_subtitle_size: number;
  entry_subtitle_style: "normal" | "bold" | "italic" | "bold_italic";
  entry_list_style: "bullet" | "dash" | "none";
  entry_indent_body: boolean;

  // Per-element colors
  color_heading: string;
  color_heading_line: string;
  color_job_title: string;
  color_employer: string;
  color_dates: string;
  color_subtitle: string;
  color_contact: string;

  // Name extended
  name_italic: boolean;
  name_letter_spacing: number;

  // Experience layout
  experience_layout: "employer-title" | "title-employer" | "combined";

  // Education layout
  education_layout: "degree-school" | "school-degree";
}

export interface DocStyle {
  id: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  config: StyleConfig;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface DocStyleCreate {
  name: string;
  description?: string | null;
  config: StyleConfig;
}

export interface DocStyleUpdate {
  name?: string;
  description?: string | null;
  config?: StyleConfig;
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
  tech_stack_id?: string | null;
  creativity_factor?: number;
  custom_prompt?: string | null;
  doc_style_id?: string | null;
  show_skills: boolean;
  check_clearance: boolean;
  security_clearance?: string | null;
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
  tech_stack_id?: string | null;
  creativity_factor?: number;
  custom_prompt?: string | null;
  doc_style_id?: string | null;
  show_skills?: boolean;
  check_clearance?: boolean;
  security_clearance?: string | null;
  educations: Education[];
  experiences: Experience[];
}

export interface ClearanceCheckResponse {
  allowed: boolean;
  reason?: string | null;
  detected_clearance?: string | null;
}

export interface BannedCompany {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

export interface BannedCompanyMatch {
  company: string;
  banned_name: string;
  description?: string | null;
}

export interface BannedCompanyCheckResponse {
  matches: BannedCompanyMatch[];
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
  company?: string;
  job_url?: string;
  job_description: string;
  resume_type?: string;
  skip_duplicate_check?: boolean;
}

export interface JobDescriptionEntry {
  job_title: string;
  company?: string;
  job_url?: string;
  job_description: string;
  resume_type?: string;
  skip_duplicate_check?: boolean;
}

export interface ExistingApplicationInfo {
  id: string;
  job_title: string;
  company: string;
  created_at: string;
}

export interface CompanyMatch {
  company: string;
  existing_applications: ExistingApplicationInfo[];
}

export interface CompanyCheckResponse {
  matches: CompanyMatch[];
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
  profile_name?: string;
  job_title: string;
  company?: string;
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
  tech_stack_name?: string | null;
  call_scheduled?: boolean;
  call_id?: string;
  call_stage?: string | null;
  call_status?: string | null;
  call_scheduled_at?: string | null;
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
  salary_range?: string | null;
  required_skills?: string[];
  profile_email?: string | null;
  profile_phone?: string | null;
  profile_location?: string | null;
  profile_linkedin?: string | null;
  profile_university?: string | null;
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
  tech_stack_id?: string | null;
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

export interface ActiveModel {
  id: string;
  display_name: string;
  provider: string;
  model_id: string;
  role: string | null;
}

export interface AppChatMessage {
  id: string;
  application_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface AppChatHistory {
  messages: AppChatMessage[];
}

export interface AppChatSendResponse {
  message: AppChatMessage;
  prompt_tokens: number;
  completion_tokens: number;
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

export interface BatchJobError {
  index: number;
  job_title: string;
  error: string;
}

export interface BatchJobSubmitResponse {
  job_id: string;
  status: string;
  total_jobs: number;
}

// Stage is now dynamic — fetched from /api/call-stages
export type CallStage = string;
export type CallStatus = "scheduled" | "pending" | "passed" | "failed" | "cancelled";
export type CallType = "video" | "phone";

export interface CallStageConfig {
  id: string;
  name: string;
  value: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface Call {
  id: string;
  application_id: string;
  stage: CallStage;
  status: CallStatus;
  scheduled_at?: string | null;
  recording_link?: string | null;
  with_whom?: string | null;
  interviewer_role?: string | null;
  call_type?: CallType | null;
  call_link?: string | null;
  additional_note?: string | null;
  stage_statuses?: Record<string, {
    status?: CallStatus;
    scheduled_at?: string | null;
    recording_link?: string | null;
    with_whom?: string | null;
    interviewer_role?: string | null;
    call_type?: CallType | null;
    call_link?: string | null;
    additional_note?: string | null;
  }>;
  is_closed?: boolean;
  created_at: string;
  updated_at: string;
  job_title?: string | null;
  company?: string | null;
  profile_name?: string | null;
  user_username?: string | null;
}

export interface CallCreate {
  application_id: string;
  stage: string;
  status?: CallStatus;
  scheduled_at?: string | null;
  recording_link?: string | null;
  with_whom?: string | null;
  interviewer_role?: string | null;
  call_type?: CallType | null;
  call_link?: string | null;
  additional_note?: string | null;
}

export interface CallUpdate {
  stage?: string;
  status?: CallStatus;
  scheduled_at?: string | null;
  recording_link?: string | null;
  with_whom?: string | null;
  interviewer_role?: string | null;
  call_type?: CallType | null;
  call_link?: string | null;
  additional_note?: string | null;
  is_closed?: boolean;
}

export const CALL_STATUSES: { value: CallStatus; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "pending", label: "Pending" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

export interface BatchJobStatus {
  id: string;
  status: "pending" | "running" | "completed" | "partial" | "failed";
  profile_name: string | null;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  total_cost: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  error_details: BatchJobError[];
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}
