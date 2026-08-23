"use client";

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  href?: string;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
}

const sizeStyles = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-8 py-3 text-base',
} as const;

const variantStyles = {
  primary: cn(
    'bg-[var(--l-accent-indigo)] text-white',
    'hover:bg-[#5558E6]',
    'btn-glow',
    'border border-[rgba(99,102,241,0.5)]',
  ),
  secondary: cn(
    'bg-[rgba(255,255,255,0.04)] text-[var(--l-text-primary)]',
    'hover:bg-[rgba(255,255,255,0.08)]',
    'border border-[var(--l-border-subtle)]',
    'hover:border-[var(--l-border-hover)]',
  ),
} as const;

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  href,
  className,
  onClick,
}: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center rounded-lg font-medium',
    'transition-all duration-200 cursor-pointer select-none',
    sizeStyles[size],
    variantStyles[variant],
    className,
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
