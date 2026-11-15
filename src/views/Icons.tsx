// One consistent line-icon set (24×24, 2px stroke, currentColor) instead of mixed emoji.
import type { Attr } from '../game';

type IconName =
  | 'today'
  | 'arena'
  | 'stats'
  | 'medal'
  | 'sliders'
  | 'staerke'
  | 'ausdauer'
  | 'beweglichkeit'
  | 'disziplin'
  | 'flame'
  | 'swap'
  | 'star'
  | 'check';

const PATHS: Record<IconName, JSX.Element> = {
  today: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 9l2 2 4-4M8 15h8" />
    </>
  ),
  arena: <path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2" />,
  stats: <path d="M4 20h16M7 20v-6M12 20V8M17 20v-9" />,
  medal: (
    <>
      <circle cx="12" cy="15" r="5" />
      <path d="M8.5 11.5L6 3h4l2 5 2-5h4l-2.5 8.5" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  staerke: <path d="M3 10v4M6 7v10M6 12h12M18 7v10M21 10v4" />,
  ausdauer: <path d="M2 12h4l3-7 5 14 3-7h5" />,
  beweglichkeit: <path d="M3 15c3-6 6-6 9 0s6 6 9 0M3 9c3-6 6-6 9 0" />,
  disziplin: <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3zM9 12l2 2 4-4" />,
  flame: <path d="M12 21c-4 0-7-3-7-7 0-4 4-6 4-10 3 2 5 5 5 8 1-1 2-3 2-4 2 2 3 4 3 6 0 4-3 7-7 7zM12 21c-2 0-3-1.5-3-3 0-2 3-4 3-4s3 2 3 4c0 1.5-1 3-3 3z" />,
  swap: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
};

export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

/** Square tile in the attribute colour with its icon: the visual key for every exercise. */
export function AttrTile({ attr, size = 'md' }: { attr: Attr; size?: 'sm' | 'md' }) {
  return (
    <span className={`attr-tile attr-${attr} ${size}`} aria-hidden>
      <Icon name={attr} size={size === 'sm' ? 16 : 22} />
    </span>
  );
}
