"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Button } from './shared/Button';

const navLinks = [
  { label: 'Features', id: 'agents' },
  { label: 'How it works', id: 'how-it-works' },
  { label: 'Developers', id: 'developers' },
  { label: 'Pricing', id: 'pricing' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  /* ── Scroll detection ── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Escape closes mobile menu ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* ── Lock body scroll when mobile menu is open ── */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  /* ── Smooth-scroll to anchor, accounting for navbar height ── */
  const scrollToSection = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault();
      setMobileOpen(false);
      document.body.style.overflow = '';

      // Small raf delay lets the mobile menu clear before scrolling
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) {
          const top =
            el.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      });
    },
    [],
  );

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-[rgba(6,6,14,0.8)] backdrop-blur-xl border-b border-[var(--l-border-subtle)]'
          : 'bg-transparent border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
        {/* ── Logo ── */}
        <Link href="/" className="relative flex shrink-0 items-center">
          <Image
            src="/logo.png"
            alt="Support AI"
            width={140}
            height={32}
            priority
            className="h-8 w-auto object-contain brightness-0 invert"
            style={{ width: 'auto', height: '32px' }}
          />
        </Link>

        {/* ── Desktop Links ── */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={(e) => scrollToSection(e, link.id)}
              className="text-sm font-medium text-[var(--l-text-secondary)] transition-colors duration-200 hover:text-[var(--l-text-primary)]"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* ── Desktop Actions ── */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--l-text-secondary)] transition-colors duration-200 hover:text-[var(--l-text-primary)]"
          >
            Log in
          </Link>
          <Button href="/register" size="sm">
            Get Started
          </Button>
        </div>

        {/* ── Mobile Hamburger ── */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="relative z-50 flex h-10 w-10 items-center justify-center md:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          <div className="relative h-[18px] w-5">
            <span
              className={cn(
                'absolute left-0 block h-[1.5px] w-5 bg-[var(--l-text-primary)] transition-all duration-300',
                mobileOpen ? 'top-2 rotate-45' : 'top-0',
              )}
            />
            <span
              className={cn(
                'absolute left-0 top-2 block h-[1.5px] w-5 bg-[var(--l-text-primary)] transition-all duration-300',
                mobileOpen && 'opacity-0',
              )}
            />
            <span
              className={cn(
                'absolute left-0 block h-[1.5px] w-5 bg-[var(--l-text-primary)] transition-all duration-300',
                mobileOpen ? 'top-2 -rotate-45' : 'top-4',
              )}
            />
          </div>
        </button>
      </div>

      {/* ── Mobile Menu ── */}
      <div
        className={cn(
          'fixed inset-0 top-16 z-40 bg-[var(--l-bg-void)] transition-all duration-300 md:hidden',
          mobileOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        )}
      >
        <div className="flex flex-col gap-1 px-6 pt-6 pb-8">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={(e) => scrollToSection(e, link.id)}
              className="rounded-lg px-4 py-3 text-base font-medium text-[var(--l-text-secondary)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--l-text-primary)]"
            >
              {link.label}
            </a>
          ))}

          <div className="mt-4 flex flex-col gap-3 border-t border-[var(--l-border-subtle)] pt-5">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-4 py-3 text-center text-base font-medium text-[var(--l-text-secondary)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--l-text-primary)]"
            >
              Log in
            </Link>
            <Button href="/register" size="md" className="w-full justify-center">
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
