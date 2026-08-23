import { cn } from '@/lib/utils';

interface SectionWrapperProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

export function SectionWrapper({
  id,
  children,
  className,
  containerClassName,
}: SectionWrapperProps) {
  return (
    <section
      id={id}
      className={cn('relative scroll-mt-20 py-24 md:py-32', className)}
    >
      <div
        className={cn('mx-auto max-w-[1200px] px-6', containerClassName)}
      >
        {children}
      </div>
    </section>
  );
}
