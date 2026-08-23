import { cn } from '@/lib/utils';

interface SectionBadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionBadge({ children, className }: SectionBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3.5 py-1',
        'text-[11px] font-semibold uppercase tracking-[0.15em]',
        'border border-[var(--l-border-glow)] text-[var(--l-accent-indigo)]',
        'bg-[rgba(99,102,241,0.06)]',
        className,
      )}
    >
      {children}
    </span>
  );
}
