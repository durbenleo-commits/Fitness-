// RPG monster sprites: hand-built SVG creatures with a dark outline and cel shading.
// Original designs, one per enemy. viewBox 0 0 120 120, feet on y≈112.
import { useId } from 'react';

const OUT = '#1b1535';
const SW = 3;

// ---------- shape helpers (all return path data) ----------

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;

/** A filled part with cel shading (darker crescent bottom right) and an outline. */
function Part({ d, fill, shade, uid, k, shift = [-6, -6], stroke = true }: { d: string; fill: string; shade: string; uid: string; k: string; shift?: [number, number]; stroke?: boolean }) {
  const id = `${uid}${k}`;
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <path d={d} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <path d={d} fill={shade} />
        <path d={d} fill={fill} transform={`translate(${shift[0]} ${shift[1]})`} />
      </g>
      {stroke && <path d={d} fill="none" stroke={OUT} strokeWidth={SW} strokeLinejoin="round" />}
    </g>
  );
}

/** Plain outlined shape without shading (small details). */
const Flat = ({ d, fill, sw = SW }: { d: string; fill: string; sw?: number }) => <path d={d} fill={fill} stroke={OUT} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />;
const Line = ({ d, sw = SW, color = OUT }: { d: string; sw?: number; color?: string }) => <path d={d} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />;

function Eye({ x, y, r = 5.5, look = [1, 0.5], lid = 0, glow }: { x: number; y: number; r?: number; look?: [number, number]; lid?: number; glow?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={glow ?? '#fffaf0'} stroke={OUT} strokeWidth={2.2} />
      <circle cx={x + look[0] * r * 0.35} cy={y + look[1] * r * 0.35} r={r * 0.48} fill={OUT} />
      <circle cx={x + look[0] * r * 0.35 - r * 0.18} cy={y + look[1] * r * 0.35 - r * 0.2} r={r * 0.16} fill="#fff" />
      {lid > 0 && (
        // heavy upper eyelid: a half disc in skin colour over the top of the eye
        <path d={`M${x - r - 0.8} ${y + r * (lid - 0.6)}A${r + 0.8} ${r + 0.8} 0 0 1 ${x + r + 0.8} ${y + r * (lid - 0.6)}Z`} fill="currentColor" stroke={OUT} strokeWidth={2.2} strokeLinejoin="round" />
      )}
    </g>
  );
}

const Shadow = ({ cx = 60, rx = 34 }: { cx?: number; rx?: number }) => <ellipse cx={cx} cy={113} rx={rx} ry={5} fill="#05031a" opacity={0.45} />;

// ---------- the monsters ----------

type Sprite = (uid: string) => JSX.Element;

const SPRITES: Record<string, Sprite> = {
  // An olive troll sunk into a red couch, remote in hand, eyes half shut.
  'sofa-troll': (u) => (
    <g color="#7c8a4a">
      <Shadow rx={44} />
      <Part uid={u} k="c1" d="M14 70h92a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V76a6 6 0 0 1 6-6z" fill="#c8464a" shade="#8f2b35" />
      <Part uid={u} k="c2" d="M20 52h80v26H20z" fill="#d85a5c" shade="#a3363f" />
      <Part uid={u} k="b" d="M60 34c18 0 28 12 28 30 0 16-12 32-28 32S32 80 32 64c0-18 10-30 28-30z" fill="#9bab5b" shade="#6e7b3c" />
      <Flat d="M42 36l-14-8 5 15zM78 36l14-8-5 15z" fill="#a8b866" />
      <Part uid={u} k="h" d={ellipse(60, 38, 20, 17)} fill="#a8b866" shade="#7a8843" />
      <Eye x={52} y={38} r={5.5} lid={0.6} />
      <Eye x={68} y={38} r={5.5} lid={0.6} />
      <Line d="M53 49q7 4 14 0" sw={2.5} />
      <Flat d="M54 49l2 5 2-4zM62 49l2 4 2-5z" fill="#fffaf0" sw={1.8} />
      <Part uid={u} k="a" d="M84 64c8 4 12 12 8 18l-6-2c2-4-1-8-6-10z" fill="#9bab5b" shade="#6e7b3c" />
      <Flat d="M86 76l10-3 3 8-10 3z" fill="#2b2b3a" />
      <circle cx={95} cy={76} r={1.4} fill="#ff4f7b" />
      <Line d="M52 22q3-7 7-2 3-6 7 1" sw={2.5} />
    </g>
  ),

  // Small purple gremlin with bat ears, a striped night cap and an alarm clock.
  'snooze-gremlin': (u) => (
    <g color="#6b4fa8">
      <Shadow rx={26} />
      <Part uid={u} k="e1" d="M40 52L14 34l8 28z" fill="#a37be0" shade="#7a56b8" />
      <Part uid={u} k="e2" d="M80 52l26-18-8 28z" fill="#a37be0" shade="#7a56b8" />
      <Part uid={u} k="b" d="M60 46c16 0 24 14 24 32s-8 30-24 30-24-12-24-30 8-32 24-32z" fill="#9a72dc" shade="#6b4fa8" />
      <Part uid={u} k="f1" d="M46 104h10v8H44z" fill="#9a72dc" shade="#6b4fa8" />
      <Part uid={u} k="f2" d="M64 104h10l2 8H64z" fill="#9a72dc" shade="#6b4fa8" />
      <Part uid={u} k="cap" d="M38 52c4-18 20-28 40-22l16 10-6 4-10-4c4 4 6 8 6 12z" fill="#3ec9bd" shade="#279a90" />
      <Line d="M50 40l6 8M62 34l6 10M74 34l4 12" sw={3} color="#fffaf0" />
      <circle cx={92} cy={46} r={5} fill="#fffaf0" stroke={OUT} strokeWidth={2.2} />
      <Eye x={52} y={66} r={6} lid={0.75} />
      <Eye x={68} y={66} r={6} lid={0.75} />
      <ellipse cx={60} cy={82} rx={4} ry={5} fill={OUT} />
      <Part uid={u} k="clk" d={circle(88, 90, 10)} fill="#ffd23f" shade="#d29c1a" />
      <circle cx={88} cy={90} r={6.5} fill="#fffaf0" stroke={OUT} strokeWidth={1.8} />
      <Line d="M88 86v4l3 2" sw={1.8} />
      <Flat d="M80 80l-3-4M96 80l3-4" fill="none" sw={2.4} />
      <text x={98} y={30} fill="#fffaf0" fontSize={13} fontWeight={800} fontFamily="system-ui,sans-serif" stroke={OUT} strokeWidth={0.8}>
        Z
      </text>
    </g>
  ),

  // Hunched zombie lit by the phone it cannot put down.
  'handy-zombie': (u) => (
    <g color="#4d8a63">
      <Shadow rx={30} />
      <Part uid={u} k="l1" d="M48 96h9l-1 14H46z" fill="#4a3f6e" shade="#33295a" />
      <Part uid={u} k="l2" d="M64 96h9l2 14H65z" fill="#4a3f6e" shade="#33295a" />
      <Part uid={u} k="b" d="M42 60c2-10 10-14 20-14s18 6 18 16l-2 36H44z" fill="#6f6aa8" shade="#4a4580" />
      <Line d="M50 72l6 6M70 66l-4 8" sw={2.2} />
      <Part uid={u} k="h" d="M60 18c14 0 22 10 22 22s-8 20-22 20-22-8-22-20 8-22 22-22z" fill="#86c296" shade="#5d9a6e" />
      <Line d="M68 22l2 6M66 25h6" sw={2} />
      <g>
        <circle cx={52} cy={38} r={6} fill="#d6ffe9" stroke={OUT} strokeWidth={2.2} />
        <circle cx={68} cy={38} r={6} fill="#d6ffe9" stroke={OUT} strokeWidth={2.2} />
        <path d="M52 38m-1 0a1.5 1.5 0 1 1 3 0 3 3 0 1 1-6 0 4.4 4.4 0 1 1 8.8 0" fill="none" stroke={OUT} strokeWidth={1.4} />
        <path d="M68 38m-1 0a1.5 1.5 0 1 1 3 0 3 3 0 1 1-6 0 4.4 4.4 0 1 1 8.8 0" fill="none" stroke={OUT} strokeWidth={1.4} />
      </g>
      <Flat d="M52 50h16v5H52z" fill={OUT} sw={1.5} />
      <Flat d="M55 50v3M60 50v4M65 50v3" fill="none" sw={1.5} />
      <Part uid={u} k="a1" d="M44 64l-10 18 6 4 10-14z" fill="#86c296" shade="#5d9a6e" />
      <Part uid={u} k="a2" d="M76 64l12 14-6 6-10-12z" fill="#86c296" shade="#5d9a6e" />
      <g transform="rotate(-14 84 86)">
        <Flat d="M78 74h14a2 2 0 0 1 2 2v22a2 2 0 0 1-2 2H78a2 2 0 0 1-2-2V76a2 2 0 0 1 2-2z" fill="#22203a" />
        <rect x={79} y={77} width={12} height={18} rx={1} fill="#5ef0e0" />
      </g>

    </g>
  ),

  // A floating ghost holding up its favourite excuse.
  'ausreden-geist': (u) => (
    <g color="#a9b8ff">
      <Shadow rx={22} />
      <g opacity={0.95}>
        <Part uid={u} k="b" d="M30 98V54c0-20 14-34 30-34s30 14 30 34v44l-8-6-7 8-8-8-7 8-8-8-7 8z" fill="#e8ecff" shade="#b6bfec" />
      </g>
      <Part uid={u} k="arm" d="M86 62l10-6 4 6-10 8z" fill="#e8ecff" shade="#b6bfec" />
      <Line d="M100 40v18" sw={3} />
      <Flat d="M84 22h32v18H84z" fill="#ffd23f" />
      <text x={100} y={34.5} textAnchor="middle" fill={OUT} fontSize={7.5} fontWeight={900} fontFamily="system-ui,sans-serif">
        MORGEN!
      </text>
      <ellipse cx={50} cy={50} rx={6} ry={8} fill={OUT} />
      <ellipse cx={68} cy={50} rx={6} ry={8} fill={OUT} />
      <circle cx={48} cy={47} r={2} fill="#fff" />
      <circle cx={66} cy={47} r={2} fill="#fff" />
      <ellipse cx={59} cy={68} rx={5} ry={7} fill={OUT} />
      <ellipse cx={42} cy={60} rx={5} ry={3} fill="#ff9db5" opacity={0.6} />
      <ellipse cx={76} cy={60} rx={5} ry={3} fill="#ff9db5" opacity={0.6} />
    </g>
  ),

  // An orange octopus that wraps you in cushions.
  'couch-krake': (u) => (
    <g color="#d0563a">
      <Shadow rx={42} />
      {[
        'M40 80c-14 4-24 14-26 28l8 2c2-10 10-18 22-22z',
        'M50 86c-6 8-8 16-6 24h8c-2-6 0-14 4-20z',
        'M70 86c6 8 8 16 6 24h-8c2-6 0-14-4-20z',
        'M80 80c14 4 24 14 26 28l-8 2c-2-10-10-18-22-22z',
      ].map((d, i) => (
        <Part key={i} uid={u} k={`t${i}`} d={d} fill="#ff7a52" shade="#c94e30" />
      ))}
      <Part uid={u} k="t5" d="M34 70c-12-6-20-2-24 6l6 4c4-4 8-6 14-2z" fill="#ff7a52" shade="#c94e30" />
      <Part uid={u} k="cush" d="M2 64l14-10 14 10-14 12z" fill="#ffd23f" shade="#d29c1a" />
      <Part uid={u} k="b" d="M60 22c20 0 32 16 32 34 0 18-14 30-32 30S28 74 28 56c0-18 12-34 32-34z" fill="#ff8a5e" shade="#cf5a36" />
      {[[44, 36], [74, 30], [80, 48], [40, 56]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="#ffb59a" />
      ))}
      <Eye x={50} y={56} r={7} look={[0.6, 0.3]} />
      <Eye x={70} y={56} r={7} look={[-0.2, 0.3]} />
      <Line d="M40 46l14 5M80 46l-14 5" sw={3.5} />
      <Line d="M52 72q8 5 16-2" sw={3} />
    </g>
  ),

  // A golem stacked from crispy chip shards, crumbs falling off.
  'chips-golem': (u) => (
    <g color="#c98a1e">
      <Shadow rx={34} />
      <Part uid={u} k="l1" d="M42 94l12-2 2 18H40z" fill="#e8a93a" shade="#b07a1e" />
      <Part uid={u} k="l2" d="M64 92l12 2 2 16H64z" fill="#e8a93a" shade="#b07a1e" />
      <Part uid={u} k="b" d="M34 58l18-10 26 2 12 16-4 28-24 4-24-8z" fill="#f2bb4a" shade="#c48a26" />
      <Part uid={u} k="a1" d="M34 62l-18 10 4 18 12-4-2-10 10-4z" fill="#f2bb4a" shade="#c48a26" />
      <Part uid={u} k="a2" d="M88 64l16 8-2 18-12-2 2-10-8-4z" fill="#f2bb4a" shade="#c48a26" />
      <Part uid={u} k="h" d="M42 30l18-14 20 8 2 22-20 8-20-6z" fill="#ffcf5e" shade="#d39b2e" />
      <Line d="M50 62l8 4M66 70l8-6M48 80l10-2M70 82l6 4" sw={2} color="#b07a1e" />
      <Eye x={54} y={34} r={5} look={[0.6, 0.5]} glow="#ff6b5b" />
      <Eye x={70} y={34} r={5} look={[-0.4, 0.5]} glow="#ff6b5b" />
      <Line d="M46 26l12 4M80 26l-12 4" sw={3.5} />
      <Flat d="M52 44h18l-2 6H54z" fill={OUT} sw={1.5} />
      <Flat d="M55 44l2 3 2-3 2 3 2-3 2 3 2-3" fill="none" sw={1.4} />
      {[[22, 104], [96, 106], [30, 112]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y}l4-3 3 4z`} fill="#f2bb4a" stroke={OUT} strokeWidth={1.5} />
      ))}
    </g>
  ),

  // Pale vampire in a high collar, remote in hand, glowing red eyes.
  'serien-vampir': (u) => (
    <g color="#d9d2f0">
      <Shadow rx={34} />
      <Part uid={u} k="cape" d="M28 46l32-8 32 8 8 64H20z" fill="#2d2350" shade="#1c1638" />
      <path d="M36 52l24-6 24 6-6 54H42z" fill="#a8243f" stroke={OUT} strokeWidth={SW} />
      <Part uid={u} k="col1" d="M28 46L14 18l30 18z" fill="#2d2350" shade="#1c1638" />
      <Part uid={u} k="col2" d="M92 46l14-28-30 18z" fill="#2d2350" shade="#1c1638" />
      <Part uid={u} k="h" d="M60 14c14 0 22 10 22 24s-10 22-22 22-22-8-22-22 8-24 22-24z" fill="#e9e3fb" shade="#bbb2dc" />
      <path d="M38 34c4-16 14-22 22-20 8-2 18 4 22 20-6-6-12-8-22-2-10-6-16-4-22 2z" fill="#1c1638" stroke={OUT} strokeWidth={2} />
      <Eye x={52} y={38} r={5} look={[0.4, 0.4]} glow="#ff4f7b" />
      <Eye x={68} y={38} r={5} look={[-0.4, 0.4]} glow="#ff4f7b" />
      <Line d="M46 30l10 4M74 30l-10 4" sw={3} />
      <Line d="M52 50q8 5 16 0" sw={2.4} />
      <Flat d="M54 50l2 6 2-5zM62 51l2 5 2-6z" fill="#fff" sw={1.6} />
      <Part uid={u} k="hand" d={circle(86, 76, 6)} fill="#e9e3fb" shade="#bbb2dc" />
      <Flat d="M84 62h8v18h-8z" fill="#22203a" />
      <circle cx={88} cy={66} r={1.6} fill="#ff4f7b" />
    </g>
  ),

  // A sloth that barely stands, long arms dangling to the floor.
  faulpelz: (u) => (
    <g color="#8a6a4a">
      <Shadow rx={36} />
      <Part uid={u} k="a1" d="M38 56c-12 8-16 26-14 48l8 2c0-18 4-32 12-40z" fill="#a7805a" shade="#7a5a3c" />
      <Part uid={u} k="a2" d="M82 56c12 8 16 26 14 48l-8 2c0-18-4-32-12-40z" fill="#a7805a" shade="#7a5a3c" />
      <Flat d="M24 104l-4 6M28 106l-2 6M32 106v6M96 104l4 6M92 106l2 6M88 106v6" fill="none" sw={2.4} />
      <Part uid={u} k="b" d="M60 40c18 0 26 16 26 36s-10 34-26 34-26-14-26-34 8-36 26-36z" fill="#b48a62" shade="#86643f" />
      <Part uid={u} k="h" d="M60 16c16 0 24 10 24 22s-10 20-24 20-24-8-24-20 8-22 24-22z" fill="#d8b892" shade="#ac8a64" />
      <path d="M40 36c4-6 10-6 14-2l2 8c-6 4-12 2-16-6zM80 36c-4-6-10-6-14-2l-2 8c6 4 12 2 16-6z" fill="#5b4330" />
      <Eye x={49} y={38} r={4.5} lid={0.7} />
      <Eye x={71} y={38} r={4.5} lid={0.7} />
      <ellipse cx={60} cy={46} rx={4} ry={3} fill={OUT} />
      <Line d="M54 52q6 4 12 0" sw={2.4} />
      <Line d="M50 66q10 6 20 0M48 80q12 6 24 0" sw={2} color="#86643f" />
    </g>
  ),

  // A pink candy goblin with a wrapper hat and a lollipop staff.
  'zucker-kobold': (u) => (
    <g color="#d4497e">
      <Shadow rx={26} />
      <Line d="M90 30v80" sw={5} />
      <Line d="M90 30v80" sw={2.4} color="#fffaf0" />
      <Part uid={u} k="pop" d={circle(90, 24, 13)} fill="#ff8ab6" shade="#d4497e" />
      <path d="M90 24m-8 0a8 8 0 0 1 16 0 5 5 0 0 1-10 0 2 2 0 0 1 4 0" fill="none" stroke="#fffaf0" strokeWidth={2.4} />
      <Part uid={u} k="f1" d="M46 98h10v12H44z" fill="#e85d95" shade="#b23a6c" />
      <Part uid={u} k="f2" d="M64 98h10l2 12H64z" fill="#e85d95" shade="#b23a6c" />
      <Part uid={u} k="b" d="M60 54c14 0 22 12 22 26s-8 22-22 22-22-8-22-22 8-26 22-26z" fill="#ff7aa8" shade="#cf4a7e" />
      <Part uid={u} k="h" d="M60 30c14 0 22 8 22 18s-8 16-22 16-22-6-22-16 8-18 22-18z" fill="#ff8ab6" shade="#d4497e" />
      <Part uid={u} k="e1" d="M38 44l-16-8 4 14z" fill="#ff8ab6" shade="#d4497e" />
      <Part uid={u} k="e2" d="M82 44l10-6-2 10z" fill="#ff8ab6" shade="#d4497e" />
      <Flat d="M44 30l16-10 16 10-16 6z" fill="#3ec9bd" />
      <Flat d="M44 30l-8-6v12zM76 30l8-6v12z" fill="#3ec9bd" />
      <Eye x={53} y={46} r={5} look={[0.6, 0.2]} />
      <Eye x={67} y={46} r={5} look={[0.6, 0.2]} />
      <path d="M50 56q10 10 20 0z" fill={OUT} />
      <Flat d="M54 56l2 3 2-3M62 56l2 3 2-3" fill="#fff" sw={1.2} />
      <Part uid={u} k="hand" d={circle(84, 72, 5)} fill="#ff8ab6" shade="#d4497e" />
    </g>
  ),

  // ----- bosses -----

  // Boss: a hulking boar-hound with tusks and a spiked collar.
  schweinehund: (u) => (
    <g color="#a14a5c">
      <Shadow rx={46} />
      <Part uid={u} k="l1" d="M34 90h14l-2 22H32z" fill="#b8566a" shade="#87394c" />
      <Part uid={u} k="l2" d="M72 90h14l2 22H74z" fill="#b8566a" shade="#87394c" />
      <Part uid={u} k="b" d="M60 44c26 0 40 16 40 34s-14 26-40 26-40-8-40-26 14-34 40-34z" fill="#cf6a7e" shade="#9a4458" />
      <Flat d="M28 56l6-10 4 10 6-12 4 12 6-12 4 12 6-12 4 12 6-12 4 12 6-10 4 10" fill="#fffaf0" />
      <Flat d="M26 58c10 6 58 6 68 0l2 8c-12 6-60 6-72 0z" fill="#2d2350" />
      <Part uid={u} k="ear1" d="M34 30L22 6l20 14z" fill="#e88a9c" shade="#b55a6e" />
      <Part uid={u} k="ear2" d="M86 30l12-24-20 14z" fill="#e88a9c" shade="#b55a6e" />
      <Part uid={u} k="h" d="M60 12c18 0 28 12 28 26s-12 22-28 22-28-8-28-22 10-26 28-26z" fill="#e07a8e" shade="#ab4e62" />
      <Eye x={48} y={30} r={5.5} look={[0.5, 0.4]} glow="#ffd23f" />
      <Eye x={72} y={30} r={5.5} look={[-0.5, 0.4]} glow="#ffd23f" />
      <Line d="M40 20l14 6M80 20l-14 6" sw={4} />
      <Part uid={u} k="sn" d={ellipse(60, 44, 13, 9)} fill="#ffb3c4" shade="#e0859a" />
      <ellipse cx={55} cy={44} rx={2.6} ry={3.4} fill={OUT} />
      <ellipse cx={65} cy={44} rx={2.6} ry={3.4} fill={OUT} />
      <Flat d="M44 50q-4 6-2 12l5-6zM76 50q4 6 2 12l-5-6z" fill="#fffaf0" sw={2} />
    </g>
  ),

  // Boss: a one-eyed ogre with horns and a "MO" on its chest.
  'montags-monster': (u) => (
    <g color="#4a5aa8">
      <Shadow rx={44} />
      <Part uid={u} k="l1" d="M36 92h16l-2 20H34z" fill="#5d6fc4" shade="#3f4e96" />
      <Part uid={u} k="l2" d="M68 92h16l2 20H70z" fill="#5d6fc4" shade="#3f4e96" />
      <Part uid={u} k="a1" d="M28 48c-14 6-18 24-14 40l10 2c-2-12 0-26 10-32z" fill="#6d80d6" shade="#4a5aa8" />
      <Part uid={u} k="a2" d="M92 48c14 6 18 24 14 40l-10 2c2-12 0-26-10-32z" fill="#6d80d6" shade="#4a5aa8" />
      <Part uid={u} k="b" d="M60 16c24 0 36 18 36 40s-12 40-36 40-36-18-36-40 12-40 36-40z" fill="#7b8ee2" shade="#5263b8" />
      <Part uid={u} k="h1" d="M36 24L28 2l16 14z" fill="#fffaf0" shade="#cfc8e8" />
      <Part uid={u} k="h2" d="M84 24l8-22-16 14z" fill="#fffaf0" shade="#cfc8e8" />
      <circle cx={60} cy={40} r={14} fill="#fffaf0" stroke={OUT} strokeWidth={2.6} />
      <circle cx={60} cy={42} r={7} fill="#ff4f7b" stroke={OUT} strokeWidth={2} />
      <circle cx={60} cy={42} r={3.5} fill={OUT} />
      <circle cx={57.5} cy={39.5} r={1.6} fill="#fff" />
      <Line d="M44 24l16 6 16-6" sw={4} />
      <Flat d="M42 60h36l-4 12H46z" fill={OUT} sw={2} />
      <Flat d="M45 60l3 5 3-5 3 5 3-5 3 5 3-5 3 5 3-5 3 5 3-5M47 72l3-4 3 4 3-4 3 4 3-4 3 4 3-4 3 4 3-4 3 4" fill="#fffaf0" sw={1.2} />
      <Flat d="M48 78h24v12H48z" fill="#fffaf0" sw={2} />
      <text x={60} y={88} textAnchor="middle" fill="#ff4f7b" fontSize={9} fontWeight={900} fontFamily="system-ui,sans-serif">
        MO
      </text>
    </g>
  ),

  // Boss: a winged dragon whose hourglass never runs out.
  'aufschiebe-drache': (u) => (
    <g color="#2f8f6a">
      <Shadow rx={46} />
      <Part uid={u} k="w1" d="M36 50L4 22l8 34 10-4 4 12 14-6z" fill="#3fb88a" shade="#2a8a66" />
      <Part uid={u} k="w2" d="M84 50l32-28-8 34-10-4-4 12-14-6z" fill="#3fb88a" shade="#2a8a66" />
      <Part uid={u} k="tail" d="M84 92c16 4 26-2 30-12l-6-2c-4 6-10 8-22 6z" fill="#4cd19e" shade="#2f9a72" />
      <Flat d="M110 76l8-6-2 10z" fill="#ffd23f" />
      <Part uid={u} k="l1" d="M40 92h14l-2 20H38z" fill="#4cd19e" shade="#2f9a72" />
      <Part uid={u} k="l2" d="M66 92h14l2 20H68z" fill="#4cd19e" shade="#2f9a72" />
      <Part uid={u} k="b" d="M60 44c20 0 30 16 30 30s-12 26-30 26-30-10-30-26 10-30 30-30z" fill="#55dba8" shade="#34a57c" />
      <path d="M48 62q12 8 24 0v24q-12 8-24 0z" fill="#ffe7a0" stroke={OUT} strokeWidth={2.2} />
      <Line d="M50 70h20M50 78h20" sw={1.8} color="#d2b36a" />
      <Part uid={u} k="h" d="M60 10c16 0 26 10 26 22 0 10-6 16-12 18H46c-6-2-12-8-12-18 0-12 10-22 26-22z" fill="#5fe6b2" shade="#38ac82" />
      <Flat d="M44 14l-4-12 10 8zM76 14l4-12-10 8z" fill="#ffd23f" />
      <Eye x={50} y={28} r={5.5} look={[0.6, 0.4]} glow="#ffd23f" />
      <Eye x={70} y={28} r={5.5} look={[-0.6, 0.4]} glow="#ffd23f" />
      <Line d="M42 20l12 5M78 20l-12 5" sw={3.5} />
      <Line d="M50 42q10 5 20 0" sw={2.6} />
      <Flat d="M52 42l2 5 2-4zM64 42l2 4 2-5z" fill="#fff" sw={1.5} />
      <g transform="translate(92 56)">
        <Flat d="M0 0h14l-5 9 5 9H0l5-9z" fill="#fffaf0" sw={2} />
        <path d="M3 2h8l-4 6zM7 12l4 4H3z" fill="#ffd23f" />
      </g>
    </g>
  ),

  // Boss: a giant bear in a night cap, wrapped in its blanket.
  'winterschlaf-baer': (u) => (
    <g color="#7a5236">
      <Shadow rx={46} />
      <Part uid={u} k="b" d="M60 40c26 0 40 18 40 38s-12 34-40 34-40-14-40-34 14-38 40-38z" fill="#a8744e" shade="#7a5236" />
      <Part uid={u} k="bl" d="M18 76c14-6 70-6 84 0l-4 36H22z" fill="#3ec9bd" shade="#279a90" />
      <Line d="M30 84l8 26M50 80l4 30M70 80l-2 30M90 84l-6 26" sw={2.2} color="#279a90" />
      <Part uid={u} k="e1" d={circle(34, 22, 10)} fill="#a8744e" shade="#7a5236" />
      <Part uid={u} k="e2" d={circle(86, 22, 10)} fill="#a8744e" shade="#7a5236" />
      <circle cx={34} cy={22} r={5} fill="#d9a07a" />
      <circle cx={86} cy={22} r={5} fill="#d9a07a" />
      <Part uid={u} k="h" d="M60 14c20 0 30 12 30 26s-12 24-30 24-30-10-30-24 10-26 30-26z" fill="#b7835c" shade="#875c3e" />
      <Part uid={u} k="cap" d="M34 26c6-18 34-24 52-8l14 4-8 8-8-4c-14-6-34-6-50 0z" fill="#ff6b5b" shade="#c94a3c" />
      <circle cx={100} cy={24} r={6} fill="#fffaf0" stroke={OUT} strokeWidth={2.2} />
      <Line d="M44 38q5 4 10 0M66 38q5 4 10 0" sw={3} />
      <Part uid={u} k="sn" d={ellipse(60, 50, 12, 9)} fill="#e0b48c" shade="#b48862" />
      <ellipse cx={60} cy={46} rx={4.5} ry={3} fill={OUT} />
      <Line d="M56 54q4 3 8 0" sw={2.2} />
      <text x={98} y={48} fill="#fffaf0" fontSize={12} fontWeight={800} fontFamily="system-ui,sans-serif" stroke={OUT} strokeWidth={0.8}>
        z
      </text>
      <text x={106} y={38} fill="#fffaf0" fontSize={9} fontWeight={800} fontFamily="system-ui,sans-serif" stroke={OUT} strokeWidth={0.6}>
        z
      </text>
    </g>
  ),

  // Boss: a three-headed serpent, each head with its own excuse face.
  'ausreden-hydra': (u) => (
    <g color="#6a3fa0">
      <Shadow rx={46} />
      <Part uid={u} k="n1" d="M44 84C30 70 18 54 22 34l12 2c-2 16 6 30 18 42z" fill="#9b6ad6" shade="#6c45a8" />
      <Part uid={u} k="n3" d="M76 84c14-14 26-30 22-50l-12 2c2 16-6 30-18 42z" fill="#9b6ad6" shade="#6c45a8" />
      <Part uid={u} k="n2" d="M54 84V40h12v44z" fill="#a878e2" shade="#7650b4" />
      <Part uid={u} k="b" d="M60 70c24 0 36 12 36 24s-14 18-36 18-36-6-36-18 12-24 36-24z" fill="#a878e2" shade="#7650b4" />
      <Line d="M40 96q20 8 40 0M44 104q16 5 32 0" sw={2} color="#7650b4" />
      {[
        { x: 26, y: 26, look: [0.6, 0.4] as [number, number], m: 'M20 34q6 3 12 0' },
        { x: 60, y: 22, look: [0, 0.5] as [number, number], m: 'M54 32q6 5 12 0' },
        { x: 94, y: 26, look: [-0.6, 0.4] as [number, number], m: 'M88 34q6-3 12 0' },
      ].map((h, i) => (
        <g key={i}>
          <Part uid={u} k={`h${i}`} d={ellipse(h.x, h.y, 13, 11)} fill="#b98af0" shade="#8a5ec4" />
          <Flat d={`M${h.x - 8} ${h.y - 9}l-3-8 7 5zM${h.x + 8} ${h.y - 9}l3-8-7 5z`} fill="#ffd23f" sw={2} />
          <Eye x={h.x - 5} y={h.y - 2} r={3.6} look={h.look} glow="#ffd23f" />
          <Eye x={h.x + 5} y={h.y - 2} r={3.6} look={h.look} glow="#ffd23f" />
          <Line d={h.m} sw={2.2} />
        </g>
      ))}
      <Flat d="M58 34l2 4 2-4" fill="#fff" sw={1.2} />
    </g>
  ),
};

export function Sprite({ enemyId, className }: { enemyId: string; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const draw = SPRITES[enemyId] ?? SPRITES['ausreden-geist'];
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden>
      {draw(uid)}
    </svg>
  );
}

export const hasSprite = (id: string) => id in SPRITES;
