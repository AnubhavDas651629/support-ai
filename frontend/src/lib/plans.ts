/**
 * Plan limits, mirroring `app/core/plan_config.py`.
 *
 * The dashboard reads the authoritative copy from
 * `GET /organizations/{id}/subscription`; this table exists so the public
 * pricing page can render without an authenticated request. Keep the numbers
 * in sync with the backend.
 */
import type { PlanLimits, PlanTier } from "@/lib/api/types";

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  priceLabel: string;
  priceNote: string;
  tagline: string;
  limits: PlanLimits & { max_ai_tokens_per_month: number };
  highlights: string[];
  ctaLabel: string;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const PLANS: PlanDefinition[] = [
  {
    tier: "FREE",
    name: "Free",
    priceLabel: "$0",
    priceNote: "forever",
    tagline: "Index a knowledge base and see what it can answer.",
    limits: {
      max_ai_responses_per_month: 100,
      max_ai_tokens_per_month: 100_000,
      max_knowledge_bases: 1,
      max_documents_per_kb: 10,
      max_members: 1,
      max_storage_bytes: 100 * MB,
      allows_api_keys: false,
      allows_webhooks: false,
      allows_custom_branding: false,
    },
    highlights: [
      "Grounded answers with citations",
      "Automatic escalation to a ticket",
      "Embeddable chat widget",
    ],
    ctaLabel: "Start free",
  },
  {
    tier: "PRO",
    name: "Pro",
    priceLabel: "$149",
    priceNote: "per month",
    tagline: "For teams running live support on real volume.",
    limits: {
      max_ai_responses_per_month: 10_000,
      max_ai_tokens_per_month: 10_000_000,
      max_knowledge_bases: 10,
      max_documents_per_kb: 500,
      max_members: 10,
      max_storage_bytes: 10 * GB,
      allows_api_keys: true,
      allows_webhooks: true,
      allows_custom_branding: true,
    },
    highlights: [
      "API keys for your own integrations",
      "Signed outbound webhooks with delivery logs",
      "Custom branding on the widget",
      "Escalation SLAs, notes and assignment",
    ],
    ctaLabel: "Start with Pro",
  },
  {
    tier: "ENTERPRISE",
    name: "Enterprise",
    priceLabel: "Custom",
    priceNote: "annual",
    tagline: "For multi-team operations with volume and governance needs.",
    limits: {
      max_ai_responses_per_month: 500_000,
      max_ai_tokens_per_month: 500_000_000,
      max_knowledge_bases: 100,
      max_documents_per_kb: 10_000,
      max_members: 100,
      max_storage_bytes: 500 * GB,
      allows_api_keys: true,
      allows_webhooks: true,
      allows_custom_branding: true,
    },
    highlights: [
      "Everything in Pro, at 50× the volume",
      "100 members across teams",
      "Self-hosted deployment supported",
    ],
    ctaLabel: "Talk to us",
  },
];

export const PLAN_COMPARISON: {
  label: string;
  key: keyof PlanDefinition["limits"];
  format: (value: number | boolean) => string;
}[] = [
  {
    label: "AI responses / month",
    key: "max_ai_responses_per_month",
    format: (v) => (v as number).toLocaleString(),
  },
  {
    label: "AI tokens / month",
    key: "max_ai_tokens_per_month",
    format: (v) => (v as number).toLocaleString(),
  },
  {
    label: "Knowledge bases",
    key: "max_knowledge_bases",
    format: (v) => String(v),
  },
  {
    label: "Documents per base",
    key: "max_documents_per_kb",
    format: (v) => (v as number).toLocaleString(),
  },
  {
    label: "Team members",
    key: "max_members",
    format: (v) => String(v),
  },
  {
    label: "Document storage",
    key: "max_storage_bytes",
    format: (v) => {
      const bytes = v as number;
      return bytes >= GB ? `${Math.round(bytes / GB)} GB` : `${Math.round(bytes / MB)} MB`;
    },
  },
  { label: "API keys", key: "allows_api_keys", format: (v) => (v ? "yes" : "—") },
  { label: "Webhooks", key: "allows_webhooks", format: (v) => (v ? "yes" : "—") },
  {
    label: "Custom branding",
    key: "allows_custom_branding",
    format: (v) => (v ? "yes" : "—"),
  },
];
