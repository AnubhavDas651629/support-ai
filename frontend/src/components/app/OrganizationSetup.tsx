"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/States";
import { CopyButton } from "@/components/ui/CopyButton";
import { API_ORIGIN, knowledgeApi } from "@/lib/api";
import type { Organization } from "@/lib/api/types";
import { useOrganization } from "@/context/OrganizationContext";
import { useAuth } from "@/context/AuthContext";
import { useAsyncAction } from "@/lib/hooks";

const STEP_LABELS = [
  "Create your organization — it owns knowledge, conversations and members.",
  "Add a knowledge base and upload the documents your agents should answer from.",
  "Drop the widget on your site, or call the API with an organization API key.",
];

/**
 * Shown when a signed-in user has no organization yet. Walks through all
 * three onboarding steps in order — creating the org used to be followed by
 * an immediate drop into the dashboard, silently skipping the knowledge base
 * and widget steps the copy promised.
 */
export function OrganizationSetup({ onFinish }: { onFinish: () => void }) {
  const { createOrganization } = useOrganization();
  const { user, logout } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [org, setOrg] = useState<Organization | null>(null);

  const [orgName, setOrgName] = useState("");
  const [kbName, setKbName] = useState("");
  const [kbDescription, setKbDescription] = useState("");

  const createOrg = useAsyncAction(async (name: string) => {
    const created = await createOrganization(name);
    setOrg(created);
    setStep(2);
  });

  const createKb = useAsyncAction(async () => {
    await knowledgeApi.create(org!.id, {
      name: kbName.trim(),
      description: kbDescription.trim() || null,
    });
    setStep(3);
  });

  const widgetSnippet = `<script\n  src="${API_ORIGIN}/static/widget.js"\n  data-api-key="YOUR_API_KEY"\n  data-api-url="${API_ORIGIN}"\n  defer\n></script>`;

  const goToDevelopers = () => {
    onFinish();
    router.push("/dashboard/developers");
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex h-14 items-center justify-between border-b border-line px-4 sm:px-6">
        <Logo />
        <button
          onClick={logout}
          className="rounded text-[13px] text-muted hover:text-fg"
        >
          Sign out
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <p className="text-[13px] font-medium text-accent-text">Step {step} of 3</p>

          {step === 1 && (
            <>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-fg">
                Create your organization
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Welcome{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}. Everything
                in Support-AI is scoped to an organization — knowledge bases, conversations,
                members and API keys all live inside one.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (orgName.trim().length >= 2) createOrg.run(orgName.trim());
                }}
                className="mt-6 space-y-4"
              >
                {createOrg.error && <InlineAlert>{createOrg.error}</InlineAlert>}
                <Field
                  label="Organization name"
                  htmlFor="setup-org"
                  required
                  hint="You can rename this later in Settings."
                >
                  <Input
                    id="setup-org"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Acme Support"
                    minLength={2}
                    maxLength={100}
                    autoFocus
                    required
                  />
                </Field>
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={createOrg.pending}
                  disabled={orgName.trim().length < 2}
                >
                  Create organization
                  <ArrowRight className="size-4" />
                </Button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-fg">
                Add a knowledge base
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                This is what your agents retrieve answers from. Give it a name now — you can
                upload documents right after.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (kbName.trim().length >= 2) createKb.run();
                }}
                className="mt-6 space-y-4"
              >
                {createKb.error && <InlineAlert>{createKb.error}</InlineAlert>}
                <Field label="Knowledge base name" htmlFor="setup-kb-name" required>
                  <Input
                    id="setup-kb-name"
                    value={kbName}
                    onChange={(e) => setKbName(e.target.value)}
                    placeholder="Product docs"
                    minLength={2}
                    maxLength={100}
                    autoFocus
                    required
                  />
                </Field>
                <Field
                  label="Description"
                  htmlFor="setup-kb-description"
                  hint="Optional — helps you tell knowledge bases apart later."
                >
                  <Textarea
                    id="setup-kb-description"
                    value={kbDescription}
                    onChange={(e) => setKbDescription(e.target.value)}
                    placeholder="Docs our agents answer support questions from"
                    maxLength={500}
                    rows={3}
                  />
                </Field>
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={createKb.pending}
                  disabled={kbName.trim().length < 2}
                >
                  Create knowledge base
                  <ArrowRight className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  fullWidth
                  onClick={() => setStep(3)}
                >
                  Skip for now
                </Button>
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-fg">
                Connect the widget
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Grab an API key from Developers, then drop this on your site. It works the
                moment your knowledge base has documents.
              </p>

              <div className="relative mt-6 rounded-control border border-line bg-surface-2">
                <div className="absolute right-2 top-2">
                  <CopyButton value={widgetSnippet} />
                </div>
                <pre className="overflow-x-auto px-4 py-4 pr-20 font-mono text-[12px] leading-relaxed text-muted">
                  <code>{widgetSnippet}</code>
                </pre>
              </div>

              <div className="mt-6 space-y-2">
                <Button variant="primary" fullWidth onClick={goToDevelopers}>
                  Get my API key
                  <ArrowRight className="size-4" />
                </Button>
                <Button variant="ghost" fullWidth onClick={onFinish}>
                  I&apos;ll do this later — go to dashboard
                </Button>
              </div>
            </>
          )}

          <ol className="mt-8 space-y-3 border-t border-line pt-6">
            {STEP_LABELS.map((label, i) => {
              const stepNumber = i + 1;
              const done = stepNumber < step;
              const current = stepNumber === step;
              return (
                <li key={label} className="flex gap-3 text-[13px] leading-relaxed">
                  <span
                    className={
                      done
                        ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-accent-fg"
                        : current
                          ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-fg"
                          : "flex size-5 shrink-0 items-center justify-center rounded-full border border-line text-[11px] font-medium text-subtle"
                    }
                  >
                    {done ? <Check className="size-3" /> : stepNumber}
                  </span>
                  <span className={current || done ? "text-fg" : "text-muted"}>{label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
