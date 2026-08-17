'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { CravingFAB } from './CravingFAB';

type Tab = {
  href: string;
  label: string;
  icon: ReactNode;
};

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const TABS: Tab[] = [
  {
    href: '/',
    label: 'Today',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
      </svg>
    ),
  },
  {
    href: '/progress',
    label: 'Progress',
    icon: (
      <svg {...iconProps}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M7.5 15l3.5-4 3 2.5L20 7" />
      </svg>
    ),
  },
  {
    href: '/health',
    label: 'Health',
    icon: (
      <svg {...iconProps}>
        <path d="M12 20s-7-4.6-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6C19 15.4 12 20 12 20z" />
      </svg>
    ),
  },
  {
    href: '/you',
    label: 'You',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="10" r="3" />
        <path d="M5.8 18.4a7 7 0 0 1 12.4 0" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <Link
      href={tab.href}
      aria-current={active ? 'page' : undefined}
      className={`flex h-16 flex-1 flex-col items-center justify-center gap-1 transition-colors duration-[var(--dur-press)] ${
        active ? 'text-primary-strong' : 'text-ink-muted'
      }`}
    >
      {tab.icon}
      <span className="text-[11px] leading-none">{tab.label}</span>
    </Link>
  );
}

export function TabBar() {
  const pathname = usePathname();
  const [today, progress, health, you] = TABS;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch px-1">
        <TabLink tab={today} active={isActive(pathname, today.href)} />
        <TabLink tab={progress} active={isActive(pathname, progress.href)} />

        {/* Centre slot: the FAB sits in the gap, raised above the bar. */}
        <div className="relative w-20 shrink-0">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <CravingFAB />
          </div>
        </div>

        <TabLink tab={health} active={isActive(pathname, health.href)} />
        <TabLink tab={you} active={isActive(pathname, you.href)} />
      </div>
    </nav>
  );
}

export default TabBar;
