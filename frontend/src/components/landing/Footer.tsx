import Image from 'next/image';

const footerLinks = {
  Product: [
    { label: 'AI Agents', href: '#agents' },
    { label: 'Knowledge Base', href: '#knowledge' },
    { label: 'Conversations', href: '#conversations' },
    { label: 'Analytics', href: '#analytics' },
    { label: 'Pricing', href: '#pricing' },
  ],
  Developers: [
    { label: 'API Reference', href: '#developers' },
    { label: 'Webhooks', href: '#developers' },
    { label: 'Widget SDK', href: '#developers' },
    { label: 'Documentation', href: '#' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Contact', href: '#' },
  ],
};

export function Footer() {
  return (
    <footer className="relative border-t border-[var(--l-border-subtle)]">
      <div className="mx-auto max-w-[1200px] px-6 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Image
              src="/logo.png"
              alt="Support AI"
              width={120}
              height={28}
              className="mb-4 h-7 w-auto object-contain brightness-0 invert"
              style={{ width: 'auto', height: '28px' }}
            />
            <p className="max-w-[240px] text-sm leading-relaxed text-[var(--l-text-muted)]">
              AI-powered customer support infrastructure for modern teams.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--l-text-muted)]">
                {category}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[var(--l-text-secondary)] transition-colors duration-200 hover:text-[var(--l-text-primary)]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-[var(--l-border-subtle)] pt-8 md:flex-row">
          <p className="text-sm text-[var(--l-text-muted)]">
            &copy; {new Date().getFullYear()} Support AI. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="text-sm text-[var(--l-text-muted)] transition-colors hover:text-[var(--l-text-secondary)]"
            >
              Privacy
            </a>
            <a
              href="#"
              className="text-sm text-[var(--l-text-muted)] transition-colors hover:text-[var(--l-text-secondary)]"
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
