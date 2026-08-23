"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, Minus } from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InlineAlert, LoadingRows } from "@/components/ui/States";
import { Meter } from "@/components/charts/Meter";
import { billingApi } from "@/lib/api";
import { PLANS, PLAN_COMPARISON } from "@/lib/plans";
import type { PlanTier } from "@/lib/api/types";
import { PLAN_META, canManageOrganization } from "@/lib/domain";
import { useAsyncAction } from "@/lib/hooks";
import { useOrganization } from "@/context/OrganizationContext";
import { cn, formatBytes, formatDate } from "@/lib/utils";

/** Stripe price IDs come from the deployment, not the client bundle's guesses. */
const PRICE_IDS: Record<string, string | undefined> = {
  PRO: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
  ENTERPRISE: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE,
};

export default function BillingPage() {
  const { currentOrg, subscription, usage, role } = useOrganization();
  const orgId = currentOrg?.id ?? null;
  const canManage = canManageOrganization(role);

  // Which card is mid-request, so only the button that was clicked spins.
  const [pendingTier, setPendingTier] = useState<PlanTier | null>(null);

  /**
   * Every plan change ends on a Stripe-hosted page. `priceId` picks which one:
   * with it we open Checkout to start a new subscription, without it we open
   * the billing portal, which is the only surface that can swap or cancel a
   * subscription Stripe is already billing.
   */
  const changePlan = useAsyncAction(async (tier: PlanTier, priceId?: string) => {
    setPendingTier(tier);
    try {
      const { checkout_url } = priceId
        ? await billingApi.checkout(orgId!, {
            price_id: priceId,
            success_url: `${window.location.origin}/dashboard/settings/billing?upgraded=1`,
            cancel_url: window.location.href,
          })
        : await billingApi.portal(orgId!, window.location.href);
      window.location.href = checkout_url;
    } catch (err) {
      setPendingTier(null);
      throw err;
    }
  });

  const portal = useAsyncAction(async () => {
    const { checkout_url } = await billingApi.portal(orgId!, window.location.href);
    window.location.href = checkout_url;
  });

  const plan = subscription ? PLAN_META[subscription.plan_tier] : null;
  const ownerOnly = canManage
    ? undefined
    : "Only the organization owner can change the plan";
  // The portal is worth offering once Stripe knows this org — on a paid plan,
  // or after any checkout, which is what leaves a customer behind.
  const canOpenPortal =
    canManage &&
    !!subscription &&
    (subscription.plan_tier !== "FREE" || subscription.has_billing_account);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1.5 rounded text-[13px] text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-3.5" />
        Settings
      </Link>

      <PageHeader
        title="Plan & usage"
        description="What you're on, what you've used, and what changes if you move up."
        actions={
          canOpenPortal ? (
            <Button size="sm" loading={portal.pending} onClick={() => portal.run()}>
              Manage billing
              <ExternalLink className="size-3.5" />
            </Button>
          ) : undefined
        }
      />

      {(changePlan.error || portal.error) && (
        <InlineAlert>{changePlan.error ?? portal.error}</InlineAlert>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel>
          <PanelHeader title="Current plan" />
          {!subscription ? (
            <LoadingRows rows={2} />
          ) : (
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={plan!.tone}>{plan!.label}</Badge>
                <Badge tone={subscription.status === "ACTIVE" ? "success" : "warning"} dot>
                  {subscription.status}
                </Badge>
                <span className="text-[12.5px] text-subtle">
                  Renews {formatDate(subscription.current_period_end)}
                </span>
              </div>
              <p className="text-[13.5px] leading-relaxed text-muted">{plan!.blurb}</p>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="This period" />
          <div className="space-y-3.5 p-4 sm:p-5">
            {!usage ? (
              <LoadingRows rows={3} className="p-0" />
            ) : (
              <>
                <Meter
                  label="AI responses"
                  used={usage.ai_responses.used}
                  limit={usage.ai_responses.limit}
                />
                <Meter
                  label="AI tokens"
                  used={usage.ai_tokens.used}
                  limit={usage.ai_tokens.limit}
                />
                <Meter
                  label="Document storage"
                  used={usage.storage_bytes.used}
                  limit={usage.storage_bytes.limit}
                  formatValue={formatBytes}
                />
                <Meter
                  label="Conversations"
                  used={usage.conversations.used}
                  limit={usage.conversations.limit}
                />
                <p className="pt-1 text-[12px] text-subtle">
                  {formatDate(usage.period_start)} – {formatDate(usage.period_end)}
                </p>
              </>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-px overflow-hidden rounded-panel border border-line bg-line lg:grid-cols-3">
        {PLANS.map((definition) => {
          const isCurrent = subscription?.plan_tier === definition.tier;
          const priceId = PRICE_IDS[definition.tier];
          /**
           * Checkout can only ever *start* a subscription: sending an existing
           * subscriber there bills them a second time instead of switching
           * their plan, and it has no way to express "drop back to Free" at
           * all. So a downgrade always goes to the billing portal, and so does
           * any change once Stripe is already billing this org — the portal is
           * what owns the swap, the proration and the cancellation.
           */
          const viaPortal =
            definition.tier === "FREE" || !!subscription?.has_stripe_subscription;
          return (
            <div
              key={definition.tier}
              className={cn("flex flex-col p-5 sm:p-6", isCurrent ? "bg-surface" : "bg-bg")}
            >
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-fg">{definition.name}</h2>
                {isCurrent && <Badge tone="accent">Current</Badge>}
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                {definition.tagline}
              </p>
              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-fg">
                  {definition.priceLabel}
                </span>
                <span className="text-[13px] text-subtle">{definition.priceNote}</span>
              </p>

              <ul className="mt-5 flex-1 space-y-2">
                {definition.highlights.map((item) => (
                  <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-muted">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-accent-text" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <Button fullWidth disabled>
                    Your plan
                  </Button>
                ) : viaPortal ? (
                  <Button
                    fullWidth
                    variant={definition.tier === "PRO" ? "primary" : "secondary"}
                    loading={pendingTier === definition.tier}
                    disabled={!canManage}
                    title={ownerOnly}
                    onClick={() => changePlan.run(definition.tier)}
                  >
                    {definition.tier === "FREE"
                      ? "Switch to Free"
                      : `Switch to ${definition.name}`}
                  </Button>
                ) : priceId ? (
                  <Button
                    fullWidth
                    variant={definition.tier === "PRO" ? "primary" : "secondary"}
                    loading={pendingTier === definition.tier}
                    disabled={!canManage}
                    title={ownerOnly}
                    onClick={() => changePlan.run(definition.tier, priceId)}
                  >
                    Upgrade to {definition.name}
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    disabled
                    title={`Set NEXT_PUBLIC_STRIPE_PRICE_${definition.tier} to enable checkout`}
                  >
                    Checkout not configured
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!PRICE_IDS.PRO && !PRICE_IDS.ENTERPRISE && (
        <InlineAlert tone="info">
          Stripe checkout is wired up but needs price IDs. Set{" "}
          <code className="font-mono text-[12px]">NEXT_PUBLIC_STRIPE_PRICE_PRO</code> and{" "}
          <code className="font-mono text-[12px]">NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE</code>{" "}
          to the prices configured in your Stripe account — the backend then creates the
          checkout session from them.
        </InlineAlert>
      )}

      <Panel>
        <PanelHeader title="Limits compared" description="The numbers the platform enforces" />
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">Plan limits compared</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="border-b border-line bg-surface-2/60 px-4 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-[0.06em] text-subtle"
                >
                  Limit
                </th>
                {PLANS.map((p) => (
                  <th
                    key={p.tier}
                    scope="col"
                    className="border-b border-line bg-surface-2/60 px-4 py-2.5 text-right text-[11.5px] font-medium uppercase tracking-[0.06em] text-subtle"
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_COMPARISON.map((row) => (
                <tr key={row.label}>
                  <th
                    scope="row"
                    className="border-b border-line px-4 py-2.5 text-left text-[13px] font-normal text-muted"
                  >
                    {row.label}
                  </th>
                  {PLANS.map((p) => {
                    const formatted = row.format(p.limits[row.key]);
                    return (
                      <td
                        key={p.tier}
                        className="border-b border-line px-4 py-2.5 text-right text-[13px] tnum text-fg"
                      >
                        {formatted === "yes" ? (
                          <Check className="ml-auto size-4 text-success" aria-label="Included" />
                        ) : formatted === "—" ? (
                          <Minus className="ml-auto size-4 text-subtle" aria-label="Not included" />
                        ) : (
                          formatted
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
