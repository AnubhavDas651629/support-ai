"use client";

import { useEffect, useRef } from 'react';

/**
 * Lightweight ambient background for the Hero section.
 * Creates subtle moving light gradients and a delicate grid overlay.
 * Uses pure CSS transforms and canvas with low pixel ratio for maximum performance.
 */
export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth / 2);
    let height = (canvas.height = canvas.offsetHeight / 2);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth / 2;
      height = canvas.height = canvas.offsetHeight / 2;
    };

    window.addEventListener('resize', onResize);

    // Subtle floating light points
    const points = [
      { x: width * 0.3, y: height * 0.35, vx: 0.15, vy: 0.1, r: 120, color: 'rgba(99, 102, 241, 0.08)' },
      { x: width * 0.7, y: height * 0.45, vx: -0.12, vy: -0.08, r: 140, color: 'rgba(139, 92, 246, 0.06)' },
      { x: width * 0.5, y: height * 0.65, vx: 0.08, vy: -0.12, r: 100, color: 'rgba(34, 211, 238, 0.04)' },
    ];

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      points.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < width * 0.1 || p.x > width * 0.9) p.vx *= -1;
        if (p.y < height * 0.1 || p.y > height * 0.9) p.vy *= -1;

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Dynamic light canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full opacity-70"
      />

      {/* Subtle perspective grid lines */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.4) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.4) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage:
            'radial-gradient(ellipse at 50% 30%, black 20%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at 50% 30%, black 20%, transparent 75%)',
        }}
      />

      {/* Top ambient glow falloff */}
      <div
        className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.05) 40%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </div>
  );
}
