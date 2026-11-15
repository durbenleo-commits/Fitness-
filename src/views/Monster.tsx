// Hand-built SVG monsters: each enemy is assembled from a body, a face and a few extras,
// coloured by its attribute. Original designs, consistent on every phone (no emoji).
import { useId } from 'react';
import type { QuestAttr } from '../game';
import { mix } from './Icons';

type Body = 'blob' | 'round' | 'ghost' | 'block' | 'rock';
type Eyes = 'round' | 'sleepy' | 'angry' | 'spiral' | 'closed' | 'one';
type Mouth = 'flat' | 'teeth' | 'fangs' | 'o' | 'smirk' | 'snout' | 'grin';
type Extra =
  | 'horns'
  | 'ears'
  | 'tentacles'
  | 'phone'
  | 'chip'
  | 'cape'
  | 'arms'
  | 'wrapper'
  | 'spikes'
  | 'bearEars'
  | 'pigEars'
  | 'heads'
  | 'zzz'
  | 'tuft';

interface Spec {
  body: Body;
  eyes: Eyes;
  mouth: Mouth;
  extras: Extra[];
}

const SPECS: Record<string, Spec> = {
  'sofa-troll': { body: 'block', eyes: 'sleepy', mouth: 'flat', extras: ['ears', 'tuft'] },
  'snooze-gremlin': { body: 'round', eyes: 'closed', mouth: 'o', extras: ['ears', 'zzz'] },
  'handy-zombie': { body: 'blob', eyes: 'spiral', mouth: 'flat', extras: ['phone', 'arms'] },
  'ausreden-geist': { body: 'ghost', eyes: 'round', mouth: 'o', extras: [] },
  'couch-krake': { body: 'round', eyes: 'angry', mouth: 'smirk', extras: ['tentacles'] },
  'chips-golem': { body: 'rock', eyes: 'angry', mouth: 'teeth', extras: ['chip'] },
  'serien-vampir': { body: 'round', eyes: 'angry', mouth: 'fangs', extras: ['cape'] },
  faulpelz: { body: 'blob', eyes: 'sleepy', mouth: 'smirk', extras: ['arms', 'tuft'] },
  'zucker-kobold': { body: 'round', eyes: 'round', mouth: 'grin', extras: ['wrapper'] },
  schweinehund: { body: 'blob', eyes: 'angry', mouth: 'snout', extras: ['pigEars', 'spikes'] },
  'montags-monster': { body: 'block', eyes: 'one', mouth: 'teeth', extras: ['horns'] },
  'aufschiebe-drache': { body: 'blob', eyes: 'angry', mouth: 'fangs', extras: ['spikes', 'horns'] },
  'winterschlaf-baer': { body: 'round', eyes: 'closed', mouth: 'snout', extras: ['bearEars', 'zzz'] },
  'ausreden-hydra': { body: 'blob', eyes: 'angry', mouth: 'fangs', extras: ['heads'] },
};

const INK = '#1a1838';
const EYE = '#f2efe6';

const BODIES: Record<Body, (fill: string) => JSX.Element> = {
  blob: (f) => <path d="M50 20C73 20 85 37 85 57 85 75 71 85 50 85S15 75 15 57C15 37 27 20 50 20Z" fill={f} />,
  round: (f) => <circle cx="50" cy="54" r="32" fill={f} />,
  ghost: (f) => <path d="M22 86V48C22 30 34 18 50 18S78 30 78 48V86L70 79 62 86 54 79 46 86 38 79 30 86Z" fill={f} />,
  block: (f) => <rect x="17" y="25" width="66" height="60" rx="16" fill={f} />,
  rock: (f) => <path d="M27 30 50 17 76 27 86 56 73 85H29L15 59Z" fill={f} />,
};

function Eyes({ type }: { type: Eyes }) {
  const pair = (render: (x: number) => JSX.Element) => (
    <>
      {render(38)}
      {render(62)}
    </>
  );
  switch (type) {
    case 'round':
      return pair((x) => (
        <g key={x}>
          <circle cx={x} cy="47" r="8" fill={EYE} />
          <circle cx={x + 1.5} cy="48" r="4" fill={INK} />
          <circle cx={x - 0.5} cy="46" r="1.5" fill={EYE} />
        </g>
      ));
    case 'sleepy':
      return pair((x) => (
        <g key={x}>
          <circle cx={x} cy="48" r="7" fill={EYE} />
          <circle cx={x} cy="50" r="3.5" fill={INK} />
          <path d={`M${x - 8} 47h16`} stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path d={`M${x - 8} 47a8 8 0 0 1 16 0z`} fill="currentColor" />
        </g>
      ));
    case 'angry':
      return pair((x) => (
        <g key={x}>
          <circle cx={x} cy="49" r="7" fill={EYE} />
          <circle cx={x + (x < 50 ? 2 : -2)} cy="50" r="3.5" fill={INK} />
          <circle cx={x + (x < 50 ? 1 : -3)} cy="48.6" r="1.2" fill={EYE} />
          <path d={x < 50 ? `M${x - 9} 38l16 6` : `M${x + 9} 38l-16 6`} stroke={INK} strokeWidth="4" strokeLinecap="round" />
        </g>
      ));
    case 'spiral':
      return pair((x) => (
        <g key={x}>
          <circle cx={x} cy="48" r="8" fill={EYE} />
          <path d={`M${x} 48m-1 0a1.5 1.5 0 1 1 3 0 3 3 0 1 1-6 0 4.5 4.5 0 1 1 9 0`} fill="none" stroke={INK} strokeWidth="1.6" />
        </g>
      ));
    case 'closed':
      return pair((x) => <path key={x} d={`M${x - 7} 48q7 6 14 0`} fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />);
    case 'one':
      return (
        <>
          <circle cx="50" cy="46" r="13" fill={EYE} />
          <circle cx="50" cy="47" r="6" fill={INK} />
          <circle cx="47.5" cy="44.5" r="2" fill={EYE} />
        </>
      );
  }
}

function Mouth({ type }: { type: Mouth }) {
  switch (type) {
    case 'flat':
      return <path d="M41 67h18" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />;
    case 'o':
      return <ellipse cx="50" cy="67" rx="5" ry="6" fill={INK} />;
    case 'smirk':
      return <path d="M40 66q10 7 20-2" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />;
    case 'grin':
      return <path d="M36 62q14 16 28 0z" fill={INK} />;
    case 'teeth':
      return (
        <>
          <rect x="35" y="61" width="30" height="13" rx="4" fill={INK} />
          <path d="M37 61l3 5 3-5 3 5 3-5 3 5 3-5 3 5 3-5 3 5 2-5M37 74l3-5 3 5 3-5 3 5 3-5 3 5 3-5 3 5 3-5 2 5" fill={EYE} />
        </>
      );
    case 'fangs':
      return (
        <>
          <path d="M38 63q12 10 24 0" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M42 65l2 7 2-6zM54 66l2 6 2-7z" fill={EYE} />
        </>
      );
    case 'snout':
      return (
        <>
          <ellipse cx="50" cy="65" rx="13" ry="9" fill="#ffb3c7" />
          <circle cx="45.5" cy="65" r="2.6" fill={INK} />
          <circle cx="54.5" cy="65" r="2.6" fill={INK} />
        </>
      );
  }
}

/** Things drawn behind the body. */
function Behind({ extras, fill }: { extras: Extra[]; fill: string }) {
  return (
    <>
      {extras.includes('cape') && <path d="M18 40 4 92h92L82 40z" fill={INK} stroke={fill} strokeWidth="2" />}
      {extras.includes('ears') && <path d="M22 44 6 30 26 32zM78 44 94 30 74 32z" fill={fill} />}
      {extras.includes('bearEars') && (
        <>
          <circle cx="26" cy="28" r="10" fill={fill} />
          <circle cx="74" cy="28" r="10" fill={fill} />
          <circle cx="26" cy="28" r="5" fill={INK} opacity="0.35" />
          <circle cx="74" cy="28" r="5" fill={INK} opacity="0.35" />
        </>
      )}
      {extras.includes('pigEars') && <path d="M24 30 20 12 38 22zM76 30 80 12 62 22z" fill="#ffb3c7" />}
      {extras.includes('horns') && <path d="M30 28 22 6 40 22zM70 28 78 6 60 22z" fill={EYE} />}
      {extras.includes('spikes') && <path d="M34 22 40 8 46 20 50 6 54 20 60 8 66 22z" fill={EYE} opacity="0.9" />}
      {extras.includes('heads') && (
        <>
          <circle cx="16" cy="30" r="12" fill={fill} />
          <circle cx="84" cy="30" r="12" fill={fill} />
          <circle cx="14" cy="28" r="3.5" fill={EYE} />
          <circle cx="86" cy="28" r="3.5" fill={EYE} />
          <path d="M10 35q6 4 11 0M79 35q6 4 11 0" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      )}
      {extras.includes('tentacles') && (
        <g stroke={fill} strokeWidth="8" strokeLinecap="round" fill="none">
          <path d="M28 76q-10 10-4 18" />
          <path d="M42 82q-2 10 4 14" />
          <path d="M58 82q2 10-4 14" />
          <path d="M72 76q10 10 4 18" />
        </g>
      )}
      {extras.includes('arms') && (
        <g stroke={fill} strokeWidth="8" strokeLinecap="round" fill="none">
          <path d="M20 58q-8 14-6 30" />
          <path d="M80 58q8 14 6 30" />
        </g>
      )}
      {extras.includes('wrapper') && <path d="M20 54 2 42v24zM80 54l18-12v24z" fill={EYE} opacity="0.85" />}
    </>
  );
}

/** Things drawn in front of the face. */
function Front({ extras }: { extras: Extra[] }) {
  return (
    <>
      {extras.includes('tuft') && <path d="M44 22q2-10 6-4 2-8 6 2" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />}
      {extras.includes('chip') && <path d="M58 6 80 14 64 30z" fill="#ffd23f" stroke={INK} strokeWidth="2" strokeLinejoin="round" />}
      {extras.includes('phone') && (
        <g transform="rotate(-12 74 74)">
          <rect x="66" y="60" width="17" height="28" rx="4" fill={INK} />
          <rect x="68.5" y="63" width="12" height="20" rx="2" fill="#4fd1c5" />
        </g>
      )}
      {extras.includes('zzz') && (
        <text x="76" y="22" fill={EYE} fontSize="15" fontWeight="700" fontFamily="system-ui, sans-serif">
          z<tspan dx="1" dy="-6" fontSize="11">z</tspan>
        </text>
      )}
    </>
  );
}

const ATTR_FILL: Record<QuestAttr, string> = {
  staerke: '#ff6b5b',
  ausdauer: '#3fc9bd',
  beweglichkeit: '#a985f2',
};

/**
 * Clay look: a radial gradient lit from the top left, a soft shade at the bottom,
 * a blurred highlight and a contact shadow on the floor.
 */
export function Monster({ enemyId, attr, className }: { enemyId: string; attr: QuestAttr; className?: string }) {
  const spec = SPECS[enemyId] ?? SPECS['ausreden-geist'];
  const base = ATTR_FILL[attr];
  const id = useId().replace(/:/g, '');
  const paint = `url(#b${id})`;
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden style={{ color: mix(base, '#0b0a24', 0.25) }}>
      <defs>
        <radialGradient id={`b${id}`} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor={mix(base, '#ffffff', 0.42)} />
          <stop offset="0.45" stopColor={base} />
          <stop offset="1" stopColor={mix(base, '#0b0a24', 0.45)} />
        </radialGradient>
        <filter id={`s${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id={`h${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <ellipse cx="50" cy="92" rx="30" ry="5.5" fill="#05041a" opacity="0.55" filter={`url(#s${id})`} />
      <Behind extras={spec.extras} fill={paint} />
      {BODIES[spec.body](paint)}
      <ellipse cx="37" cy="31" rx="13" ry="7" fill="#fff" opacity="0.38" transform="rotate(-22 37 31)" filter={`url(#h${id})`} />
      <Eyes type={spec.eyes} />
      <Mouth type={spec.mouth} />
      <Front extras={spec.extras} />
    </svg>
  );
}
