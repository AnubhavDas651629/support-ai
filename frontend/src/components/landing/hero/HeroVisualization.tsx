"use client";

import { useState, useEffect, useRef } from 'react';
import {
  Bot,
  User,
  Database,
  Truck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Play,
  Pause,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function HeroVisualization() {
  // Steps: 0: Message, 1: Routing, 2: Context Retrieval, 3: Synthesis, 4: Resolved
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);
    if (mediaQuery.matches) {
      setStep(4); // Instant complete state
      setIsPlaying(false);
    }
  }, []);

  // Animation timeline progression
  useEffect(() => {
    if (!isPlaying || isReducedMotion) return;

    const stepDelays = [
      1200, // Step 0 -> Step 1 (Message enters -> Routing starts)
      1400, // Step 1 -> Step 2 (Routing complete -> Knowledge retrieved)
      1600, // Step 2 -> Step 3 (Context loaded -> Generating response)
      2200, // Step 3 -> Step 4 (Response delivered -> Resolved state)
      7000, // Step 4 -> Step 0 (Calm dwell before smooth replay)
    ];

    timerRef.current = setTimeout(() => {
      setStep((prev) => (prev >= 4 ? 0 : prev + 1));
    }, stepDelays[step]);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [step, isPlaying, isReducedMotion]);

  const handleStepClick = (targetStep: number) => {
    setIsPlaying(false);
    setStep(targetStep);
  };

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleReset = () => {
    setStep(0);
    setIsPlaying(true);
  };

  return (
    <div className="relative mx-auto mt-12 w-full max-w-5xl md:mt-16">
      {/* Outer ambient glow centered on the visualization */}
      <div
        className="pointer-events-none absolute -inset-4 rounded-3xl opacity-40 blur-2xl transition-all duration-700 md:-inset-8"
        style={{
          background:
            step >= 3
              ? 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.25), rgba(16, 185, 129, 0.12), transparent 70%)'
              : 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.1), transparent 70%)',
        }}
      />

      {/* Main Console Frame */}
      <div className="relative rounded-2xl border border-[var(--l-border-subtle)] bg-[rgba(12,12,29,0.75)] shadow-2xl backdrop-blur-2xl transition-all duration-500 hover:border-[var(--l-border-hover)]">
        {/* Top Console Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--l-border-subtle)] px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
            </div>
            <div className="h-3.5 w-px bg-[var(--l-border-subtle)]" />
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--l-accent-indigo)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--l-accent-indigo)]" />
              </span>
              <span className="font-mono text-[11px] font-medium text-[var(--l-text-muted)] tracking-wider uppercase">
                Support-AI Runtime • Live Simulation
              </span>
            </div>
          </div>

          {/* Interactive Timeline Stepper & Controls */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 rounded-lg border border-[var(--l-border-subtle)] bg-[rgba(6,6,14,0.6)] p-1 text-[11px]">
              {[
                { label: 'Query', num: 0 },
                { label: 'Route', num: 1 },
                { label: 'Knowledge', num: 2 },
                { label: 'Synthesis', num: 3 },
                { label: 'Resolved', num: 4 },
              ].map((s) => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => handleStepClick(s.num)}
                  className={cn(
                    'rounded px-2 py-0.5 font-medium transition-all duration-200 cursor-pointer',
                    step === s.num
                      ? 'bg-[var(--l-accent-indigo)] text-white shadow-sm'
                      : 'text-[var(--l-text-muted)] hover:text-[var(--l-text-primary)]',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Play/Pause & Reset */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--l-border-subtle)] bg-[rgba(255,255,255,0.03)] text-[var(--l-text-muted)] hover:border-[var(--l-border-hover)] hover:text-[var(--l-text-primary)] transition-colors cursor-pointer"
                title={isPlaying ? 'Pause simulation' : 'Play simulation'}
                aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
              >
                {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--l-border-subtle)] bg-[rgba(255,255,255,0.03)] text-[var(--l-text-muted)] hover:border-[var(--l-border-hover)] hover:text-[var(--l-text-primary)] transition-colors cursor-pointer"
                title="Restart simulation"
                aria-label="Restart simulation"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Grid: Satellite Nodes + Central Stream */}
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-6">
            
            {/* ── Left Satellite: Customer & Order Context ── */}
            <div className="flex flex-col gap-4 lg:col-span-4">
              {/* Customer Profile Card */}
              <div
                className={cn(
                  'rounded-xl border p-4 transition-all duration-500',
                  step >= 0
                    ? 'border-[var(--l-border-subtle)] bg-[rgba(19,19,43,0.5)]'
                    : 'border-transparent opacity-60',
                )}
              >
                <div className="flex items-center justify-between pb-3 border-b border-[var(--l-border-subtle)]">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(99,102,241,0.15)] text-[var(--l-accent-indigo)]">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[var(--l-text-primary)]">
                        Sarah Jenkins
                      </div>
                      <div className="font-mono text-[10px] text-[var(--l-text-muted)]">
                        UID #USR-8924
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    Pro Tier
                  </span>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[var(--l-text-muted)]">
                    <span>Recent Order</span>
                    <span className="font-mono font-medium text-[var(--l-text-primary)]">
                      #4821
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--l-text-muted)]">
                    <span>Item</span>
                    <span className="text-[var(--l-text-secondary)] truncate max-w-[180px]">
                      AeroPro Mechanical Keyboard
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--l-text-muted)]">
                    <span>Order Value</span>
                    <span className="font-mono text-[var(--l-text-secondary)]">$149.00</span>
                  </div>
                </div>
              </div>

              {/* Connected Knowledge & Logistics Satellite */}
              <div
                className={cn(
                  'rounded-xl border p-4 transition-all duration-500',
                  step >= 2
                    ? 'border-[var(--l-border-glow)] bg-[rgba(19,19,43,0.7)] shadow-lg shadow-indigo-500/5'
                    : 'border-[var(--l-border-subtle)] bg-[rgba(19,19,43,0.3)] opacity-70',
                )}
              >
                <div className="flex items-center justify-between pb-3 border-b border-[var(--l-border-subtle)]">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-[var(--l-accent-cyan)]" />
                    <span className="text-xs font-semibold text-[var(--l-text-primary)]">
                      pgvector RAG Retrieval
                    </span>
                  </div>
                  <span
                    className={cn(
                      'font-mono text-[10px] transition-colors',
                      step >= 2 ? 'text-[var(--l-accent-cyan)] font-medium' : 'text-[var(--l-text-muted)]',
                    )}
                  >
                    {step >= 2 ? '99.4% Match' : 'Standby'}
                  </span>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div className="rounded-lg border border-[var(--l-border-subtle)] bg-[rgba(6,6,14,0.4)] p-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--l-text-muted)]">
                      <span>doc_shipping_sla.md</span>
                      <span className="text-emerald-400">chunk #3</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-[var(--l-text-secondary)]">
                      &quot;Orders with Priority Air transit guarantee 48hr delivery window...&quot;
                    </p>
                  </div>

                  {/* Carrier Status */}
                  <div className="flex items-center justify-between rounded-lg border border-[var(--l-border-subtle)] bg-[rgba(6,6,14,0.4)] p-2">
                    <div className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-indigo-400" />
                      <span className="font-mono text-[11px] text-[var(--l-text-secondary)]">
                        FedEx Tracking API
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-emerald-400 font-medium">
                      In Transit
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Center / Right Stream: Live Conversation & AI Orchestration ── */}
            <div className="flex flex-col gap-4 lg:col-span-8">
              
              {/* Agent Orchestrator Header Pill */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--l-border-subtle)] bg-[rgba(19,19,43,0.4)] px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[var(--l-text-primary)]">
                      Support-AI Specialist Agent
                    </span>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--l-text-muted)]">
                      <span>Route: ORDER_LOGISTICS</span>
                      <span>•</span>
                      <span>Latency: 142ms</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Zero Hallucination Guard
                  </span>
                </div>
              </div>

              {/* Live Chat & Reasoning Container */}
              <div className="flex flex-col gap-3 rounded-xl border border-[var(--l-border-subtle)] bg-[rgba(6,6,14,0.7)] p-4 sm:p-5">
                
                {/* 1. Inbound Customer Message */}
                <div
                  className={cn(
                    'flex items-start gap-3 transition-all duration-500',
                    step >= 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
                  )}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] text-[var(--l-text-secondary)]">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[var(--l-text-primary)]">
                        Sarah Jenkins
                      </span>
                      <span className="text-[10px] text-[var(--l-text-muted)]">Just now</span>
                    </div>
                    <div className="mt-1.5 inline-block rounded-2xl rounded-tl-none bg-[rgba(255,255,255,0.06)] px-4 py-2.5 text-sm text-[var(--l-text-primary)] border border-[var(--l-border-subtle)]">
                      Where is my order?
                    </div>
                  </div>
                </div>

                {/* 2. System Status Events Checklist */}
                <div
                  className={cn(
                    'my-1 rounded-xl border border-[var(--l-border-subtle)] bg-[rgba(19,19,43,0.35)] p-3 transition-all duration-500',
                    step >= 1 ? 'opacity-100 max-h-48' : 'opacity-30',
                  )}
                >
                  <div className="mb-2 flex items-center justify-between text-[11px] font-mono text-[var(--l-text-muted)] uppercase tracking-wider">
                    <span>System Execution Pipeline</span>
                    <span className="text-indigo-400">
                      {step >= 3 ? 'Completed' : 'Processing...'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      { text: 'Customer & order #4821 identified', activeAt: 1 },
                      { text: 'pgvector retrieved shipping SLA', activeAt: 2 },
                      { text: 'FedEx real-time status synced', activeAt: 2 },
                      { text: 'Verified response synthesized', activeAt: 3 },
                    ].map((item, idx) => {
                      const isComplete = step >= item.activeAt;
                      return (
                        <div
                          key={idx}
                          className={cn(
                            'flex items-center gap-2 text-xs transition-all duration-300',
                            isComplete
                              ? 'text-[var(--l-text-primary)]'
                              : 'text-[var(--l-text-muted)] opacity-50',
                          )}
                        >
                          <CheckCircle2
                            className={cn(
                              'h-3.5 w-3.5 shrink-0 transition-colors',
                              isComplete ? 'text-emerald-400' : 'text-[var(--l-text-muted)]',
                            )}
                          />
                          <span className="truncate">{item.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. AI Agent Response */}
                <div
                  className={cn(
                    'flex items-start gap-3 transition-all duration-500',
                    step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
                  )}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--l-accent-indigo)] to-[var(--l-accent-violet)] text-white shadow-md shadow-indigo-500/20">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--l-text-primary)]">
                        Support-AI
                      </span>
                      <span className="rounded bg-indigo-500/10 px-1.5 py-0.2 font-mono text-[9px] font-medium text-indigo-400 border border-indigo-500/20">
                        AI Agent
                      </span>
                    </div>

                    <div className="mt-1.5 rounded-2xl rounded-tl-none border border-[var(--l-border-glow)] bg-[rgba(19,19,43,0.85)] p-4 text-sm text-[var(--l-text-primary)] shadow-lg shadow-indigo-500/5 leading-relaxed">
                      <p>
                        Your order <strong className="text-white font-mono">#4821</strong> (AeroPro Mechanical Keyboard) is currently <span className="text-emerald-400 font-medium">out for delivery</span> with FedEx.
                      </p>
                      <p className="mt-2 text-[var(--l-text-secondary)] text-xs">
                        It is estimated to arrive at your address <strong className="text-[var(--l-text-primary)]">tomorrow by 2:00 PM</strong>.
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--l-border-subtle)]">
                        <a
                          href="#"
                          onClick={(e) => e.preventDefault()}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--l-border-subtle)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-xs text-[var(--l-accent-cyan)] hover:border-[var(--l-border-hover)] hover:bg-[rgba(255,255,255,0.08)] transition-colors"
                        >
                          <span>Track Package (FedEx #98214)</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>

                        <span className="font-mono text-[10px] text-[var(--l-text-muted)] ml-auto">
                          Grounded in Verified Context
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>

        {/* Bottom Metrics Ticker */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--l-border-subtle)] bg-[rgba(6,6,14,0.5)] px-4 py-3 sm:px-6 text-xs text-[var(--l-text-muted)]">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Resolution Rate: <strong className="text-[var(--l-text-primary)] font-mono">87.4%</strong></span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              <span>Avg First Response: <strong className="text-[var(--l-text-primary)] font-mono">&lt; 250ms</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--l-text-secondary)]">
            <span>Demo Data • Simulated Live Pipeline</span>
          </div>
        </div>

      </div>
    </div>
  );
}
