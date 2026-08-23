import { cn } from '@/lib/utils';

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'span' | 'p';
}

export function GradientText({
  children,
  className,
  as: Tag = 'span',
}: GradientTextProps) {
  return (
    <Tag
      className={cn(
        'bg-gradient-to-r from-[var(--l-accent-indigo)] via-[var(--l-accent-violet)] to-[#EC4899]',
        'bg-clip-text text-transparent',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
