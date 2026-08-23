"use client";

import { ArrowRight } from 'lucide-react';
import { SectionWrapper } from './shared/SectionWrapper';
import { Button } from './shared/Button';
import { WarpText } from '@/components/react-bits/WarpText';

export function HeroSection() {
  const scrollToHowItWorks = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    const el = document.getElementById('how-it-works');
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <SectionWrapper
      id="hero"
      className="relative min-h-[85vh] flex items-center overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28 lg:pt-40 lg:pb-32"
      containerClassName="relative z-10 w-full"
    >
      {/* ── Asymmetric Editorial Layout ── */}
      <div className="max-w-2xl lg:max-w-[620px] text-left">
        {/* Subtle Category Marker */}
        <div className="mb-6 font-mono text-xs font-semibold tracking-[0.2em] uppercase text-[var(--l-accent-indigo)]">
          Support-AI / Platform
        </div>

        {/* ── Accessible Heading for SEO & Screen Readers ── */}
        <h1 className="sr-only">
          Read the docs. Check the database. Fix the problem.
        </h1>

        {/* ── Interactive WebGL WarpText Headline ── */}
        <div className="w-full">
          <WarpText
            text={`Read the docs.\nCheck the database.\nFix the problem.`}
            color={['#F0F0F5', '#F0F0F5', '#8B8BA3']}
            warpStrength={0.06}
            warpScale={1.5}
            speed={0.45}
            pointerInfluence={0.38}
            pointerStrength={0.35}
            refraction={0.015}
            ripple
            fontSize="clamp(2.5rem, 5.2vw, 4.15rem)"
            fontWeight={600}
            fontFamily="inherit"
            letterSpacing="-0.035em"
            lineHeight={1.12}
            textAlign="left"
            style={{ height: '230px', width: '100%' }}
          />
        </div>

        {/* ── Supporting Copy ── */}
        <p className="mt-8 max-w-lg text-base sm:text-lg text-[var(--l-text-secondary)] leading-relaxed font-normal">
          Support-AI connects your documentation, customer data, and live APIs to investigate issues, take action, and resolve requests without the back-and-forth.
        </p>

        {/* ── Action Triggers ── */}
        <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <Button href="/register" size="lg" className="group px-7 py-3 justify-center">
            <span>Get Started</span>
            <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Button>

          <Button
            href="#how-it-works"
            variant="secondary"
            size="lg"
            onClick={scrollToHowItWorks}
            className="px-6 py-3 justify-center"
          >
            <span>See how it works</span>
          </Button>
        </div>

        {/* ── Architectural Telemetry Row ── */}
        <div className="mt-16 pt-8 border-t border-[var(--l-border-subtle)] grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-lg text-left">
          <div>
            <div className="font-mono text-[11px] text-[var(--l-text-muted)] uppercase tracking-wider">
              Grounding
            </div>
            <div className="mt-1 text-sm font-medium text-[var(--l-text-primary)]">
              pgvector Hybrid RAG
            </div>
          </div>
          <div>
            <div className="font-mono text-[11px] text-[var(--l-text-muted)] uppercase tracking-wider">
              Action Layer
            </div>
            <div className="mt-1 text-sm font-medium text-[var(--l-text-primary)]">
              Live Tool & API Calling
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="font-mono text-[11px] text-[var(--l-text-muted)] uppercase tracking-wider">
              Escalation
            </div>
            <div className="mt-1 text-sm font-medium text-[var(--l-text-primary)]">
              Zero-Loss Hand-off
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
