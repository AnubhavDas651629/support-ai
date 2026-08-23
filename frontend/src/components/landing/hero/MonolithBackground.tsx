"use client";

import { useEffect, useRef } from 'react';

interface MonolithColumn {
  xPercent: number;     // X position percentage (0-100)
  widthPercent: number; // Width percentage
  topPercent: number;   // Top start offset percentage
  heightPercent: number;// Height percentage
  bandY: number;        // Current vertical position of the light slit (0 to 1)
  bandSpeed: number;    // Speed of the light slit
  bandHeight: number;   // Height of the illuminated band in px
  intensity: number;    // Brightness factor (0.4 to 1.0)
  color: string;        // RGB color tuple for the light band
}

/**
 * Architectural Monolithic Column Background
 * Inspired directly by the video reference:
 * - Staggered vertical monolithic columns
 * - Horizontal violet/indigo illuminated scanning slits
 * - Deep negative space on the left ensuring crisp headline contrast
 * - High-performance Canvas implementation with smooth RAF loop
 */
export function MonolithBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Monolithic columns positioned with right-hand asymmetric concentration
    // Left side (0-52%) is kept as pure negative space for typography
    const columns: MonolithColumn[] = [
      { xPercent: 54, widthPercent: 9.5, topPercent: 4, heightPercent: 82, bandY: 0.22, bandSpeed: 0.00045, bandHeight: 90, intensity: 0.85, color: '147, 51, 234' },
      { xPercent: 65, widthPercent: 10.5, topPercent: 0, heightPercent: 90, bandY: 0.70, bandSpeed: 0.00035, bandHeight: 110, intensity: 0.95, color: '124, 58, 237' },
      { xPercent: 77, widthPercent: 10, topPercent: 8, heightPercent: 76, bandY: 0.42, bandSpeed: 0.00055, bandHeight: 95, intensity: 0.85, color: '139, 92, 246' },
      { xPercent: 89, widthPercent: 9, topPercent: 0, heightPercent: 92, bandY: 0.84, bandSpeed: 0.0003, bandHeight: 80, intensity: 0.7, color: '99, 102, 241' },
    ];

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    // Subtle mouse parallax
    let targetMouseX = 0;
    let currentMouseX = 0;
    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 10;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      currentMouseX += (targetMouseX - currentMouseX) * 0.04;

      columns.forEach((col) => {
        const colX = (col.xPercent / 100) * width + currentMouseX;
        const colW = (col.widthPercent / 100) * width;
        const colY = (col.topPercent / 100) * height;
        const colH = (col.heightPercent / 100) * height;

        // 1. Draw monolithic column body (deep dark architectural plane)
        const colGrad = ctx.createLinearGradient(colX, colY, colX, colY + colH);
        colGrad.addColorStop(0, 'rgba(12, 12, 26, 0.7)');
        colGrad.addColorStop(0.5, 'rgba(16, 16, 36, 0.9)');
        colGrad.addColorStop(1, 'rgba(8, 8, 18, 0.7)');

        ctx.fillStyle = colGrad;
        ctx.fillRect(colX, colY, colW, colH);

        // 2. Subtle vertical edge highlight lines (beveled architectural edges)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(colX, colY);
        ctx.lineTo(colX, colY + colH);
        ctx.moveTo(colX + colW, colY);
        ctx.lineTo(colX + colW, colY + colH);
        ctx.stroke();

        // 3. Update light slit position
        if (!prefersReducedMotion) {
          col.bandY += col.bandSpeed;
          if (col.bandY > 1.05) col.bandY = -0.05;
        }

        const bandPixelY = colY + col.bandY * colH;
        const halfBand = col.bandHeight;

        // 4. Draw horizontal illuminated slit/band across the column
        const lightGrad = ctx.createLinearGradient(
          colX,
          bandPixelY - halfBand,
          colX,
          bandPixelY + halfBand,
        );

        const alpha = col.intensity;
        lightGrad.addColorStop(0, `rgba(${col.color}, 0)`);
        lightGrad.addColorStop(0.32, `rgba(${col.color}, ${alpha * 0.2})`);
        lightGrad.addColorStop(0.46, `rgba(${col.color}, ${alpha * 0.75})`);
        lightGrad.addColorStop(0.5, `rgba(245, 235, 255, ${alpha * 0.95})`); // Crisp luminescent horizontal core
        lightGrad.addColorStop(0.54, `rgba(${col.color}, ${alpha * 0.75})`);
        lightGrad.addColorStop(0.68, `rgba(${col.color}, ${alpha * 0.2})`);
        lightGrad.addColorStop(1, `rgba(${col.color}, 0)`);

        ctx.fillStyle = lightGrad;
        ctx.fillRect(colX, Math.max(colY, bandPixelY - halfBand), colW, Math.min(colH, halfBand * 2));

        // 5. Ambient glow blooming slightly past column edge
        const bloomGrad = ctx.createRadialGradient(
          colX + colW / 2,
          bandPixelY,
          colW * 0.1,
          colX + colW / 2,
          bandPixelY,
          colW * 1.3,
        );
        bloomGrad.addColorStop(0, `rgba(${col.color}, ${alpha * 0.18})`);
        bloomGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = bloomGrad;
        ctx.fillRect(colX - colW * 0.3, bandPixelY - halfBand * 1.3, colW * 1.6, halfBand * 2.6);
      });

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Monolithic columns canvas with left-to-right fade mask */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full opacity-60 sm:opacity-90"
        style={{
          maskImage:
            'linear-gradient(to right, transparent 0%, transparent 48%, black 68%, black 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0%, transparent 48%, black 68%, black 100%)',
        }}
      />

      {/* Top and bottom gradient blend */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#06060E] to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#06060E] to-transparent pointer-events-none" />
    </div>
  );
}
