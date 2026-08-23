# Support-AI — Product Overview

## What is Support-AI?

Support-AI is a customer support platform that turns your existing documentation into
a support agent. You upload your docs — help center articles, policy PDFs, product
manuals, internal runbooks — and Support-AI answers customer questions by retrieving
the exact relevant passages and generating a grounded response, with the source
documents cited. When a question falls outside what your documentation covers, or a
customer is clearly frustrated, Support-AI automatically escalates the conversation
into a ticket for a human teammate instead of guessing.

It ships as three things you can mix and match: a dashboard for your support team, an
embeddable chat widget for your website, and a REST API for building your own
integrations.

## Core features

### Grounded, cited answers (RAG chat)

Every answer comes from your own knowledge base, not the model's general training
data. Documents are chunked and embedded, then at chat time the most relevant chunks
are retrieved by similarity search and given to the model as context. Every response
includes citations back to the source document, so your team (and your customers) can
see exactly where an answer came from.

### Automatic escalation to tickets

Support-AI doesn't try to bluff an answer when it doesn't know. If the retrieved
knowledge doesn't cover the question, or the conversation shows signs of frustration
or an issue outside the AI's scope, it automatically escalates: a ticket is created,
priority is set, and the conversation is handed to a human. Escalations carry the
full conversation history, so nobody has to repeat themselves.

### Knowledge bases

Organize documentation into one or more knowledge bases — for example, separate bases
for "Billing," "API Docs," and "Onboarding." Upload PDFs, Word docs, or plain text;
Support-AI parses, chunks, and embeds them automatically, and you can watch each
document's status move from processing to ready. Free plans get 1 knowledge base and
10 documents per base; Pro gets 10 knowledge bases and 500 documents per base;
Enterprise scales to 100 knowledge bases and 10,000 documents per base.

### Embeddable chat widget

A single `<script>` tag drops a floating chat widget onto any website — no SDK
install, no build step. It's fully themeable (title, primary color, logo) from your
dashboard settings, works on mobile, remembers returning visitors' conversations, and
shows the same grounded, cited answers as the dashboard. Widget conversations
automatically escalate to your ticket queue exactly like dashboard conversations do.

### Tickets and escalation queue

Escalated conversations land in a queue with priority (low/medium/high/urgent) and
status (open/pending/resolved/closed) so your team can triage what needs attention
first. Tickets can be assigned to specific teammates, support internal notes separate
from the customer-facing thread, and keep a full event timeline of status and
priority changes.

### Outbound webhooks

Subscribe your own systems to events — a new conversation started, a message sent, a
ticket escalated, a ticket resolved — and Support-AI will POST a signed payload to
your endpoint the moment it happens. Every delivery is HMAC-SHA256 signed so you can
verify it actually came from Support-AI, and every attempt (success or failure) is
logged with full delivery history for debugging.

### API keys and developer access

Organization-scoped API keys (available on Pro and Enterprise) let you call the same
endpoints the widget uses from your own backend — stream a chat answer, list
escalations, verify a webhook signature. Keys are SHA-256 hashed at rest and can be
set to expire or be revoked instantly if compromised.

### Analytics

A live overview of how your support operation is actually performing: conversation
volume, escalation rate, percentage of questions resolved without a human, and median
time to close a ticket, broken out over the last 14 days.

### Team roles and multi-tenancy

Every organization is fully isolated — knowledge bases, conversations, tickets, API
keys, and billing all live scoped to that organization. Invite teammates with roles
(owner, admin, member, support) that control who can manage billing, API keys, and
settings versus who can just work the ticket queue.

## How it works, end to end

1. **Upload** a document to a knowledge base. Support-AI parses it, splits it into
   chunks, and generates vector embeddings for each chunk (using OpenAI's
   `text-embedding-3-small` model), storing them for fast similarity search.
2. **A customer asks a question** — through the dashboard, the embeddable widget, or
   the API.
3. **Retrieval** finds the most relevant chunks across the knowledge base using
   cosine similarity search.
4. **The AI decides**: with that retrieved context in hand, it either answers directly
   (streaming the response token by token) or escalates to a ticket if the knowledge
   doesn't cover it or the conversation needs a human.
5. **The answer is cited** — every response lists which documents it drew from, and
   the full exchange is saved to the conversation history.
6. **Webhooks fire** for anything you've subscribed to, so your own systems stay in
   sync in real time.

## Plans and pricing

| | Free | Pro | Enterprise |
|---|---|---|---|
| Price | $0 forever | $149/month | Custom, annual |
| AI responses / month | 100 | 10,000 | 500,000 |
| AI tokens / month | 100,000 | 10,000,000 | 500,000,000 |
| Knowledge bases | 1 | 10 | 100 |
| Documents per knowledge base | 10 | 500 | 10,000 |
| Team members | 1 | 10 | 100 |
| Document storage | 100 MB | 10 GB | 500 GB |
| API keys | — | ✓ | ✓ |
| Webhooks | — | ✓ | ✓ |
| Custom branding | — | ✓ | ✓ |

Free is free forever, no credit card required — enough to index one knowledge base
and see what it can already answer. Pro is for teams running live support on real
volume, and adds API keys, webhooks, custom widget branding, and escalation SLAs,
notes and assignment. Enterprise is Pro at roughly 50× the volume, with support for
self-hosted deployment.

## Security and reliability

Support-AI supports two authentication mechanisms: session-based login (email and
password, or Google sign-in) for the dashboard, and hashed API keys for the widget
and programmatic access. All data access is scoped to your organization at the
database layer, so there's no cross-tenant leakage. The platform is instrumented with
structured logging, error tracking, and distributed tracing, so if something goes
wrong, it's diagnosable.

## Frequently asked questions

**Do I need to be technical to set it up?** No. Creating an organization, uploading a
document, and dropping the widget script tag onto your site are all no-code steps
from the dashboard.

**What happens if the AI doesn't know the answer?** It escalates to a ticket instead
of guessing, with the full conversation attached, so a human can take over without
the customer repeating themselves.

**Can I use my own backend instead of the widget?** Yes — on Pro and Enterprise, API
keys let you call the same chat and ticket endpoints directly from your own systems.

**Is there a free trial for Pro?** Free is free forever with no card required, so you
can fully evaluate the product on the Free plan before upgrading — there's no
separate trial period.

**How is my data kept separate from other customers?** Every resource — knowledge
bases, conversations, tickets, API keys — is scoped to your organization and enforced
at both the application and database layers.
