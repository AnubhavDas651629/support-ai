"use client";

import { useEffect, useRef } from 'react';

/**
 * Global Video Background component
 * Serves the lightweight 'Background Studio Beams.mp4' loop across the entire landing page.
 * Uses fixed positioning, autoplay, loop, muted, playsInline, and subtle contrast overlays.
 */
export function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReducedMotion && videoRef.current) {
      videoRef.current.pause();
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover opacity-75 mix-blend-screen"
        src="/background-studio-beams.mp4"
      />

      {/* Subtle dark tint and vignette for optimal text readability */}
      <div className="absolute inset-0 bg-[#06060E]/40" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#06060E]/30 via-transparent to-[#06060E]/80" />
    </div>
  );
}
