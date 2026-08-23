/**
 * TypeScript mirrors of the FastAPI response models in `app/schemas/`.
 * Keep these in sync with the backend — they are the contract, not a guess.
 */

/* ── Auth & users ─────────────────────────────────────────────────────── */

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_verified: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface GenericMessageResponse {
  message: string;
}

export interface VerifyOTPResponse {
  reset_token: string;
  token_type: string;
}

/* ── Organizations ────────────────────────────────────────────────────── */

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export const ORGANIZATION_ROLES = ["OWNER", "ADMIN", "MEMBER", "SUPPORT"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

/** `GET /organizations/{id}/members` */
export interface OrganizationMember {
  id: string;
  full_name: string;
  email: string;
  role: OrganizationRole;
}

/** `POST`/`PATCH` on members returns the membership row, not the profile. */
export interface Membership {
  user_id: string;
  organization_id: string;
  role: OrganizationRole;
}

export interface OrganizationSettings {
  id: string;
  organization_id: string;
  company_logo_url: string | null;
  primary_color: string;
  widget_title: string;
  system_prompt_override: string | null;
  temperature: number;
  support_email: string | null;
  auto_create_ticket_on_escalation: boolean;
}

export interface OrganizationSettingsUpdate {
  company_logo_url?: string;
  primary_color?: string;
  widget_title?: string;
  system_prompt_override?: string;
  temperature?: number;
  support_email?: string;
  auto_create_ticket_on_escalation?: boolean;
}

/* ── Knowledge bases & documents ──────────────────────────────────────── */

export interface KnowledgeBase {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
}

export interface KnowledgeBaseListItem {
  id: string;
  name: string;
  description: string | null;
}

export const DOCUMENT_STATUSES = ["UPLOADING", "PROCESSING", "READY", "FAILED"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export interface DocumentDetail {
  id: string;
  knowledge_base_id: string;
  original_filename: string;
  storage_key: string;
  mime_type: string;
  size: number;
  status: DocumentStatus;
}

export interface DocumentListItem {
  id: string;
  original_filename: string;
  status: DocumentStatus;
}

export interface DocumentChunk {
  id: string;
  chunk_index: number;
  content: string;
  token_count: number;
}

export interface KnowledgeSearchResult {
  score: number;
  document_name: string;
  chunk_index: number;
  snippet: string;
}

/* ── Conversations & messages ─────────────────────────────────────────── */

export const MESSAGE_ROLES = ["USER", "ASSISTANT", "SUPPORT", "SYSTEM"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  citations: { document_id?: string; filename?: string; chunk_index?: number }[] | null;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  updated_at: string;
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  messages: Message[];
}

/* ── Tickets ──────────────────────────────────────────────────────────── */

export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_CUSTOMER",
  "RESOLVED",
  "CLOSED",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export interface Ticket {
  id: string;
  conversation_id: string;
  organization_id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_by_ai: boolean;
  created_at: string;
  updated_at: string;
  assigned_to_user_id: string | null;
  /** Computed server-side: "3 hrs left" | "Breached" | "Resolved". */
  sla_deadline: string;
}

export interface CursorPage<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
}

export const TICKET_EVENT_TYPES = [
  "CREATED",
  "ASSIGNED",
  "STATUS_CHANGED",
  "PRIORITY_CHANGED",
  "REPLIED",
  "NOTE_ADDED",
  "CLOSED",
] as const;
export type TicketEventType = (typeof TICKET_EVENT_TYPES)[number];

export interface TicketEvent {
  id: string;
  event_type: TicketEventType;
  description: string;
  user_id: string | null;
  created_at: string;
}

export interface TicketNote {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  author_name: string;
}

/* ── Developer surface ────────────────────────────────────────────────── */

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ApiKeyCreated {
  id: string;
  name: string;
  key_prefix: string;
  /** Returned exactly once, at creation. Never persisted client-side. */
  secret_key: string;
  created_at: string;
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  subscribed_events: string[];
  is_active: boolean;
  consecutive_failures: number;
  created_at: string;
}

export interface WebhookEndpointCreated extends Omit<WebhookEndpoint, "consecutive_failures"> {
  secret: string;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status_code: number | null;
  response_body: string | null;
  duration_ms: number | null;
  is_success: boolean;
  attempt_number: number;
  created_at: string;
}

export interface WebhookTestResult {
  success: boolean;
  status_code: number | null;
  response_body: string | null;
  duration_ms: number | null;
  message: string;
}

export const WEBHOOK_EVENTS = [
  "ticket.created",
  "ticket.updated",
  "ticket.assigned",
  "ticket.resolved",
  "conversation.created",
  "message.created",
  "feedback.submitted",
  "*",
] as const;

/* ── Billing & usage ──────────────────────────────────────────────────── */

export type PlanTier = "FREE" | "PRO" | "ENTERPRISE";
export type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIALING";

export interface PlanLimits {
  max_ai_responses_per_month: number;
  max_knowledge_bases: number;
  max_documents_per_kb: number;
  max_members: number;
  max_storage_bytes: number;
  allows_api_keys: boolean;
  allows_webhooks: boolean;
  allows_custom_branding: boolean;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_tier: PlanTier;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  limits: PlanLimits;
  /** A Stripe customer exists for this org — the billing portal can be opened. */
  has_billing_account: boolean;
  /** Stripe is already billing a subscription — plan changes belong in the portal. */
  has_stripe_subscription: boolean;
}

export interface UsageMetric {
  used: number;
  limit: number | null;
}

export interface UsageSummary {
  period_start: string;
  period_end: string;
  ai_responses: UsageMetric;
  ai_tokens: UsageMetric;
  storage_bytes: UsageMetric;
  conversations: UsageMetric;
}

/* ── Chat ─────────────────────────────────────────────────────────────── */

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  answer: string;
  citations: { document_id: string; filename: string; chunk_index: number }[];
}
