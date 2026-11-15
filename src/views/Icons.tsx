// Line glyphs (24×24) and the 3D badge they sit on. No emoji anywhere: everything is drawn,
// so it looks the same on every phone.
import { useId } from 'react';
import type { Attr } from '../game';

const P: Record<string, JSX.Element> = {
  // navigation
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
  // attributes
  staerke: <path d="M3 10v4M6 7v10M6 12h12M18 7v10M21 10v4" />,
  ausdauer: <path d="M2 12h4l3-7 5 14 3-7h5" />,
  beweglichkeit: <path d="M3 15c3-6 6-6 9 0s6 6 9 0M3 9c3-6 6-6 9 0" />,
  disziplin: <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3zM9 12l2 2 4-4" />,
  // actions and state
  flame: <path d="M12 21c-4 0-7-3-7-7 0-4 4-6 4-10 3 2 5 5 5 8 1-1 2-3 2-4 2 2 3 4 3 6 0 4-3 7-7 7zM12 21c-2 0-3-1.5-3-3 0-2 3-4 3-4s3 2 3 4c0 1.5-1 3-3 3z" />,
  swap: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  // achievements
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  calendar: <path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2" />,
  chain: <path d="M10 14a4 4 0 0 1 0-5.6l2-2a4 4 0 0 1 5.6 5.6l-1 1M14 10a4 4 0 0 1 0 5.6l-2 2a4 4 0 0 1-5.6-5.6l1-1" />,
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4" />,
  mountain: <path d="M3 19l6-10 4 6 2-3 6 7zM8 10.5l1.5 1.5 1.5-1" />,
  arrowUp: <path d="M12 20V5M6 11l6-6 6 6" />,
  crown: <path d="M4 18h16L19 7l-4 4-3-6-3 6-4-4zM4 21h16" />,
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  run: <path d="M15 5.5a1.5 1.5 0 1 0 0-.1M10 21l2-5-3-3 2-5 3 3h3M9 13l-3 1M12 16l3 1 1 4" />,
  pencil: <path d="M4 20l4-1 11-11-3-3L5 16zM14 6l3 3" />,
  skull: (
    <>
      <path d="M12 3a8 8 0 0 0-5 14.2V20h10v-2.8A8 8 0 0 0 12 3zM10 20v-2M14 20v-2" />
      <circle cx="9" cy="11" r="1.6" />
      <circle cx="15" cy="11" r="1.6" />
    </>
  ),
  shield: <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />,
  horns: <path d="M4 4c1 6 4 9 8 9s7-3 8-9M12 13v2M8 20a4 4 0 0 1 8 0" />,
  steps: <path d="M8 3c2 0 3 2 3 5s-1 4-3 4-3-1-3-4 1-5 3-5zM6 15h4v1.5a2 2 0 0 1-4 0zM16 7c2 0 3 2 3 5s-1 4-3 4-3-1-3-4 1-5 3-5zM14 19h4v.5a2 2 0 0 1-4 0z" />,
  flag: <path d="M5 21V4M5 4h12l-2 4 2 4H5" />,
  // equipment
  tree: <path d="M12 21v-5M12 3l6 8h-3l4 5H5l4-5H6z" />,
  stairs: <path d="M3 20h5v-5h5v-5h5V5h3" />,
  kettlebell: (
    <>
      <path d="M9 9V7a3 3 0 0 1 6 0v2" />
      <circle cx="12" cy="15" r="6" />
    </>
  ),
  bar: <path d="M3 5h18M6 5v15M18 5v15M10 5v4a2 2 0 0 0 4 0V5" />,
  band: <path d="M4 12c4-6 12-6 16 0-4 6-12 6-16 0zM2 12h2M20 12h2" />,
  rope: <path d="M5 3h2v6H5zM17 3h2v6h-2zM6 9c0 9 12 9 12 0" />,
  bike: (
    <>
      <circle cx="6" cy="16" r="4" />
      <circle cx="18" cy="16" r="4" />
      <path d="M6 16l4-7h5l3 7M10 9l3 7M13 6h3" />
    </>
  ),
  treadmill: <path d="M3 18h15a2 2 0 0 0 0-4H5M16 14l2-9h3M7 18v2M15 18v2" />,
  pool: <path d="M2 17c2 2 4 2 6 0s4-2 6 0 4 2 6 0M2 21c2 2 4 2 6 0s4-2 6 0 4 2 6 0M8 14V5a2 2 0 0 1 4 0M14 14V5a2 2 0 0 1 4 0M8 9h6" />,
  gym: <path d="M4 21V8l8-5 8 5v13M9 21v-6h6v6M8 11h8" />,
};

export type IconName = keyof typeof P;

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
      {P[name]}
    </svg>
  );
}

// ---------- 3D badge ----------

export type Tone = 'staerke' | 'ausdauer' | 'beweglichkeit' | 'disziplin' | 'bronze' | 'silver' | 'gold' | 'hp' | 'neutral' | 'locked';

const TONES: Record<Tone, string> = {
  staerke: '#ff6b5b',
  ausdauer: '#3fc9bd',
  beweglichkeit: '#a985f2',
  disziplin: '#ffc93c',
  bronze: '#d4874d',
  silver: '#a9b4cf',
  gold: '#ffc93c',
  hp: '#ff4f7b',
  neutral: '#5d59b8',
  locked: '#4a4778',
};

export function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/**
 * A glossy, raised tile (or coin) with a glyph pressed into it: lit from the top,
 * a darker edge underneath, a highlight band on top.
 */
export function Badge3D({
  icon,
  tone,
  size = 44,
  shape = 'tile',
  className,
}: {
  icon: IconName;
  tone: Tone;
  size?: number;
  shape?: 'tile' | 'coin';
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const base = TONES[tone];
  const top = mix(base, '#ffffff', 0.32);
  const edge = mix(base, '#0b0a24', 0.5);
  const glyphShadow = mix(base, '#0b0a24', 0.55);
  const face =
    shape === 'coin' ? (fill: string, dy: number) => <circle cx="24" cy={24 + dy} r="21" fill={fill} /> : (fill: string, dy: number) => <rect x="3" y={3 + dy} width="42" height="42" rx="13" fill={fill} />;
  return (
    <svg className={className} width={size} height={size * (52 / 48)} viewBox="0 0 48 52" aria-hidden>
      <defs>
        <linearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={base} />
        </linearGradient>
      </defs>
      {face(edge, 5)}
      {face(`url(#f${id})`, 0)}
      <ellipse cx="24" cy="12" rx={shape === 'coin' ? 13 : 15} ry="5" fill="#fff" opacity="0.28" />
      {shape === 'coin' && <circle cx="24" cy="24" r="16.5" fill="none" stroke={edge} strokeOpacity="0.35" strokeWidth="1.5" />}
      <g transform="translate(12 13)" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4">
        <g stroke={glyphShadow} opacity="0.55">{P[icon]}</g>
      </g>
      <g transform="translate(12 12)" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4">
        {P[icon]}
      </g>
    </svg>
  );
}

/** The visual key for every exercise: a raised tile in the attribute colour. */
export function AttrTile({ attr, size = 'md' }: { attr: Attr; size?: 'sm' | 'md' }) {
  return <Badge3D icon={attr} tone={attr} size={size === 'sm' ? 30 : 46} className="attr-tile" />;
}
