import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { HeroSection } from './HeroSection';
import { VideoBackground } from './shared/VideoBackground';
import { MagicBento } from '@/components/react-bits/MagicBento';
import { SectionWrapper } from './shared/SectionWrapper';
import { SectionBadge } from './shared/SectionBadge';
import { GradientText } from './shared/GradientText';

/* ── Section placeholder data ───────────────────────────────── */
const sections = [
  {
    id: 'social-proof',
    badge: null,
    title: 'Social Proof',
    description: 'Trust signals and metrics',
  },
  {
    id: 'problem',
    badge: 'THE PROBLEM',
    title: 'Traditional Support is Broken',
    description: 'The pain of conventional customer support',
  },
  {
    id: 'how-it-works',
    badge: 'HOW IT WORKS',
    title: 'The Support-AI Pipeline',
    description: 'From customer query to intelligent resolution',
  },
  {
    id: 'agents',
    badge: 'AI AGENTS',
    title: 'Specialist AI Agents',
    description: 'Intelligent routing and domain-specific expertise',
  },
  {
    id: 'knowledge',
    badge: 'KNOWLEDGE',
    title: 'Knowledge Base',
    description: 'RAG-powered retrieval and vector search',
  },
  {
    id: 'conversations',
    badge: 'CONVERSATIONS',
    title: 'Live Conversations',
    description: 'Real-time chat with streaming and memory',
  },
  {
    id: 'analytics',
    badge: 'ANALYTICS',
    title: 'Analytics & Insights',
    description: 'Usage tracking, metrics, and observability',
  },
  {
    id: 'pricing',
    badge: 'PRICING',
    title: 'Simple, Transparent Pricing',
    description: 'Plans for teams of every size',
  },
  {
    id: 'developers',
    badge: 'DEVELOPERS',
    title: 'Built for Developers',
    description: 'REST API, webhooks, and embeddable widgets',
  },
  {
    id: 'cta',
    badge: null,
    title: 'Ready to Transform Your Support?',
    description: 'Start building with Support-AI today',
  },
];

/* ── Landing page orchestrator ──────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="landing-page relative min-h-screen bg-[var(--l-bg-void)] text-[var(--l-text-primary)]">
      {/* Global video background across the entire website */}
      <VideoBackground />

      {/* Grain overlay for film texture */}
      <div className="landing-grain" aria-hidden="true" />
      <div className="landing-glow" aria-hidden="true" />

      <Navbar />

      <main className="relative z-10">
        {/* ── Hero ── */}
        <HeroSection />

        <div className="landing-divider" />

        {/* ── Remaining sections ── */}
        {sections.map((section, idx) => (
          <div key={section.id}>
            <SectionWrapper id={section.id}>
              <div className="flex flex-col items-center text-center">
                {section.badge && (
                  <SectionBadge className="mb-6">
                    {section.badge}
                  </SectionBadge>
                )}

                <GradientText
                  as="h2"
                  className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl"
                >
                  {section.title}
                </GradientText>

                {section.description && (
                  <p className="mt-4 max-w-xl text-base text-[var(--l-text-secondary)] md:text-lg">
                    {section.description}
                  </p>
                )}

                {section.id === 'agents' ? (
                  <div className="mt-12 w-full max-w-5xl">
                    <MagicBento
                      textAutoHide={false}
                      enableStars={true}
                      enableSpotlight={true}
                      enableBorderGlow={true}
                      enableTilt={true}
                      enableMagnetism={true}
                      clickEffect={true}
                      spotlightRadius={320}
                      particleCount={10}
                      glowColor="99, 102, 241"
                    />
                  </div>
                ) : (
                  /* Placeholder boundary */
                  <div className="mt-12 flex h-48 w-full max-w-3xl items-center justify-center rounded-xl border border-dashed border-[var(--l-border-subtle)]">
                    <span className="text-sm text-[var(--l-text-muted)]">
                      Section content coming next
                    </span>
                  </div>
                )}
              </div>
            </SectionWrapper>

            {idx < sections.length - 1 && (
              <div className="landing-divider" />
            )}
          </div>
        ))}
      </main>

      <Footer />
    </div>
  );
}
