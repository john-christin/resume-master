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
  title: string;
  start_date: string;
  end_date?: string;
  description?: string;
}

export interface Certification {
  id?: string;
  name: string;
  issuer?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
}

export interface CustomSection {
  title: string;
  items: string[];
}

// ---------------------------------------------------------------------------
// Document style (v2) — mirrors backend/schemas/doc_style.py
// ---------------------------------------------------------------------------
export type UnderlineStyle = "none" | "single" | "double" | "dotted" | "dashed" | "thick" | "wavy";
export type BorderLineStyle =
  | "none" | "single" | "double" | "triple" | "dotted" | "dashed" | "dash_dot" | "thick" | "wave";
export type TextAlign = "left" | "center" | "right" | "justify";
export type SectionKey = "summary" | "skills" | "experience" | "education" | "certifications";

export interface TextStyle {
  font: string | null; // null → inherit fonts.family
  size: number | null; // pt; null → inherit
  bold: boolean;
  italic: boolean;
  underline: UnderlineStyle;
  strike: boolean;
  small_caps: boolean;
  all_caps: boolean;
  color: string | null; // hex without #; null → automatic
  highlight: string | null; // hex background behind the text
  letter_spacing: number; // pt
}

export interface BorderSide {
  style: BorderLineStyle;
  width: number; // pt, 0.25–6
  color: string; // hex without #
  space: number; // pt, 0–31
}

export interface Borders {
  top: BorderSide;
  left: BorderSide;
  bottom: BorderSide;
  right: BorderSide;
}

export interface ParagraphStyle {
  align: TextAlign;
  space_before: number; // pt
  space_after: number; // pt
  line_spacing_mode: "multiple" | "exact" | "at_least";
  line_spacing: number; // multiple, or pt for exact / at_least
  left_indent: number; // inches
  right_indent: number; // inches
  first_line_indent: number; // inches (negative = hanging)
  keep_with_next: boolean;
  keep_together: boolean;
  borders: Borders;
  shading: string | null; // hex background fill
}

export interface PageSettings {
  size: "letter" | "a4" | "legal";
  orientation: "portrait" | "landscape";
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  gutter: number;
  mirror_margins: boolean;
  header_distance: number;
  footer_distance: number;
  page_border: BorderSide;
}

export interface FontSettings {
  family: string;
  kerning: boolean;
  auto_hyphenation: boolean;
  widow_control: boolean;
}

export interface DocProperties {
  title: string | null;
  author: string | null;
  keywords: string | null;
  language: string | null;
}

export interface HeaderSettings {
  layout: "centered" | "left" | "right";
  name: TextStyle;
  name_uppercase: boolean;
  name_para: ParagraphStyle;
  contact: TextStyle;
  contact_separator: string;
  contact_para: ParagraphStyle;
  hyperlinks: boolean;
  link_color: string | null;
  link_underline: boolean;
}

export interface HeadingSettings {
  text: TextStyle;
  para: ParagraphStyle;
  titles: Record<SectionKey, string>;
}

export interface ListSettings {
  kind: "bullet" | "dash" | "none" | "numbered" | "lettered" | "custom";
  char: string;
  indent: number; // inches — text position
  hanging: number; // inches — marker hangs left of text
  color: string | null;
  para: ParagraphStyle;
}

export interface BodySettings {
  text: TextStyle;
  summary_para: ParagraphStyle;
  skills_para: ParagraphStyle;
  skills_category: TextStyle;
  skills_separator: string;
}

export interface EntrySettings {
  experience_layout: "employer-title" | "title-employer" | "combined";
  job_title: TextStyle;
  employer: TextStyle;
  combined_separator: string;
  education_layout: "degree-school" | "school-degree";
  degree: TextStyle;
  school: TextStyle;
  gpa: TextStyle;
  certification_layout: "name-issuer" | "inline";
  cert_name: TextStyle;
  cert_issuer: TextStyle;
  dates: TextStyle;
  date_format: "as_entered" | "mon_yyyy" | "month_yyyy" | "mm_yyyy" | "yyyy";
  date_separator: string;
  present_label: string;
  first_line_para: ParagraphStyle;
  second_line_para: ParagraphStyle;
  bullets: ListSettings;
}

export interface HeaderFooterSettings {
  header_text: string; // supports {name}
  footer_text: string; // supports {name}
  page_numbers: "none" | "number" | "page_of_total";
  page_number_position: "header" | "footer";
  text: TextStyle;
  para: ParagraphStyle;
  different_first_page: boolean;
}

export interface CoverLetterSettings {
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  letterhead: "left" | "centered" | "right" | "match_resume";
  name: TextStyle;
  name_uppercase: boolean;
  name_para: ParagraphStyle;
  contact: TextStyle;
  contact_separator: string;
  contact_para: ParagraphStyle;
  letterhead_border: BorderSide;
  include_date: boolean;
  date_format: "long" | "us" | "iso";
  date: TextStyle;
  date_para: ParagraphStyle;
  include_recipient: boolean;
  body: TextStyle;
  body_para: ParagraphStyle;
  header_footer: HeaderFooterSettings;
}

export interface SectionItem {
  key: SectionKey;
  visible: boolean;
}

export interface StyleConfig {
  version: 2;
  page: PageSettings;
  fonts: FontSettings;
  properties: DocProperties;
  header: HeaderSettings;
  headings: HeadingSettings;
  body: BodySettings;
  entries: EntrySettings;
  header_footer: HeaderFooterSettings;
  sections: SectionItem[];
  cover_letter: CoverLetterSettings;
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
  creativity_factor?: number;
  custom_prompt?: string | null;
  doc_style_id?: string | null;
  show_skills: boolean;
  use_global_kb: boolean;
  check_clearance: boolean;
  security_clearance?: string | null;
  job_sheet_url?: string | null;
  educations: Education[];
  experiences: Experience[];
  certifications: Certification[];
  custom_sections: CustomSection[];
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
  creativity_factor?: number;
  custom_prompt?: string | null;
  doc_style_id?: string | null;
  show_skills?: boolean;
  use_global_kb?: boolean;
  check_clearance?: boolean;
  security_clearance?: string | null;
  job_sheet_url?: string | null;
  educations: Education[];
  experiences: Experience[];
  certifications?: Certification[];
  custom_sections?: CustomSection[];
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
  call_scheduled?: boolean;
  applied?: boolean;
  applied_at?: string | null;
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

export interface UsageBreakdownItem {
  part: string;
  role: string;
  provider: string;
  model_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}

export interface ApplicationDetail extends ApplicationSummary {
  job_description: string;
  tailored_bullets?: string;
  cover_letter_text?: string;
  salary_range?: string | null;
  required_skills?: string[];
  usage_breakdown?: UsageBreakdownItem[];
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
  created_at: string;
  updated_at?: string;
}

export interface ModelUsageStat {
  role: string;
  provider: string;
  model_id: string;
  display_name: string | null;
  call_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}

export interface ActiveModel {
  id: string;
  display_name: string;
  provider: string;
  model_id: string;
}

export interface RoleAssignment {
  role: string; // "resume" | "cover_letter" | "jd_parse" | "chat" | "utility"
  ai_model_config_id: string | null;
  display_name: string | null;
  provider: string | null;
  model_id: string | null;
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

export interface JobSheetStatus {
  sheet_url: string | null;
  configured: boolean;
  service_account_email: string | null;
  pending: number;
  failed: number;
  last_error: string | null;
}

export interface JobSheetCheck {
  tab: string;
  header_row: number;
  filled_rows: number;
  next_row: number;
  missing_columns: string[];
}
