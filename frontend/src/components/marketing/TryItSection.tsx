"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { MessageCircle, Sparkles } from "lucide-react";
import { Section } from "./Section";
import { API_ORIGIN } from "@/lib/api";

const DEMO_API_KEY = process.env.NEXT_PUBLIC_DEMO_WIDGET_API_KEY;

const SUGGESTED_QUESTIONS = [
  "What does Support-AI actually do?",
  "How much does the Pro plan cost?",
  "What happens if the AI doesn't know the answer?",
  "Can I call this from my own backend?",
];

declare global {
  interface Window {
    SupportAIWidget?: {
      open: () => void;
      close: () => void;
      toggle: () => void;
      ask: (question: string) => void;
    };
  }
}

/**
 * Embeds the real product widget — pointed at an internal demo organization
 * whose knowledge base is the Support-AI product doc — so visitors can ask
 * it about the product itself instead of looking at a mockup.
 */
export function TryItSection() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!DEMO_API_KEY) return;
    const id = window.setInterval(() => {
      if (window.SupportAIWidget) {
        setReady(true);
        window.clearInterval(id);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  if (!DEMO_API_KEY) return null;

  const ask = (q: string) => window.SupportAIWidget?.ask(q);

  return (
    <Section
      id="try-it"
      index="10"
      eyebrow="Live demo"
      title="Want to see what I can do?"
      lede="This is the exact widget your customers would use — pointed at Support-AI's own documentation instead of yours. Ask it anything about the product; every answer is grounded and cited, live."
    >
      <Script
        src={`${API_ORIGIN}/static/widget.js`}
        data-api-key={DEMO_API_KEY}
        data-api-url={API_ORIGIN}
        data-welcome-message="Hi! I'm the exact widget your customers would use — except I'm answering questions about Support-AI itself. Ask me anything: pricing, features, how escalation works."
        data-suggested-questions={SUGGESTED_QUESTIONS.join("|")}
        strategy="lazyOnload"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={!ready}
            onClick={() => ask(q)}
            className="group flex items-center justify-between gap-3 rounded-panel border border-line bg-surface px-5 py-4 text-left text-[14px] text-fg transition-colors hover:border-accent/40 hover:bg-accent-soft disabled:cursor-wait disabled:opacity-60"
          >
            <span className="flex items-center gap-2.5">
              <Sparkles className="size-3.5 shrink-0 text-accent-text" aria-hidden="true" />
              {q}
            </span>
            <MessageCircle className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        ))}
      </div>

      <p className="mt-6 text-[13px] text-subtle">
        {ready
          ? "Click a question above, or open the chat in the bottom-right corner yourself."
          : "Loading the live widget…"}
      </p>
    </Section>
  );
}
