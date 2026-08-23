import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Hero } from "@/components/marketing/Hero";
import { Credibility } from "@/components/marketing/Credibility";
import { Problem } from "@/components/marketing/Problem";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { AgentsSection } from "@/components/marketing/AgentsSection";
import { KnowledgeSection } from "@/components/marketing/KnowledgeSection";
import { ConversationsSection } from "@/components/marketing/ConversationsSection";
import { ActionsSection } from "@/components/marketing/ActionsSection";
import { AnalyticsSection } from "@/components/marketing/AnalyticsSection";
import { DevelopersSection } from "@/components/marketing/DevelopersSection";
import { PricingSection } from "@/components/marketing/PricingSection";
import { TryItSection } from "@/components/marketing/TryItSection";
import { FinalCta } from "@/components/marketing/FinalCta";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Credibility />
        <Problem />
        <HowItWorks />
        <AgentsSection />
        <KnowledgeSection />
        <ConversationsSection />
        <ActionsSection />
        <AnalyticsSection />
        <DevelopersSection />
        <PricingSection />
        <TryItSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
