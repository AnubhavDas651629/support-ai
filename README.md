# Support-AI

**AI that actually resolves support tickets — and knows exactly when to hand off to a human.**

Every support team faces the same tradeoff: chatbots that hallucinate answers and infuriate customers, or human queues that don't scale. Support-AI is a multi-tenant platform that answers customer questions from a company's own knowledge base (RAG, cited sources), and — instead of guessing when it's wrong — runs every single turn through a dedicated escalation model that decides whether to answer or open a ticket for a human. No prompt-tuning gamble, no silent failures: it's a structured decision, logged and auditable, every time.

Built for teams shipping AI support *now*, not a research demo: multi-tenant isolation, Stripe-metered usage limits, HMAC-signed outbound webhooks, and prompt-injection guardrails are in the codebase today, not on a roadmap.

[![CI](https://github.com/AnubhavDas651629/support-ai/actions/workflows/deploy.yml/badge.svg)](https://github.com/AnubhavDas651629/support-ai/actions/workflows/deploy.yml)
![Python](https://img.shields.io/badge/python-3.12-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-async-009688)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)

---

## Demo

<!-- TODO: drop in a GIF or screenshots here — e.g. docs/screenshots/dashboard.png, docs/screenshots/widget.png -->
<!-- Suggested shots: (1) the embeddable widget answering a question with citations, (2) the escalated-tickets queue, (3) the AI Assistant Studio's live test drawer -->

> Screenshots/GIF coming — run `docker compose up --build` and open `http://localhost:3000` for the dashboard or `app/static/demo.html` for the embeddable widget.

---

## What Makes This Different

Most "AI support" projects are a thin prompt wrapped around an LLM call. Support-AI is built like production infrastructure from day one:

- **Escalation is a structured decision, not a vibe** — every chat turn is scored by a dedicated `EscalationDecision` model (Pydantic-bounded structured output, not free-text parsing). If it escalates, the AI's draft answer is discarded outright in favor of a ticket — no half-answered, half-escalated responses.
- **Specialist routing** — a lightweight router classifies each turn (`BILLING` / `TECHNICAL` / `GENERAL`) before generation, so answers come from the right persona instead of one generic system prompt trying to do everything.
- **Multi-tenant from the schema up** — every table, query, and service call is scoped to `organization_id`, enforced twice (repository + service layer), not bolted on with a middleware filter.
- **Usage is metered like a real SaaS product** — AI responses, tokens, documents, storage, and seats are all checked against `FREE`/`PRO`/`ENTERPRISE` plan limits before an operation runs, wired straight into Stripe Checkout and webhooks.
- **Security isn't an afterthought** — hardcoded prompt-injection directives on every system prompt, Fernet-encrypted webhook secrets, SHA-256 hashed API keys, Redis-backed rate limiting on every public surface.
- **Observability is wired in, not planned** — Prometheus metrics, Jaeger tracing, Sentry error capture, and correlation IDs across the whole request lifecycle, from commit one.

## Roadmap

- [ ] Multi-channel ingestion — Slack, email, and Zendesk/Intercom ticket import into the same knowledge base
- [ ] Fine-grained analytics — deflection rate, escalation reasons, and CSAT correlated to AI answers
- [ ] Multi-LLM support — provider abstraction already exists (`app/processing/llms/`); add Anthropic/local model backends
- [ ] Voice/phone support channel
- [ ] SOC 2 readiness track for enterprise customers

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Core Functional Pipelines](#2-core-functional-pipelines)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Structured Outputs & LLM Engine](#4-structured-outputs--llm-engine)
5. [Async Task Queue: Celery + RabbitMQ](#5-async-task-queue-celery--rabbitmq)
6. [Plan Tiers, Usage Metering & Feature Gating](#6-plan-tiers-usage-metering--feature-gating)
7. [Entity Relationship & Domain Data Model](#7-entity-relationship--domain-data-model)
8. [Reliability, Security & Guardrails](#8-reliability-security--guardrails)
9. [Observability](#9-observability)
10. [Exception Handling & Error Governance](#10-exception-handling--error-governance)
11. [Testing & Load Testing](#11-testing--load-testing)
12. [CI/CD & Deployment](#12-cicd--deployment)
13. [Frontend Dashboard](#13-frontend-dashboard)
14. [Project Directory Structure](#14-project-directory-structure)
15. [Setup & Local Development](#15-setup--local-development)

*Sections below are the full engineering deep-dive — diagrams, schemas, and exception tables — for anyone doing technical due diligence.*

---

## 1. System Architecture

The application follows a strict **layered architecture**: routers never touch ORM models or raw SQL — they call services, which call repositories for data access.

<details>
<summary>Full system diagram</summary>

```mermaid
graph TD
    Widget[Embeddable JS Widget] --> WidgetAPI[Widget Router - Public, API Key auth]
    Client[Next.js Dashboard] --> Router[FastAPI API Layer v1]
    Router --> Auth[Auth Middleware - JWT / API Key]
    Auth --> Service[Service Layer - Business Logic]

    subgraph Core Services
        Service --> ChatSvc[ChatService]
        Service --> EscSvc[EscalationService]
        Service --> RetSvc[RetrievalService]
        Service --> DocSvc[DocumentService]
        Service --> TktSvc[TicketService]
        Service --> WebhookSvc[WebhookService]
        Service --> SubSvc[SubscriptionService]
        Service --> UsageSvc[UsageService]
        Service --> AuthSvc[AuthService]
        Service --> OrgSvc[OrganizationService]
    end

    subgraph Agentic Layer
        ChatSvc --> AgentRouter[AgentRouter - classify BILLING/TECHNICAL/GENERAL]
        AgentRouter --> Specialists[Specialist system prompts]
        ChatSvc -. "len(history) >= 10" .-> MemTask[compress_conversation_memory_task]
    end

    Service --> Repo[Repository Layer - Data Access]
    Repo --> ORM[SQLAlchemy 2.0 ORM Models]
    ORM --> DB[(PostgreSQL + pgvector)]

    subgraph Async Task Queue - RabbitMQ Broker
        Service --> Celery[Celery Workers]
        Celery --> EmailQ[emails queue - ticket & org-invite emails]
        Celery --> WebhookQ[webhooks queue - outbound dispatch]
        Celery --> HighQ[high_priority queue - OTP emails]
        Celery --> BgQ[background_tasks queue - memory compression]
        Celery --> Beat[Celery Beat - hourly session cleanup]
    end

    subgraph Caching
        Service --> Redis[Redis - rate limiting, OTP cache, sessions]
    end

    subgraph External Integrations
        ChatSvc --> LLMFac[LLMFactory / OpenAIProvider]
        AgentRouter --> LLMFac
        EscSvc --> LLMFac
        LLMFac --> OpenAI[OpenAI API - gpt-4.1-mini & text-embedding-3-small]
        AuthSvc --> GoogleOAuth[Google OAuth - ID token verification]
        SubSvc --> Stripe[Stripe API - Billing & Webhooks]
        WebhookSvc --> OutboundHTTP[Outbound HTTP - Customer Endpoints]
    end
```

</details>

### Architectural Highlights
- **Strict layered boundary**: API routes (`app/api/v1/`) never interact directly with ORM models or raw SQL. Controllers only call service methods and map internal DTOs to Pydantic API response schemas.
- **DTO vs. API schema decoupling**: internal structs (`EscalationResult`, `ChatResult`, `Citation`, `EscalationDecision`) are kept distinct from presentation schemas.
- **Explicit transaction management**: repositories `flush()` to the active transaction; services own the `commit()` boundary across multi-repository operations.
- **Asynchronous eager loading**: relationship loading is always declared explicitly (`selectinload`) in repository queries to avoid async lazy-loading `MissingGreenlet` errors.
- **Multi-tenant isolation**: every resource (knowledge bases, conversations, tickets, webhooks, API keys) is scoped to an `organization_id`, enforced at both the query and service layer.
- **Usage & tier enforcement**: AI responses, AI token consumption, documents, knowledge bases, members, and storage are all metered against plan quotas (`PlanTier.FREE` / `PRO` / `ENTERPRISE`) by `UsageService` before an operation proceeds.

---

## 2. Core Functional Pipelines

### A. Document Ingestion & Vector Processing

```mermaid
sequenceDiagram
    participant Client
    participant Router as DocumentRouter
    participant Service as DocumentService
    participant Repo as DocumentRepository
    participant Processor as DocumentProcessor
    participant DB as PostgreSQL (pgvector)

    Client->>Router: POST /api/v1/documents (File Upload)
    Router->>Service: upload_document(knowledge_base_id, file)
    Service->>Repo: create(document_row)
    Repo->>DB: INSERT INTO documents (status: PROCESSING)
    Service->>Processor: BackgroundTask(process_document, document_id)
    Router-->>Client: 202 Accepted (Document Row)

    Note over Processor,DB: Asynchronous Background Execution
    Processor->>Repo: get_by_id(document_id)
    Processor->>Processor: ParserFactory.parse(file_path) [pdf / markdown / txt]
    Processor->>Processor: TextChunker.chunk(text, chunk_size, overlap)
    Processor->>OpenAI: EmbeddingFactory -> generate embeddings (text-embedding-3-small)
    Processor->>DB: Batch INSERT INTO document_chunks (embedding vector)
    Processor->>DB: UPDATE documents SET status = READY | FAILED
```

### B. Conversational RAG, Agent Routing & Automated Escalation

Every chat turn is classified by a lightweight routing agent *before* the answer is generated, and every turn is still checked for escalation. Escalation takes priority: if the escalation decision is `ESCALATE`, the specialist-routed answer is discarded in favor of the canned handoff response and a ticket is opened.

```mermaid
sequenceDiagram
    participant User
    participant ChatAPI as ChatController
    participant ChatSvc as ChatService
    participant RetSvc as RetrievalService
    participant AgentRouter as AgentRouter
    participant EscSvc as EscalationService
    participant LLM as OpenAIProvider
    participant TktSvc as TicketService
    participant WebhookSvc as WebhookService
    participant DB as PostgreSQL

    User->>ChatAPI: POST /api/v1/chat
    ChatAPI->>ChatSvc: answer(conversation_id, question)
    ChatSvc->>UsageSvc: check_and_increment (AI response + token quota)
    ChatSvc->>DB: INSERT Message (role: USER)
    ChatSvc->>RetSvc: retrieve(knowledge_base_id, question)
    RetSvc->>DB: Cosine similarity search via pgvector (top-K chunks, [] if no KB attached)
    ChatSvc->>AgentRouter: route_conversation(question)
    AgentRouter->>LLM: complete_structured(RouterResponse)
    LLM-->>AgentRouter: route = BILLING | TECHNICAL | GENERAL
    ChatSvc->>ChatSvc: get_specialized_system_prompt(route) + prompt-injection directive
    ChatSvc->>EscSvc: process(conversation, history, chunks, question)
    EscSvc->>LLM: complete_structured(EscalationDecision)
    LLM-->>EscSvc: EscalationDecision(action, answer, reason)

    alt Action == ANSWER
        ChatSvc->>LLM: complete/stream(specialist-routed messages)
        LLM-->>ChatSvc: answer text + prompt/completion token counts
    else Action == ESCALATE
        EscSvc->>TktSvc: create_ticket(conversation_id)
        TktSvc->>DB: INSERT INTO tickets (status: OPEN)
        TktSvc->>WebhookSvc: dispatch(ticket.created event)
    end

    ChatSvc->>UsageSvc: record_ai_response(prompt_tokens, completion_tokens)
    ChatSvc->>DB: INSERT Message (role: ASSISTANT, citations)
    opt len(history) >= 10
        ChatSvc->>Celery: compress_conversation_memory_task.delay(conversation_id)
    end
    ChatSvc->>LLM: _generate_title(question, answer)
    ChatSvc->>DB: UPDATE conversations SET title
    ChatAPI-->>User: ChatResponse(answer, citations, message_id) [or SSE stream]
```

**Specialist personas** (`app/agents/specialists.py`) share a base prompt (Markdown formatting, "don't fabricate", anti-prompt-injection directive) and each add a role block:
- **BILLING** — empathetic refunds/subscription specialist; declines technical questions.
- **TECHNICAL** — direct, analytical bug/error engineer; asks for logs/reproduction steps; declines pricing questions.
- **GENERAL** (default/fallback) — friendly generalist; defers complex billing/technical questions to the right specialist.

### C. Conversation Memory Compression

Long conversations get expensive to resend to the LLM in full on every turn. Once a conversation crosses 10 messages, `ChatService` fires a non-blocking Celery task rather than compressing inline:

```mermaid
sequenceDiagram
    participant ChatSvc as ChatService
    participant Celery as compress_conversation_memory_task (background_tasks queue)
    participant Compressor as MemoryCompressor
    participant LLM as OpenAIProvider
    participant DB as PostgreSQL

    ChatSvc->>Celery: .delay(conversation_id)   Note: fire-and-forget, doesn't block the reply
    Celery->>Compressor: compress_conversation(conversation_id)
    Compressor->>DB: fetch oldest 10 messages
    Compressor->>LLM: complete() -> 2-sentence summary
    Compressor->>DB: DELETE those 10 Message rows
    Compressor->>DB: INSERT Message(role=SYSTEM, content="[COMPRESSED HISTORY]: ...")
```

### D. Outbound Webhook Dispatch

Platform events (e.g. `ticket.created`, `ticket.resolved`) are dispatched asynchronously with HMAC-SHA256 signing and full delivery tracking. The signing secret itself is **Fernet-encrypted (AES-128-CBC + HMAC-SHA256)** at rest in `webhook_endpoints.secret_encrypted` — the plaintext secret is shown to the customer once at creation and decrypted server-side only at dispatch time.

```mermaid
sequenceDiagram
    participant Event as Platform Event
    participant WebhookSvc as WebhookService
    participant Celery as Celery Worker (webhooks queue)
    participant Dispatcher as WebhookDispatcher
    participant DB as WebhookDelivery Table
    participant Customer as Customer HTTP Endpoint

    Event->>WebhookSvc: dispatch(org_id, event_type, payload)
    WebhookSvc->>DB: Query active endpoints subscribed to event
    loop For each matching endpoint
        WebhookSvc->>Celery: dispatch_webhook_event_task.delay(endpoint_id, payload)
    end
    Celery->>Dispatcher: dispatch(endpoint, payload)
    Dispatcher->>Dispatcher: decrypt secret, HMAC-SHA256 sign payload
    Dispatcher->>Customer: POST (signed request)
    alt Success (2xx)
        Dispatcher->>DB: INSERT delivery (status: SUCCESS)
        Dispatcher->>DB: UPDATE endpoint consecutive_failures = 0
    else Failure
        Dispatcher->>DB: INSERT delivery (status: FAILED, error_body)
        Dispatcher->>DB: UPDATE endpoint consecutive_failures += 1
    end
```

### E. Stripe Subscription & Billing Flow

```mermaid
sequenceDiagram
    participant Frontend
    participant SubRouter as SubscriptionRouter
    participant SubSvc as SubscriptionService
    participant Stripe as Stripe API
    participant DB as PostgreSQL

    Frontend->>SubRouter: POST /api/v1/subscriptions/checkout
    SubRouter->>SubSvc: create_checkout_session(org_id, plan)
    SubSvc->>Stripe: Create Checkout Session (PRO/ENTERPRISE price ID)
    Stripe-->>SubSvc: session.url
    SubSvc-->>Frontend: {checkout_url}

    Note over Stripe,DB: Webhook driven lifecycle events
    Stripe->>SubRouter: POST /api/v1/subscriptions/stripe-webhook
    SubRouter->>SubSvc: handle_stripe_event(event)
    SubSvc->>DB: UPDATE organization_subscriptions (plan_tier, status, period dates)
```

---

## 3. Authentication & Authorization

The platform supports **three** ways to authenticate, plus a stateless API key mechanism for the widget:

| Mechanism | Used By | Mechanics | Header |
| :--- | :--- | :--- | :--- |
| **Email + password** | Dashboard registration/login | `POST /auth/register` (email/password/full name) then `POST /auth/login` (`OAuth2PasswordRequestForm`) issues a short-lived JWT access token + a rotating refresh token | `Authorization: Bearer <access_token>` |
| **Google OAuth** | Dashboard "Continue with Google" | `POST /auth/google` verifies the Google ID token server-side (`google-auth`), matches or creates a user by `google_sub`/email, issues the same access + refresh token pair. Users created via Google have no password and cannot use the email/password login path. | `Authorization: Bearer <access_token>` |
| **API Keys** | Widget integrations, external clients | `sha256(random_key)` stored hash, scoped per organization; plaintext key is returned only once at creation | `X-API-Key: <key>` |

- **Refresh token rotation**: `user_sessions` stores only a hash of each refresh token plus its expiry. `POST /auth/refresh` validates the incoming token, deletes the old session row, and issues a brand-new access token + refresh token (rotate-on-use). Expired sessions are purged automatically by an hourly Celery Beat task.
- **Forgot password is the only OTP flow**: `POST /auth/forgot-password` generates a 6-digit OTP, caches it in Redis with a short TTL, and dispatches the email via Celery on the `high_priority` queue; `POST /auth/verify-forgot-password-otp` exchanges a correct OTP for a short-lived reset token; `POST /auth/reset-password` consumes that token to set a new password. Registration and normal login do **not** go through OTP.
- **Role-based org membership** (`OrganizationMember.role`): `OWNER`, `ADMIN`, `MEMBER`, `SUPPORT` — enforced per-organization, independent of the global user identity.
- **Rate limiting**: auth endpoints (`login`, `forgot-password`, `verify-forgot-password-otp`, `google`) are protected by a Redis-backed limiter keyed on client IP (`rate_limit_ip`); authenticated endpoints can also be limited per-user (`rate_limit_user`).

---

## 4. Structured Outputs & LLM Engine

To avoid hallucinated/unparsable triage output, the platform uses **Pydantic-bounded structured outputs** (`TypeVar("T", bound=BaseModel)`) via OpenAI's `beta.chat.completions.parse`, used for the router decision, the escalation decision, and any future structured generation:

```python
class OpenAIProvider(LLMProvider):
    MODEL = "gpt-4.1-mini"

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((openai.RateLimitError, openai.APIConnectionError, openai.InternalServerError)),
    )
    async def complete_structured(self, *, messages: list[dict], response_model: type[T]) -> T:
        response = await client.beta.chat.completions.parse(
            model=self.MODEL,
            messages=messages,
            response_format=response_model,
        )
        return response.choices[0].message.parsed
```

```python
class EscalationDecision(BaseModel):
    action: AIAction        # ANSWER | ESCALATE
    answer: str | None = None
    reason: str | None = None

class RouterResponse(BaseModel):
    route: ConversationRoute  # BILLING | TECHNICAL | GENERAL
    reason: str
    confidence: float
```

- **Retry policy**: transient OpenAI failures (`RateLimitError`, `APIConnectionError`, `InternalServerError`) are retried up to 3 times with exponential backoff (2s → 10s) via `tenacity`.
- **Graceful degradation on streaming**: `stream()` wraps the whole streamed call in a try/except; if all retries are exhausted or any `OpenAIError` occurs, it yields a polite fallback message ("we're experiencing high traffic, please contact support...") word-by-word instead of propagating the exception to the client.
- **Token metering**: `complete()` returns `(content, prompt_tokens, completion_tokens)` and `stream()` yields a trailing usage dict (`stream_options={"include_usage": True}`); `ChatService` forwards these to `UsageService.record_ai_response`, which accumulates `organization_usage.prompt_tokens_used` / `completion_tokens_used` for tier-based token quota enforcement.

---

## 5. Async Task Queue: Celery + RabbitMQ

| Queue | Task | Trigger |
| :--- | :--- | :--- |
| `high_priority` | `send_otp_email_task` | Forgot-password OTP request |
| `emails` | `send_ticket_create_email` | AI escalation creates a ticket |
| `emails` | `send_org_invite_email_task` | A member is invited to an organization |
| `webhooks` | `dispatch_webhook_event_task` | Platform event fired to a customer endpoint |
| `background_tasks` | `compress_conversation_memory_task` | Conversation history reaches 10 messages |
| *(Beat)* | `cleanup_expired_sessions_task` | Every 1 hour via Celery Beat |

Broker: RabbitMQ (`rabbitmq_url`). Serialization is JSON-only (`accept_content=["json"]`) so workers reject non-JSON payloads outright.

---

## 6. Plan Tiers, Usage Metering & Feature Gating

Plan tiers are `FREE`, `PRO`, and `ENTERPRISE` (`app/core/plan_config.py`). `UsageService` checks the relevant limit before an AI-driven or resource-creating operation proceeds and raises `PlanLimitExceededException` / `FeatureNotAllowedException` otherwise.

| Limit | FREE | PRO | ENTERPRISE |
| :--- | ---: | ---: | ---: |
| AI responses / month | 100 | 10,000 | 500,000 |
| AI tokens / month | 100,000 | 10,000,000 | 500,000,000 |
| Knowledge bases | 1 | 10 | 100 |
| Documents / KB | 10 | 500 | 10,000 |
| Org members | 1 | 10 | 100 |
| Storage | 100 MB | 10 GB | 500 GB |
| API keys | ✗ | ✓ | ✓ |
| Webhooks | ✗ | ✓ | ✓ |
| Custom branding | ✗ | ✓ | ✓ |

`SubscriptionService` drives Stripe Checkout and processes Stripe webhook events to keep `organization_subscriptions` in sync with `plan_tier` / `status` / billing period. `scripts/set_tier.py` is an admin CLI to set an org's tier directly in the DB for local testing/manual overrides.

---

## 7. Entity Relationship & Domain Data Model

<details>
<summary>Full ER diagram</summary>

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : contains
    ORGANIZATIONS ||--o{ KNOWLEDGE_BASES : owns
    ORGANIZATIONS ||--o{ CONVERSATIONS : manages
    ORGANIZATIONS ||--o{ TICKETS : tracks
    ORGANIZATIONS ||--o| ORGANIZATION_SUBSCRIPTIONS : has
    ORGANIZATIONS ||--o{ API_KEYS : issues
    ORGANIZATIONS ||--o{ WEBHOOK_ENDPOINTS : configures
    ORGANIZATIONS ||--o| ORGANIZATION_SETTINGS : configures
    ORGANIZATIONS ||--o{ ORGANIZATION_USAGE : metered_by
    USERS ||--o{ ORGANIZATION_MEMBERS : joins
    USERS ||--o{ USER_SESSIONS : authenticates_via
    KNOWLEDGE_BASES ||--o{ DOCUMENTS : stores
    KNOWLEDGE_BASES ||--o{ CONVERSATIONS : references
    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : splits_into
    CONVERSATIONS ||--o{ MESSAGES : contains
    CONVERSATIONS ||--o| TICKETS : generates
    MESSAGES ||--o| MESSAGE_FEEDBACK : receives
    TICKETS ||--o{ TICKET_EVENTS : logs
    TICKETS ||--o{ TICKET_NOTES : annotated_by
    WEBHOOK_ENDPOINTS ||--o{ WEBHOOK_DELIVERIES : records
```

</details>

| Model | Table | Purpose |
| :--- | :--- | :--- |
| `Organization` | `organizations` | Top-level multi-tenant boundary |
| `User` / `UserSession` | `users`, `user_sessions` | Auth identity (password and/or `google_sub`) & rotating refresh-token sessions |
| `OrganizationMember` | `organization_members` | Role-based org membership (`OWNER`/`ADMIN`/`MEMBER`/`SUPPORT`) |
| `OrganizationSubscription` | `organization_subscriptions` | Stripe plan & billing status |
| `OrganizationUsage` | `organization_usage` | Metered AI-response and AI-token counters per billing period |
| `OrganizationSettings` | `organization_settings` | Branding (logo/color/widget title), AI config (`system_prompt_override`, `temperature`), escalation config (`support_email`, `auto_create_ticket_on_escalation`) |
| `KnowledgeBase` | `knowledge_bases` | Scoped document store per org |
| `Document` / `DocumentChunk` | `documents`, `document_chunks` | Source files (status: `PROCESSING`/`READY`/`FAILED`) & pgvector embeddings |
| `Conversation` / `Message` | `conversations`, `messages` | Chat history per knowledge base; messages carry a JSONB `citations` column |
| `MessageFeedback` | `message_feedback` | Thumbs up/down on AI responses |
| `Ticket` | `tickets` | Escalated support tickets (status: `OPEN`/`IN_PROGRESS`/`RESOLVED`/`CLOSED`; priority: `LOW`/`MEDIUM`/`HIGH`/`URGENT`) |
| `TicketEvent` | `ticket_events` | Audit log of ticket state changes |
| `TicketNote` | `ticket_notes` | Internal agent notes on tickets |
| `ApiKey` | `api_keys` | Scoped org API keys for widget/external use (SHA-256 hashed) |
| `WebhookEndpoint` | `webhook_endpoints` | Customer HTTP endpoint registrations (Fernet-encrypted signing secret) |
| `WebhookDelivery` | `webhook_deliveries` | Per-attempt delivery log & status |

31 Alembic migrations are currently applied; the most recent additions are token tracking on `organization_usage`, JSONB `citations` on `messages`, and a nullable fix on webhook delivery response bodies (for timeout cases).

---

## 8. Reliability, Security & Guardrails

- **LLM call resilience**: exponential-backoff retries on transient OpenAI errors (see [§4](#4-structured-outputs--llm-engine)); the streaming chat path degrades to a canned "high traffic" message rather than surfacing a raw exception to the client.
- **Prompt-injection guardrail**: every chat system prompt has a hardcoded "CRITICAL SECURITY DIRECTIVE" block instructing the model to ignore attempts to override its instructions, reveal the system prompt, or break character.
- **Defensive retrieval**: `RetrievalService.retrieve()` short-circuits to an empty result set when a conversation has no knowledge base attached, instead of passing `None` into the embedding/vector-search path.
- **Secrets at rest**: API keys are SHA-256 hashed; webhook signing secrets are Fernet-encrypted (AES-128-CBC + HMAC-SHA256), decrypted only transiently at dispatch time.
- **Security headers middleware**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security` are added to every response.
- **Rate limiting**: Redis-backed, per-IP or per-authenticated-user, applied to auth endpoints and the public widget chat endpoint.
- **CORS**: locked to explicit localhost origins for local development; tighten `allow_origins`/`allow_origin_regex` for production domains.
- **Response compression**: `GZipMiddleware` compresses responses over 1KB.

---

## 9. Observability

- **Errors**: Sentry (`sentry_sdk`), initialized when `SENTRY_DSN` is set, with 100% trace sampling and PII capture enabled.
- **Metrics**: Prometheus via `prometheus-fastapi-instrumentator`, exposed at `/metrics`; `docker-compose.yml` also runs Prometheus + Grafana (host port 3001) for dashboards.
- **Tracing**: OpenTelemetry, exported over OTLP/HTTP to Jaeger (`docker-compose.yml` exposes the Jaeger UI on 16686).
- **Structured logging & correlation IDs**: `LoggingMiddleware` times each request; `CorrelationIdMiddleware` (`asgi-correlation-id`) attaches a correlation ID that flows through logs/traces for a request. Middleware order matters — the **last**-added middleware runs **first** on the way in (`app/main.py`).

---

## 10. Exception Handling & Error Governance

Domain exceptions live in `app/exceptions/` and are mapped centrally in `app/core/exception_handlers.py` — routers never construct `HTTPException`s themselves.

<details>
<summary>Full exception table</summary>

| Domain Exception | Trigger Condition | HTTP Status |
| :--- | :--- | :--- |
| `UserAlreadyExistsException` | Email already registered | `409 Conflict` |
| `InvalidCredentialsException` | Bad email/password, expired/invalid refresh token, bad Google token | `401 Unauthorized` |
| `InvalidOTPException` | Wrong/expired forgot-password OTP | `400 Bad Request` |
| `UserNotFoundException` | User not found (e.g. reset-password) | `404 Not Found` |
| `PermissionDeniedException` / `ForbiddenException` | Caller lacks required org role/permission | `403 Forbidden` |
| `AlreadyOrganizationMemberException` | Inviting a user already in the org | `409 Conflict` |
| `OrganizationNotFoundException` / `OrganizationAlreadyExistsException` | Org UUID not found / slug taken | `404` / `409` |
| `MemberNotFoundException` | Org member not found | `404 Not Found` |
| `KnowledgeBaseNotFoundException` / `KnowledgeBaseAlreadyExistsException` | KB missing / duplicate | `404` / `409` |
| `DocumentNotFoundException` / `DocumentAlreadyExistsException` | Document missing / duplicate file in KB | `404` / `409` |
| `ConversationNotFoundException` / `MessageNotFoundException` | Conversation/message UUID not found | `404 Not Found` |
| `TicketNotFoundException` / `TicketAlreadyExistsException` | Ticket missing / conversation already escalated | `404` / `409` |
| `TicketNoteNotFoundException` | Ticket note not found | `404 Not Found` |
| `ApiKeyNotFoundException` | API key not found/inactive | `404 Not Found` |
| `InvalidApiKeyException` | Malformed/invalid API key on widget request | `401 Unauthorized` |
| `WebhookNotFoundException` | Webhook endpoint UUID not found | `404 Not Found` |
| `RateLimitExceededException` | Too many requests from client/user | `429 Too Many Requests` (+ `Retry-After`, `X-RateLimit-*` headers) |
| `PlanLimitExceededException` | Plan quota breached (responses/tokens/KBs/docs/members/storage) | `403 Forbidden` |
| `FeatureNotAllowedException` | Tier doesn't include the requested feature (API keys/webhooks/branding) | `403 Forbidden` |
| `stripe.SignatureVerificationError` | Invalid Stripe webhook signature | `400 Bad Request` |
| `stripe.StripeError` | Any other Stripe API failure | `502 Bad Gateway` |

</details>

---

## 11. Testing & Load Testing

```bash
uv run pytest tests/                 # full suite (pythonpath=["."], asyncio_mode="auto")
uv run pytest --cov=app tests/       # with coverage (matches CI)
locust -f tests/locustfile.py        # manual load test, not run in CI
uv run python tests/cleanup_loadtest.py   # deletes loadtest_* users after a Locust run
```

- `tests/conftest.py` provides a `db_session` fixture that opens a **real** async connection to `DATABASE_URL` wrapped in a transaction rolled back after each test, and a `client` fixture that overrides FastAPI's `get_db` with it — so integration tests hit a real Postgres/pgvector instance without persisting data.
- `test_auth.py` is a true end-to-end integration test (register → login → assert JWTs) against the real DB fixture.
- `test_webhooks.py` and `test_widget.py` are the deepest suites — HMAC signing, schema validation, repository/service logic, and API routes, mostly with mocked repos/services (including SSE stream mocking).
- `locustfile.py` simulates registered users hitting `GET /` (weighted 3x) and unauthenticated `POST /api/v1/widget/chat/stream` (weighted 1x, to verify the rate limiter rejects bad traffic quickly).

---

## 12. CI/CD & Deployment

`.github/workflows/deploy.yml` runs on every push to `main`:

1. **test** — spins up `pgvector/pgvector:pg15` and `redis:7-alpine` service containers, `uv sync`, runs `alembic upgrade head` (the pgvector extension is created inside the migration itself via `CREATE EXTENSION IF NOT EXISTS vector`, since the base image only makes it available, not enabled), then `pytest --cov=app tests/`.
2. **deploy** (needs `test` to pass) — SSHes into an AWS EC2 host and runs `git pull && docker compose up --build -d api worker`.

`docker-compose.yml` defines the full stack: `api`, `worker` (Celery), `postgres` (pgvector), `redis`, `rabbitmq`, `prometheus`, `grafana`, `jaeger`, and `nginx` (nginx-proxy-manager, for HTTPS/reverse-proxy termination). `Dockerfile` is a single-stage `python:3.12-slim` build using the `uv` binary to install dependencies from `pyproject.toml`.

---

## 13. Frontend Dashboard

`frontend/` is a **Next.js 16** (App Router) + **React 19** + TypeScript dashboard, styled with Tailwind CSS 4. No form/state-management library is used — plain React Context (`AuthContext`, `OrganizationContext`) and controlled component state.

**Routes**: `/` redirects to `/login`; `/login` and `/register` (route group `(auth)`) render the auth forms with email/password and "Continue with Google"; `/onboarding` is a 4-step post-signup wizard (create workspace → upload first knowledge base → set AI personality/branding → get embed snippet); `/dashboard` is a single-page shell with client-side tab switching (not separate routes) between Overview, Escalated Tickets, Live Conversations, Knowledge Base, AI Assistant Studio, Developer Hub, Billing/Usage, and Workspace Settings — plus a ⌘K command palette, a live AI test drawer, and modals for new tickets, embed script, and plan upgrades.

**Component areas** (`src/components/`): `assistant/` (AI personality & branding studio with a live widget simulator), `auth/` (login/register forms, Google button, forgot-password OTP modal), `billing/` (Stripe plan cards, quota meters, billing history), `conversations/` (live widget inbox), `dashboard/` (shell chrome, metrics, modals), `developer/` (API key & webhook management, SDK snippets), `knowledge/` (KB/document management, chunk inspector, vector search tester), `settings/` (org settings, team invites), `tickets/` (escalation queue, customer context, internal notes), `ui/` (shared primitives).

**API client** (`src/lib/api.ts`): a single `axios` instance pointed at `NEXT_PUBLIC_API_URL` (proxied to the FastAPI backend via `next.config.ts` rewrites in dev). A request interceptor attaches the stored access token; a response interceptor transparently calls `/auth/refresh` on a 401, queues concurrent requests during the refresh, retries them, and redirects to `/login?expired=1` if the refresh itself fails.

---

## 14. Project Directory Structure

<details>
<summary>Full directory tree</summary>

```text
support-ai/
├── alembic.ini                    # Alembic migration configuration
├── pyproject.toml / uv.lock       # Project dependencies managed via uv
├── Dockerfile                     # python:3.12-slim, uv-based install
├── docker-compose.yml             # api, worker, postgres, redis, rabbitmq, prometheus, grafana, jaeger, nginx
├── .github/workflows/deploy.yml   # CI (pytest+coverage) -> CD (SSH deploy to EC2)
├── migrations/versions/           # Alembic migration history (31 revisions)
├── scripts/
│   ├── backup.sh                  # pg_dump + gzip Postgres backup
│   ├── set_tier.py                # Admin CLI to change an org's plan tier
│   ├── test_chat.py               # Manual ChatService smoke test
│   └── test_embedding.py          # Manual EmbeddingFactory smoke test
├── tests/                         # pytest suite + locustfile.py + cleanup_loadtest.py
├── frontend/                      # Next.js 16 + React 19 dashboard
│   └── src/
│       ├── app/                   # App Router: (auth)/, dashboard/, onboarding/
│       ├── components/            # assistant, auth, billing, conversations, dashboard,
│       │                          # developer, knowledge, onboarding, settings, tickets, ui
│       ├── context/                # AuthContext, OrganizationContext
│       └── lib/api.ts             # Axios client w/ token-refresh interceptor
└── app/
    ├── api/v1/                    # REST API routers
    │   ├── auth.py                # Register, password/Google login, refresh, forgot/reset password
    │   ├── chat.py                # RAG + agent-routed chat endpoint (incl. SSE streaming)
    │   ├── conversations.py       # Conversation management
    │   ├── documents.py           # Document upload & status
    │   ├── knowledge_bases.py     # Knowledge base CRUD
    │   ├── ticket.py / ticket_events.py / ticket_notes.py
    │   ├── webhooks.py            # Webhook endpoint & delivery management
    │   ├── subscription.py        # Stripe checkout & webhook handler
    │   ├── api_keys.py            # API key issuance & revocation
    │   ├── usage.py               # Usage stats endpoint
    │   ├── organization_settings.py / organization_member.py / organizations.py
    │   ├── health.py
    │   └── widget.py              # Public embeddable widget endpoints (API-key auth)
    ├── agents/                    # Router, specialist prompts, memory compression
    │   ├── router.py              # AgentRouter.route_conversation -> BILLING/TECHNICAL/GENERAL
    │   ├── specialists.py         # Per-route system prompts
    │   └── memory.py              # MemoryCompressor - summarizes & prunes old messages
    ├── core/                      # Settings, plan_config, exception_handlers, lifespan, rate_limiter
    ├── db/                        # Async database engine, session manager, dependencies
    ├── dependencies/              # FastAPI dependency injectors (auth, rate limits)
    ├── dto/                       # Internal Data Transfer Objects
    ├── exceptions/                # Custom domain exceptions
    ├── integrations/              # Shared external SDK clients (OpenAI async client)
    ├── models/                    # SQLAlchemy 2.0 ORM models
    ├── processing/
    │   ├── document_tasks (tasks/) # Background document-processing entrypoint
    │   ├── parsers/                # pdf / markdown / txt parser factory
    │   ├── embeddings/             # Embedding provider factory (OpenAI)
    │   └── llms/                   # LLM provider factory, base class, OpenAI implementation (retry, streaming, token usage)
    ├── prompts/                   # System prompt templates (escalation, titles, widget responses)
    ├── redis/                     # Redis client, cache services, key builders
    ├── repositories/              # Async data access layer (one per domain entity)
    ├── schemas/                   # Pydantic v2 request/response schemas
    ├── services/                  # Core business logic services
    ├── static/                    # Embeddable JS widget & demo HTML
    │   ├── widget.js
    │   └── demo.html
    ├── utils/                     # Helper utilities
    └── workers/
        ├── celery_app.py          # Celery app, queue routing & Beat schedule
        └── tasks.py               # OTP/invite/ticket emails, webhook dispatch, memory compression, session cleanup
```

</details>

---

## 15. Setup & Local Development

### Prerequisites
- Python 3.12+
- PostgreSQL with `pgvector` extension
- Redis
- RabbitMQ (for Celery)
- Node.js 18+ (for frontend)
- Docker + Docker Compose (optional, for the full stack incl. Prometheus/Grafana/Jaeger/nginx)

### Environment Variables
Create a `.env` file in the project root:
```bash
# Database
DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/support_ai"

# Auth
JWT_SECRET="your-jwt-secret-key"
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# OpenAI
OPENAI_API_KEY="sk-..."

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379

# RabbitMQ (Celery broker)
RABBITMQ_URL="amqp://guest:guest@localhost:5672/"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRO_PRICE_ID="price_..."
STRIPE_ENTERPRISE_PRICE_ID="price_..."

# Webhooks
WEBHOOK_ENCRYPTION_KEY="<fernet key>"

# Observability (optional)
SENTRY_DSN=""
OTLP_ENDPOINT="http://localhost:4318/v1/traces"
```

### Apply Database Migrations
```bash
uv run alembic upgrade head
```

### Run the Development Server
```bash
uv run fastapi dev app/main.py
```
Interactive API docs: `http://localhost:8000/docs`

### Run Celery Workers
```bash
# Worker (all queues)
uv run celery -A app.workers.celery_app worker --loglevel=info -Q high_priority,emails,webhooks,background_tasks

# Beat scheduler (periodic tasks)
uv run celery -A app.workers.celery_app beat --loglevel=info
```

### Run the Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
```
Frontend: `http://localhost:3000`

### Or Run the Full Stack via Docker Compose
```bash
docker compose up --build
```
Brings up the API, Celery worker, Postgres (pgvector), Redis, RabbitMQ, Prometheus, Grafana, Jaeger, and an nginx reverse proxy together.

### Run Tests
```bash
uv run pytest tests/
```

### Admin Utilities
```bash
uv run python scripts/set_tier.py              # list all orgs and their current plan tier
uv run python scripts/set_tier.py <ORG> PRO     # change an org's plan tier
./scripts/backup.sh                             # pg_dump + gzip a Postgres backup
```

---

Building an AI support platform, or looking for one? Reach out at **anubhavdas651@gmail.com**.
