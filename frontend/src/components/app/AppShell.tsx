"use client";

import { useState } from "react";
import { useOrganization } from "@/context/OrganizationContext";
import { Spinner } from "@/components/ui/Spinner";
import { DesktopSidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { OrganizationSetup } from "./OrganizationSetup";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoading, needsOnboarding } = useOrganization();

  // Latched rather than read live: `needsOnboarding` flips to false the
  // instant the wizard creates an organization (step 1 of 3), which would
  // otherwise unmount the wizard before its remaining steps run. Once we
  // decide to show it, keep showing it until the wizard itself says it's done.
  // Set during render (not an effect) per React's "adjusting state" pattern —
  // the `seen` guard makes this bail out after one extra render.
  const [onboardingActive, setOnboardingActive] = useState(false);
  const [seenNeedsOnboarding, setSeenNeedsOnboarding] = useState(false);
  if (needsOnboarding && !seenNeedsOnboarding) {
    setSeenNeedsOnboarding(true);
    setOnboardingActive(true);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-5 text-subtle" />
        <span className="sr-only">Loading your workspace…</span>
      </div>
    );
  }

  // Every dashboard route is scoped by organization, so there is nothing to
  // show until one exists.
  if (onboardingActive) {
    return <OrganizationSetup onFinish={() => setOnboardingActive(false)} />;
  }

  return (
    <div className="min-h-dvh bg-bg">
      <DesktopSidebar />
      <div className="lg:pl-64">
        <TopBar />
        <main id="main" className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
