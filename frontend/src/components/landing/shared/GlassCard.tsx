import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ children, className, hover }: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--l-border-subtle)]',
        'bg-[rgba(12,12,29,0.5)] backdrop-blur-xl',
        hover &&
          'transition-all duration-300 hover:border-[var(--l-border-hover)] hover:bg-[rgba(12,12,29,0.7)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
