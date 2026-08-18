'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useMessages, type Messages } from '@/lib/i18n';
import { CravingFAB } from './CravingFAB';

type Tab = {
  href: string;
  labelKey: keyof Messages['chrome']['tabs'];
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

/**
 * Source of truth for the bar, in visual order. The FAB slot splits it:
 * everything before `LEFT_COUNT` sits left of the craving button, the rest
 * right of it. Uneven on purpose — three left, two right — which is exactly
 * why each side gets its own equal-width flex container rather than five
 * siblings sharing one row (see `TabBar`).
 */
const LEFT_COUNT = 3;

const TABS: Tab[] = [
  {
    href: '/',
    labelKey: 'today',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
      </svg>
    ),
  },
  {
    href: '/progress',
    labelKey: 'progress',
    icon: (
      <svg {...iconProps}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M7.5 15l3.5-4 3 2.5L20 7" />
      </svg>
    ),
  },
  {
    href: '/freedom',
    labelKey: 'freedom',
    icon: (
      <svg {...iconProps}>
        {/* The door frame, and the floor it stands on. */}
        <path d="M13.5 4.6h4V20" />
        <path d="M4.5 20h2M13.5 20h6" />
        {/* The door itself, swung open toward you. */}
        <path d="M13.5 3.6 6.5 5.8V20h7z" />
        <circle cx="10.6" cy="12.4" r="0.85" />
      </svg>
    ),
  },
  {
    href: '/health',
    labelKey: 'health',
    icon: (
      <svg {...iconProps}>
        <path d="M12 20s-7-4.6-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6C19 15.4 12 20 12 20z" />
      </svg>
    ),
  },
  {
    href: '/you',
    labelKey: 'you',
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
  const m = useMessages();
  return (
    <Link
      href={tab.href}
      aria-current={active ? 'page' : undefined}
      className={`flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 transition-colors duration-[var(--dur-press)] ${
        active ? 'text-primary-strong' : 'text-ink-muted'
      }`}
    >
      {tab.icon}
      {/* `min-w-0` above plus `truncate` here: on a 320px-wide phone three
          labels no longer fit their third of the row, and without these the
          widest one ("Progress") would push the whole bar — and the FAB with
          it — off centre. */}
      <span className="max-w-full truncate text-[11px] leading-none">{m.chrome.tabs[tab.labelKey]}</span>
    </Link>
  );
}

export function TabBar() {
  const pathname = usePathname();
  const m = useMessages();
  const left = TABS.slice(0, LEFT_COUNT);
  const right = TABS.slice(LEFT_COUNT);

  return (
    <nav
      aria-label={m.chrome.primaryNav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch px-1">
        {/* Two equal-width groups flanking a fixed centre slot. The groups
            are what keeps the FAB on the geometric centre of the bar: they
            share the leftover width evenly no matter how many tabs each
            holds, so three-on-the-left and two-on-the-right stays balanced.
            (Five flat `flex-1` siblings would not — the FAB would drift.) */}
        <div className="flex flex-1 items-stretch">
          {left.map((tab) => (
            <TabLink key={tab.href} tab={tab} active={isActive(pathname, tab.href)} />
          ))}
        </div>

        {/* Centre slot: the FAB sits in the gap, raised above the bar. */}
        <div className="relative w-20 shrink-0">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <CravingFAB />
          </div>
        </div>

        <div className="flex flex-1 items-stretch">
          {right.map((tab) => (
            <TabLink key={tab.href} tab={tab} active={isActive(pathname, tab.href)} />
          ))}
        </div>
      </div>
    </nav>
  );
}

export default TabBar;
