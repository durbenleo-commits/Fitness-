// Keyframes and German cues for every built-in exercise (normal and easier variant).
// Poses are built with the rig in rig.ts; positions that must line up (hands under the shoulders,
// feet on a pedal ...) are solved here once, so the keyframes stay consistent.
import { QUEST_POOL, VARIANTS } from '../game';
import {
  SK,
  add,
  blend,
  lowestY,
  rot,
  solve,
  type ExerciseAnimDef,
  type Key,
  type LimbPose,
  type Pose,
  type Prop,
  type Contact,
  type Vec,
  type VariantAnim,
  type JointName,
} from './rig';

/** Exercises without an animation: amounts, not movements. */
export const NO_ANIM = ['steps', 'read', 'walk'];

// ---------- helpers ----------

const FY = -SK.sole; // ankle height with the foot flat on the floor
const WY = -SK.wristLift; // wrist height with the palm flat on the floor

const L = (a: number, b = a, c = b, x: Partial<LimbPose> = {}): LimbPose => ({ a, b, c, ...x });
/** Foot planted flat with its ankle over x (y = surface). */
const planted = (x: number, y = 0, c = 0): LimbPose => ({ a: 90, b: 90, c, ik: [x, y + FY], bend: -1 });
/** Foot standing on the ball of the foot at point p (heel lifted by angle c). */
const onBall = (p: Vec, c: number): LimbPose => ({ a: 90, b: 90, c, ik: p, toe: true, bend: -1 });
/** Hand flat on a surface (wrist target). */
const palm = (x: number, y = 0, c = 0, bend: 1 | -1 = 1, s = 1): LimbPose => ({ a: 90, b: 90, c, ik: [x, y + WY], bend, s });
const grip = (t: Vec, c: number, bend: 1 | -1 = 1): LimbPose => ({ a: 90, b: 90, c, ik: t, bend });
const relTo = (rel: JointName, off: Vec, c: number, bend: 1 | -1 = 1): LimbPose => ({ a: 90, b: 90, c, ik: { rel, off }, bend });

const ARM_DOWN_N = L(93, 92, 92);
const ARM_DOWN_F = L(88, 89, 90);

function P(p: Partial<Pose>): Pose {
  return { torso: -90, head: -90, nl: L(90, 90, 0), fl: L(90, 90, 0), na: ARM_DOWN_N, fa: ARM_DOWN_F, ...p };
}
const mirror = (p: Pose): Pose => ({ ...p, nl: p.fl, fl: p.nl, na: p.fa, fa: p.na });
const K = (t: number, pose: Pose, x: Partial<Key> = {}): Key => ({ t, pose, ...x });

/** Move the pose up/down so its lowest outline point sits at floorY. */
function ground(p: Pose, front = false, floorY = 0, skip: string[] = []): Pose {
  let q = { ...p, anchor: undefined, root: p.root ?? ([0, 0] as Vec) };
  for (let i = 0; i < 4; i++) {
    const dy = floorY - lowestY(solve(q, front), front, skip);
    q = { ...q, root: [q.root![0], q.root![1] + dy] };
  }
  return q;
}

/** Bisection: x in [lo, hi] with f(x) = target (f monotonic). */
function bisect(f: (x: number) => number, target: number, lo: number, hi: number) {
  const up = f(hi) > f(lo);
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2;
    if (f(m) < target === up) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

const J = (p: Pose, j: JointName, front = false) => solve(p, front).J[j];

function V(name: string, cues: string[], dur: number, keys: Key[], x: Partial<VariantAnim> = {}): VariantAnim {
  return { name, cues, dur, keys, ...x };
}

// gentle "breathing" on a hold: three keys that differ by a small amount
function breathe(a: Pose, b: Pose): Key[] {
  return [K(0, a), K(0.5, b)];
}

// ---------- push-up family ----------

/** Body-straight support: body angle t (deg above horizontal), anchored at the toes or knees. */
function pushBody(t: number, knees: boolean, at: Vec): Pose {
  return P({
    torso: -t,
    head: -t + 8,
    nl: knees ? L(180 - t, -152, -190) : L(180 - t, 180 - t, 90 - t),
    fl: knees ? L(180 - t, -152, -190) : L(180 - t, 180 - t, 90 - t),
    anchor: knees ? { j: 'nKnee', at: [at[0], -SK.kneeR] } : { j: 'nToe', at },
  });
}

function pushup(name: string, knees: boolean, cues: string[], diamond = false, dur = 2.4): VariantAnim {
  const at: Vec = knees ? [-45, 0] : [-102, 0];
  const sy = (t: number) => J(pushBody(t, knees, at), 'nShoulder')[1];
  const tTop = bisect(sy, WY - 0.985 * (SK.upper + SK.fore), 0, 60);
  const tBot = bisect(sy, -27, 0, 60);
  const sTop = J(pushBody(tTop, knees, at), 'nShoulder');
  const hx = sTop[0] - (diamond ? 9 : 1);
  const body = (t: number, s: number) => ({ ...pushBody(t, knees, at), na: palm(hx, 0, 0, 1, s), fa: palm(hx - (diamond ? 3 : 0), 0, 0, 1, s) });
  const sb = diamond ? 0.9 : 0.74;
  const contacts: Contact[] = [
    knees ? { j: 'nKnee', y: 0, r: SK.kneeR } : { j: 'nToe', y: 0, r: 0 },
    { j: 'nWrist', y: 0, r: SK.wristLift },
  ];
  return V(name, cues, dur, [K(0, body(tTop, 1)), K(0.12, body(tTop, 1)), K(0.5, body(tBot, sb)), K(0.62, body(tBot, sb)), K(0.92, body(tTop, 1))], { contacts, still: 0.42 });
}

// ---------- standing helpers ----------

const STAND_Y = -101.5;
function stand(x = 0, extra: Partial<Pose> = {}): Pose {
  return P({ root: [x - 2, STAND_Y], nl: planted(x), fl: planted(x), ...extra });
}
const feetContacts = (from?: number, to?: number): Contact[] => [
  { j: 'nHeel', y: 0, from, to },
  { j: 'nBall', y: 0, from, to },
];

// ---------- the exercises ----------

const defs: Record<string, { normal: VariantAnim; easy: VariantAnim }> = {};

// Liegestütze
defs.pushups = {
  normal: pushup('', false, ['Hände unter die Schultern', 'Körper bildet eine Linie von Kopf bis Ferse', 'Brust bis knapp über den Boden, dann hochdrücken']),
  easy: pushup('', true, ['Knie auf der Matte, Füße in der Luft', 'Hüfte bleibt in einer Linie mit Knie und Schultern', 'Brust runter, dann hochdrücken']),
};
defs.diamond = {
  normal: pushup('', false, ['Hände eng unter der Brust, Daumen und Zeigefinger bilden eine Raute', 'Ellbogen dicht am Körper nach hinten', 'Körper bleibt eine gerade Linie'], true),
  easy: pushup('', true, ['Knie auf der Matte, Hände eng unter der Brust', 'Ellbogen dicht am Körper', 'Langsam runter, kräftig hoch'], true),
};

// Pike-Liegestütze: hips high, head goes down between the hands
function pike(name: string, legAngle: number, cues: string[]): VariantAnim {
  const at: Vec = [-70, 0];
  const body = (t: number) => P({ torso: t, head: t + 12, nl: L(legAngle, legAngle, 62), fl: L(legAngle, legAngle, 62), anchor: { j: 'nToe', at } });
  const sy = (t: number) => J(body(t), 'nShoulder')[1];
  const tTop = bisect(sy, WY - 0.98 * (SK.upper + SK.fore), -20, 85);
  const sTop = J(body(tTop), 'nShoulder');
  const hx = sTop[0] + 6;
  const tBot = Math.min(tTop + 32, 82);
  const k = (t: number, s: number) => ({ ...body(t), na: palm(hx, 0, 0, 1, s), fa: palm(hx, 0, 0, 1, s) });
  return V(name, cues, 2.6, [K(0, k(tTop, 1)), K(0.12, k(tTop, 1)), K(0.5, k(tBot, 0.85)), K(0.6, k(tBot, 0.85)), K(0.92, k(tTop, 1))], {
    contacts: [{ j: 'nToe', y: 0, r: 0 }, { j: 'nWrist', y: 0, r: SK.wristLift }],
    still: 0.45,
  });
}
defs.pike = {
  normal: pike('', 112, ['Hüfte hoch, Körper wie ein umgedrehtes V', 'Kopf zwischen den Händen Richtung Boden senken', 'Wieder nach oben drücken']),
  easy: pike('', 128, ['Hüfte nur etwas anheben', 'Kopf vor die Hände Richtung Boden senken', 'Wieder hochdrücken']),
};

// Kniebeugen
function squat(name: string, depth: 'full' | 'half', cues: string[], dur = 2.6): VariantAnim {
  const top = stand(0, { na: L(92, 92, 92), fa: L(88, 88, 88) });
  const bot =
    depth === 'full'
      ? stand(0, { root: [-38, -55], torso: -50, head: -62, na: L(-4, -4, -4), fa: L(-2, -2, -2) })
      : stand(0, { root: [-20, -80], torso: -68, head: -75, na: L(10, 6, 6), fa: L(12, 8, 8) });
  const armsFwd = { ...top, na: L(40, 30, 30), fa: L(42, 32, 32) };
  return V(name, cues, dur, [K(0, top), K(0.1, top), K(0.25, armsFwd), K(0.5, bot), K(0.6, bot), K(0.92, top)], { contacts: feetContacts(), still: 0.55 });
}
defs.squats = {
  normal: squat('', 'full', ['Füße schulterbreit, Fersen bleiben am Boden', 'Po nach hinten unten, bis die Oberschenkel waagerecht sind', 'Brust bleibt oben, dann hochdrücken']),
  easy: squat('', 'half', ['Nur halb so tief gehen', 'Fersen am Boden, Po nach hinten', 'Langsam hoch und runter']),
};

// Sprungkniebeugen
{
  const bot = stand(0, { root: [-36, -60], torso: -52, head: -64, na: L(125, 120, 120), fa: L(128, 122, 122) });
  const air = P({ root: [4, -128], torso: -86, head: -88, nl: L(92, 94, 55), fl: L(88, 92, 55), na: L(-75, -80, -80), fa: L(-80, -85, -85) });
  const land = stand(0, { root: [-10, -92], torso: -76, head: -82, na: L(40, 30, 30), fa: L(42, 32, 32) });
  const quick = stand(0, { root: [-18, -82], torso: -70, head: -76, na: L(20, 10, 10), fa: L(22, 12, 12) });
  const top = stand(0, { na: L(70, 60, 60), fa: L(72, 62, 62) });
  defs.jumpsquats = {
    normal: V('', ['In die Kniebeuge, Arme nach hinten', 'Explosiv nach oben abspringen', 'Weich auf den Fußballen landen und direkt wieder runter'], 1.8, [K(0, bot), K(0.1, bot), K(0.35, air, { e: 'out' }), K(0.55, land, { e: 'in' }), K(0.85, bot)], { still: 0.25 }),
    easy: V('', ['Halbe Kniebeuge, Fersen bleiben am Boden', 'Zügig hoch und wieder runter', 'Kein Sprung, dafür schnelles Tempo'], 1.2, [K(0, quick), K(0.5, top)], { contacts: feetContacts(), still: 0 }),
  };
}

// Ausfallschritte
{
  const BACK: Vec = [23, 0];
  const stood = stand(0, { fl: onBall(BACK, 0), na: relTo('pelvis', [4, -4], 100), fa: relTo('pelvis', [6, -4], 100) });
  const step = { ...stood, root: [24, -98] as Vec, nl: L(60, 100, -12, { ik: [58, -32], bend: -1 }), fl: onBall(BACK, 25) };
  const low = { ...stood, root: [58, -60] as Vec, torso: -88, nl: planted(104), fl: onBall(BACK, 58) };
  defs.lunges = {
    normal: V('', ['Großer Schritt nach vorne', 'Hinteres Knie bis knapp über den Boden', 'Vorderes Knie über dem Fuß, dann zurückdrücken'], 3.2, [K(0, stood), K(0.08, stood), K(0.25, step), K(0.42, low), K(0.55, low), K(0.75, step), K(0.92, stood)], {
      contacts: [{ j: 'fBall', y: 0 }],
      still: 0.5,
    }),
    easy: (() => {
      // split stance, only up and down, one hand on a chair beside you
      const hand: Vec = [-10, -100];
      const up = P({ root: [36, -90], torso: -90, head: -88, nl: planted(78), fl: onBall([-6, 0], 40), na: relTo('pelvis', [4, -4], 100), fa: grip(hand, 8, -1) });
      const dn = { ...up, root: [36, -72] as Vec, fl: onBall([-6, 0], 52) };
      return V('', ['Schrittstellung, eine Hand an Stuhl oder Wand', 'Hinteres Knie langsam Richtung Boden', 'Nur so tief, wie es angenehm ist'], 2.8, [K(0, up), K(0.1, up), K(0.5, dn), K(0.6, dn), K(0.92, up)], {
        props: [{ k: 'chair', at: [-44, 0], w: 40, h: 40, facing: 1 }],
        contacts: [{ j: 'nHeel', y: 0 }, { j: 'fBall', y: 0 }],
        still: 0.5,
      });
    })(),
  };
}

// Bulgarische Kniebeugen / Split-Kniebeugen
{
  const benchTop = -44;
  const bench: Prop = { k: 'box', at: [-118, 0], w: 50, h: -benchTop };
  const rear: LimbPose = { a: 120, b: 160, c: 168, ik: [-88, benchTop - 7], bend: -1 };
  const up = P({ root: [-4, -92], torso: -86, head: -84, nl: planted(36), fl: rear, na: relTo('pelvis', [4, -4], 100), fa: relTo('pelvis', [6, -4], 100) });
  const dn = { ...up, root: [-6, -62] as Vec, torso: -80 };
  const upE = P({ root: [12, -90], torso: -88, head: -86, nl: planted(52), fl: onBall([-30, 0], 35), na: relTo('pelvis', [4, -4], 100), fa: relTo('pelvis', [6, -4], 100) });
  const dnE = { ...upE, root: [10, -66] as Vec, fl: onBall([-30, 0], 55) };
  defs.splitsquat = {
    normal: V('', ['Hinterer Fuß mit dem Spann auf der Bank', 'Senkrecht nach unten, vorderes Knie über dem Fuß', 'Über die vordere Ferse hochdrücken'], 2.8, [K(0, up), K(0.1, up), K(0.5, dn), K(0.6, dn), K(0.92, up)], {
      props: [bench],
      contacts: [{ j: 'nHeel', y: 0 }],
      still: 0.5,
    }),
    easy: V('', ['Beide Füße am Boden, großer Schritt Abstand', 'Hinteres Knie Richtung Boden senken', 'Gerade wieder hochdrücken'], 2.6, [K(0, upE), K(0.1, upE), K(0.5, dnE), K(0.6, dnE), K(0.92, upE)], {
      contacts: [{ j: 'nHeel', y: 0 }, { j: 'fBall', y: 0 }],
      still: 0.5,
    }),
  };
}

// Pistol Squats
{
  const up = P({ root: [-2, STAND_Y + 1], torso: -88, head: -86, nl: planted(0), fl: L(60, 70, -10), na: L(-5, -5, -5), fa: L(-3, -3, -3) });
  const dn = P({ root: [-30, -36], torso: -40, head: -55, nl: planted(0), fl: L(-6, -6, -50), na: L(-10, -10, -10), fa: L(-8, -8, -8) });
  const upE = { ...up };
  const dnE = P({ root: [-44, -62], torso: -62, head: -70, nl: planted(0), fl: L(-8, -8, -50), na: L(-5, -5, -5), fa: L(-3, -3, -3) });
  defs.pistol = {
    normal: V('', ['Auf einem Bein stehen, anderes Bein gestreckt nach vorne', 'Ganz tief runter, Arme nach vorne', 'Ferse bleibt am Boden, dann hochdrücken'], 3.2, [K(0, up), K(0.1, up), K(0.5, dn), K(0.6, dn), K(0.92, up)], {
      contacts: feetContacts(),
      still: 0.5,
    }),
    easy: V('', ['Stuhl hinter dir, auf einem Bein stehen', 'Langsam auf den Stuhl setzen', 'Mit dem einen Bein wieder aufstehen'], 3.2, [K(0, upE), K(0.1, upE), K(0.5, dnE), K(0.6, dnE), K(0.92, upE)], {
      props: [{ k: 'chair', at: [-82, 0], w: 44, h: 38, facing: -1 }],
      contacts: feetContacts(),
      still: 0.5,
    }),
  };
}

// Bauchpressen (crunch), lying on the back, head to the left
{
  const lie = (t: number, arms: 'head' | 'reach', knee = 64): Pose =>
    P({
      root: [0, -14.5],
      torso: 180 + t,
      head: 210 + t * 0.9,
      nl: planted(knee),
      fl: planted(knee),
      na: arms === 'head' ? relTo('head', [10, -6], 200, 1) : L(-8 + t * 0.6, -8 + t * 0.6, -8 + t * 0.6),
      fa: arms === 'head' ? relTo('head', [12, -8], 200, 1) : L(-6 + t * 0.6, -6 + t * 0.6, -6 + t * 0.6),
    });
  defs.situps = {
    normal: V('', ['Rücken auf der Matte, Füße aufgestellt', 'Hände locker an die Schläfen', 'Schultern einrollen und anheben, unten bleibt der Rücken liegen'], 2.2, [K(0, lie(0, 'head')), K(0.1, lie(0, 'head')), K(0.45, lie(32, 'head')), K(0.6, lie(32, 'head'))], {
      contacts: feetContacts(),
      still: 0.5,
    }),
    easy: V('', ['Arme lang Richtung Knie', 'Nur Kopf und Schultern leicht anheben', 'Langsam wieder ablegen'], 2.2, [K(0, lie(0, 'reach')), K(0.1, lie(0, 'reach')), K(0.45, lie(18, 'reach')), K(0.6, lie(18, 'reach'))], {
      contacts: feetContacts(),
      still: 0.5,
    }),
  };
}

// Wandsitzen
{
  const wall: Prop = { k: 'wall', at: [-15, 0], facing: -1 };
  const sit = (py: number, fx: number, br = 0): Pose =>
    P({ root: [0, py], torso: -90 + br, head: -72, nl: planted(fx), fl: planted(fx), na: L(78, 2, 0), fa: L(80, 4, 2) });
  const mk = (py: number, fx: number, name: string, cues: string[]) => {
    const top = sit(-88, fx);
    const hold = sit(py, fx);
    return V(name, cues, 5, [K(0, top), K(0.22, hold), K(0.5, sit(py + 1, fx, 1)), K(0.78, hold), K(0.9, top)], {
      props: [wall],
      contacts: feetContacts(),
      still: 0.5,
    });
  };
  defs.wallsit = {
    normal: mk(-54, 48, '', ['Rücken flach an die Wand', 'Runterrutschen, bis die Knie im rechten Winkel sind', 'Knie über den Füßen, halten und ruhig atmen']),
    easy: mk(-74, 36, '', ['Rücken an die Wand', 'Nur halb so tief rutschen', 'Halten und ruhig atmen']),
  };
}

// Unterarmstütz
function plankV(name: string, knees: boolean, cues: string[]): VariantAnim {
  const at: Vec = knees ? [-38, 0] : [-96, 0];
  const elbowY = -7;
  const sy = (t: number) => J(pushBody(t, knees, at), 'nShoulder')[1];
  const t = bisect(sy, elbowY - SK.upper, 0, 60);
  const s0 = J(pushBody(t, knees, at), 'nShoulder');
  const arm = grip([s0[0] + SK.fore, -5.5], 0);
  const p = (dt: number) => ({ ...pushBody(t + dt, knees, at), head: -t + 4, na: arm, fa: arm });
  return V(name, cues, 4, breathe(p(0), p(0.8)), {
    contacts: [knees ? { j: 'nKnee', y: 0, r: SK.kneeR } : { j: 'nToe', y: 0, r: 0 }],
    still: 0.25,
  });
}
defs.plank = {
  normal: plankV('', false, ['Ellbogen unter den Schultern', 'Körper bildet eine gerade Linie', 'Bauch und Po anspannen, Hüfte nicht durchhängen lassen']),
  easy: plankV('', true, ['Knie auf der Matte', 'Ellbogen unter den Schultern', 'Linie von Knie bis Kopf halten']),
};

// Seitstütz (front view, lying on the near side)
function sidePlank(knees: boolean, cues: string[]): VariantAnim {
  const body = (t: number) => {
    const legs = knees ? { nl: L(t + 182, 180, 90), fl: L(t + 182, 180, 90) } : { nl: L(180 + t, 180 + t, 90 + t), fl: L(180 + t + 2, 180 + t + 2, 90 + t) };
    return P({ torso: t, head: t - 4, ...legs, na: L(90, 0, 0), fa: L(-80, -84, -84), anchor: { j: 'nElbow', at: [0, -7] } });
  };
  const T = bisect((t) => lowestY(solve(body(t), true), true, ['fore', 'hand', 'upper']), 0.5, -60, -5);
  return V('', cues, 4, breathe(body(T), body(T + 1.5)), { front: true, still: 0.25 });
}
defs.sideplank = {
  normal: sidePlank(false, ['Ellbogen unter der Schulter', 'Füße übereinander, Hüfte hoch', 'Körper bildet eine gerade Linie']),
  easy: sidePlank(true, ['Knie gebeugt auf der Matte', 'Ellbogen unter der Schulter', 'Hüfte anheben und halten']),
};

// Hollow Hold (lying on the back, head left)
{
  const hollow = (d: number) => ground(P({ torso: 198 + d, head: 214 + d, nl: L(-16 - d, -16 - d, -40), fl: L(-14 - d, -14 - d, -38), na: L(200, 196, 196), fa: L(198, 194, 194) }));
  const tuck = (d: number) => ground(P({ torso: 200 + d, head: 216 + d, nl: L(-62 - d, 8, -30), fl: L(-60 - d, 10, -28), na: L(-14, -14, -14), fa: L(-12, -12, -12) }));
  defs.hollow = {
    normal: V('', ['Unterer Rücken drückt in die Matte', 'Arme und Beine gestreckt knapp über dem Boden', 'Wie eine Banane halten'], 4, breathe(hollow(0), hollow(2)), { still: 0.25 }),
    easy: V('', ['Unterer Rücken drückt in die Matte', 'Knie angezogen, Arme Richtung Knie', 'Schultern leicht anheben und halten'], 4, breathe(tuck(0), tuck(2)), { still: 0.25 }),
  };
}

// Superman (lying on the belly, head right)
{
  const rest = ground(P({ torso: 0, head: 4, nl: L(180, 180, 158), fl: L(180, 180, 158), na: L(6, 4, 4), fa: L(6, 4, 4) }));
  const up = ground(P({ torso: -12, head: -38, nl: L(192, 192, 172), fl: L(190, 190, 170), na: L(-4, -6, -6), fa: L(-2, -4, -4) }));
  const armsOnly = ground(P({ torso: -12, head: -38, nl: L(180, 180, 158), fl: L(180, 180, 158), na: L(-4, -6, -6), fa: L(-2, -4, -4) }));
  defs.superman = {
    normal: V('', ['Auf dem Bauch, Arme lang nach vorne', 'Arme, Brust und Beine gleichzeitig anheben', 'Kurz halten, Blick zum Boden'], 3.2, [K(0, rest), K(0.12, rest), K(0.4, up), K(0.75, up)], { still: 0.55 }),
    easy: V('', ['Auf dem Bauch, Beine bleiben liegen', 'Nur Arme und Brust anheben', 'Kurz halten, langsam ablegen'], 3.2, [K(0, rest), K(0.12, rest), K(0.4, armsOnly), K(0.75, armsOnly)], { still: 0.55 }),
  };
}

// Beckenheben (glute bridge)
{
  const SH: Vec = [-58, -12.5];
  const br = (t: number) =>
    P({ torso: t, head: 214, anchor: { j: 'nShoulder', at: SH }, nl: planted(62), fl: planted(62), na: L(-2, -1, -1), fa: L(0, 1, 1) });
  defs.bridge = {
    normal: V('', ['Auf dem Rücken, Füße hüftbreit aufgestellt', 'Hüfte hochdrücken bis Knie, Hüfte und Schultern eine Linie bilden', 'Oben den Po anspannen, langsam ablegen'], 2.6, [K(0, br(180)), K(0.12, br(180)), K(0.45, br(150)), K(0.62, br(150))], {
      contacts: [...feetContacts(), { j: 'nShoulder', y: 0, r: 12.5 }],
      still: 0.55,
    }),
    easy: V('', ['Auf dem Rücken, Füße aufgestellt', 'Hüfte nur halb so hoch anheben', 'Kurz halten und langsam ablegen'], 2.6, [K(0, br(180)), K(0.12, br(180)), K(0.45, br(166)), K(0.62, br(166))], {
      contacts: [...feetContacts(), { j: 'nShoulder', y: 0, r: 12.5 }],
      still: 0.55,
    }),
  };
}

// Beinheben liegend
{
  const flat = { root: [0, -14.5] as Vec, torso: 180, head: 212, na: L(-1, 0, 0), fa: L(1, 2, 2) };
  const straight = (a: number) => P({ ...flat, nl: L(a, a, a - 70), fl: L(a + 1, a + 1, a - 69) });
  const bent = (a: number) => P({ ...flat, nl: L(a, a + 78, a + 20), fl: L(a + 1, a + 79, a + 21) });
  defs.legraises = {
    normal: V('', ['Auf dem Rücken, Arme neben dem Körper', 'Gestreckte Beine bis senkrecht anheben', 'Langsam senken, knapp über dem Boden stoppen'], 3, [K(0, straight(-8)), K(0.1, straight(-8)), K(0.45, straight(-88)), K(0.55, straight(-88))], { still: 0.3 }),
    easy: V('', ['Knie gebeugt lassen', 'Beine anheben, bis die Knie über der Hüfte sind', 'Langsam wieder senken'], 3, [K(0, bent(-36)), K(0.1, bent(-36)), K(0.45, bent(-92)), K(0.55, bent(-92))], { still: 0.3 }),
  };
}

// Klimmzüge, Chin-ups, hängendes Knieheben (bar), Australische Varianten
{
  const BAR: Vec = [4, -252];
  const hands = (c = -90) => ({ na: grip([BAR[0] - 1, BAR[1] + 9], c, 1), fa: grip([BAR[0] + 1, BAR[1] + 9], c, 1) });
  const hang = (py: number, t = -92, legs: Partial<Pose> = {}, px = -2) => P({ root: [px, py], torso: t, head: t, nl: L(100, 138, 100), fl: L(96, 132, 96), ...hands(), ...legs });
  const pullCues = ['Schulterbreit greifen, ganz aushängen', 'Brust zur Stange ziehen, bis das Kinn darüber ist', 'Kontrolliert wieder ablassen'];
  // Australian: body straight under a low bar, heels on the floor, head to the left
  const LOW: Vec = [-70, -102];
  const aus = (bodyAngle: number) =>
    P({
      torso: 180 + bodyAngle,
      head: 180 + bodyAngle - 6,
      nl: L(bodyAngle, bodyAngle, bodyAngle - 90),
      fl: L(bodyAngle, bodyAngle, bodyAngle - 90),
      anchor: { j: 'nHeel', at: [80, 0] },
      na: grip([LOW[0], LOW[1] + 9], -90, 1),
      fa: grip([LOW[0] + 2, LOW[1] + 9], -90, 1),
    });
  const dsh = (a: number) => {
    const s = solve(aus(a)).J;
    return Math.hypot(s.nShoulder[0] - LOW[0], s.nShoulder[1] - LOW[1] - 9);
  };
  const aBot = bisect(dsh, 70, 10, 50);
  const aTop = bisect(dsh, 28, 10, 50);
  const ausV = (cues: string[]) =>
    V('', cues, 2.6, [K(0, aus(aBot)), K(0.12, aus(aBot)), K(0.5, aus(aTop)), K(0.62, aus(aTop))], {
      props: [{ k: 'bar', at: LOW }],
      contacts: [{ j: 'nHeel', y: 0 }],
      still: 0.5,
    });
  defs.pullups = {
    normal: V('', pullCues, 2.8, [K(0, hang(-116)), K(0.12, hang(-116)), K(0.5, hang(-176, -97, {}, -14)), K(0.62, hang(-176, -97, {}, -14))], { props: [{ k: 'bar', at: BAR }], still: 0.5 }),
    easy: ausV(['Tiefe Stange, Körper schräg darunter, Fersen am Boden', 'Brust zur Stange ziehen', 'Körper bleibt gerade wie ein Brett']),
  };
  defs.chinups = {
    normal: V('', ['Untergriff: Handflächen zeigen zu dir', 'Brust zur Stange ziehen, Kinn darüber', 'Langsam ganz ablassen'], 2.8, [K(0, hang(-116)), K(0.12, hang(-116)), K(0.5, hang(-176, -95, {}, -14)), K(0.62, hang(-176, -95, {}, -14))], { props: [{ k: 'bar', at: BAR }], still: 0.5 }),
    easy: ausV(['Tiefe Stange, Untergriff', 'Körper gerade, Fersen am Boden', 'Brust zur Stange ziehen, langsam zurück']),
  };
  const kneesUp = hang(-128, -98, { nl: L(-12, 82, 20), fl: L(-14, 80, 18) });
  const kneesDown = hang(-128, -90, { nl: L(94, 96, 70), fl: L(90, 92, 68) });
  const lieK = (a: number) => P({ root: [0, -14.5], torso: 180, head: 212, nl: L(a, a + 98, a + 40), fl: L(a + 1, a + 99, a + 41), na: L(-1, 0, 0), fa: L(1, 2, 2) });
  defs.kneeraises = {
    normal: V('', ['An der Stange hängen, Schultern aktiv', 'Knie bis über die Hüfte ziehen', 'Ohne Schwung langsam senken'], 2.8, [K(0, kneesDown), K(0.12, kneesDown), K(0.45, kneesUp), K(0.58, kneesUp)], {
      props: [{ k: 'bar', at: BAR }],
      still: 0.45,
    }),
    easy: V('', ['Auf dem Rücken, Knie gebeugt', 'Knie Richtung Brust ziehen', 'Füße langsam wieder Richtung Boden'], 2.6, [K(0, lieK(-52)), K(0.12, lieK(-52)), K(0.45, lieK(-108)), K(0.58, lieK(-108))], { still: 0.45 }),
  };
}

// Dips am Stuhl
{
  const chair: Prop = { k: 'chair', at: [-92, 0], w: 44, h: 40 };
  const HAND: Vec = [-50, -47 + WY];
  const top = (feet: Partial<Pose>) => P({ torso: -86, head: -82, anchor: { j: 'nShoulder', at: [-38, HAND[1] - 70] }, na: grip(HAND, 0, 1), fa: grip([HAND[0] + 2, HAND[1]], 0, 1), ...feet });
  const bot = (feet: Partial<Pose>) => ({ ...top(feet), anchor: { j: 'nShoulder' as JointName, at: [-40, HAND[1] - 34] as Vec } });
  const far: Partial<Pose> = { nl: { a: 0, b: 0, c: -55, ik: [30, -10], bend: -1 }, fl: { a: 0, b: 0, c: -55, ik: [30, -10], bend: -1 } };
  const near: Partial<Pose> = { nl: planted(20), fl: planted(20) };
  defs.dips = {
    normal: V('', ['Hände hinter dir auf die Stuhlkante, Finger nach vorne', 'Beine gestreckt, Fersen am Boden', 'Ellbogen nach hinten beugen, dann hochdrücken'], 2.6, [K(0, top(far)), K(0.12, top(far)), K(0.5, bot(far)), K(0.6, bot(far))], {
      props: [chair],
      contacts: [{ j: 'nWrist', y: HAND[1], r: 0 }],
      still: 0.5,
    }),
    easy: V('', ['Hände hinter dir auf die Stuhlkante', 'Füße nah am Stuhl, Knie gebeugt', 'Langsam runter, mit den Armen hochdrücken'], 2.6, [K(0, top(near)), K(0.12, top(near)), K(0.5, bot(near)), K(0.6, bot(near))], {
      props: [chair],
      contacts: [{ j: 'nWrist', y: HAND[1], r: 0 }, ...feetContacts()],
      still: 0.5,
    }),
  };
}

// Handstand an der Wand / Pike-Halten mit erhöhten Füßen
{
  const hs = (d: number) => {
    const p = P({ torso: 90 + d, head: 100, nl: L(-90 + d, -90 + d, 180), fl: L(-88 + d, -88 + d, 182), anchor: { j: 'nShoulder', at: [0, WY - 71] } });
    return { ...p, na: palm(0, 0, 180, 1), fa: palm(2, 0, 180, 1) };
  };
  const heel = solve(hs(0)).J.nHeel;
  const boxTop = -52;
  const pk = (d: number) => {
    const p = P({ torso: 64 + d, head: 82, nl: L(150, 150, 80), fl: L(148, 148, 78), anchor: { j: 'nShoulder', at: [0, WY - 70] } });
    return { ...p, na: palm(4, 0, 180, 1), fa: palm(6, 0, 180, 1) };
  };
  const toe = solve(pk(0)).J.nToe;
  defs.handstand = {
    normal: V('', ['Hände schulterbreit, etwa eine Handlänge vor der Wand', 'Hochschwingen, Fersen lehnen an der Wand', 'Arme gestreckt, Bauch fest, halten'], 4, breathe(hs(0), hs(1.2)), {
      props: [{ k: 'wall', at: [heel[0] + 9, 0], facing: 1 }],
      contacts: [{ j: 'nWrist', y: 0, r: SK.wristLift }],
      still: 0.25,
    }),
    easy: V('', ['Füße auf Stuhl oder Kiste, Hände am Boden', 'Hüfte hoch über die Schultern schieben', 'Arme gestreckt halten'], 4, breathe(pk(0), pk(1.5)), {
      props: [{ k: 'box', at: [toe[0] - 40, 0], w: 52, h: -boxTop }],
      contacts: [{ j: 'nWrist', y: 0, r: SK.wristLift }],
      still: 0.25,
    }),
  };
  // keep the feet on the box: shift the box to the toes
  defs.handstand.easy.props![0].at = [toe[0] - 36, 0];
  defs.handstand.easy.props![0].h = -toe[1];
}

// L-Sitz / Tuck-Sitz
{
  const BLOCK = 16;
  const sit = (legs: Partial<Pose>, d: number, blocks: boolean) => {
    const y = blocks ? -BLOCK : 0;
    const p = P({ torso: -84, head: -80, anchor: { j: 'nShoulder', at: [0, y + WY - 70 + d] }, ...legs });
    return { ...p, na: palm(2, y, 0, 1), fa: palm(4, y, 0, 1) };
  };
  const L_ = { nl: L(-8, -8, -26), fl: L(-6, -6, -24) };
  const tuck = { nl: L(-42, 45, 20), fl: L(-40, 47, 22) };
  defs.lsit = {
    normal: V('', ['Hände neben der Hüfte auf zwei Blöcke oder den Boden', 'Arme durchdrücken, Po vom Boden heben', 'Beine gestreckt nach vorne halten'], 4, breathe(sit(L_, 0, true), sit(L_, -1.5, true)), {
      props: [{ k: 'box', at: [-10, 0], w: 24, h: BLOCK }],
      contacts: [{ j: 'nWrist', y: -BLOCK, r: SK.wristLift }],
      still: 0.25,
    }),
    easy: V('', ['Hände neben der Hüfte auf den Boden', 'Po anheben, Knie zur Brust', 'Füße in der Luft halten'], 4, breathe(sit(tuck, 0, false), sit(tuck, -1.5, false)), {
      contacts: [{ j: 'nWrist', y: 0, r: SK.wristLift }],
      still: 0.25,
    }),
  };
}

// Wadenheben
{
  const calf = (c: number, arms: Partial<Pose>) => P({ torso: -90, head: -90, nl: L(90, 90, c), fl: L(90, 90, c), anchor: { j: 'nBall', at: [20, 0] }, ...arms });
  const hip = { na: relTo('pelvis', [4, -4], 100), fa: relTo('pelvis', [6, -4], 100) };
  const wallHands = { na: grip([64, -150], -10, 1), fa: grip([66, -150], -10, 1) };
  defs.calves = {
    normal: V('', ['Hüftbreit stehen', 'Auf die Zehenspitzen hochdrücken', 'Oben kurz halten, langsam absenken'], 2, [K(0, calf(0, hip)), K(0.1, calf(0, hip)), K(0.45, calf(40, hip)), K(0.6, calf(40, hip))], {
      contacts: [{ j: 'nBall', y: 0 }],
      still: 0.5,
    }),
    easy: V('', ['Hände an die Wand', 'Auf die Zehenspitzen hochdrücken', 'Langsam absenken'], 2, [K(0, calf(0, wallHands)), K(0.1, calf(0, wallHands)), K(0.45, calf(36, wallHands)), K(0.6, calf(36, wallHands))], {
      props: [{ k: 'wall', at: [80, 0], facing: 1 }],
      contacts: [{ j: 'nBall', y: 0 }],
      still: 0.5,
    }),
  };
}

// Bizepsbeugen (alternating)
{
  const arm = (b: number, a = 94): LimbPose => L(a, b, b);
  const curl = (n: number, f: number) => stand(0, { na: arm(n, n < 0 ? 98 : 94), fa: arm(f, f < 0 ? 94 : 88) });
  const keys = [K(0, curl(92, 90)), K(0.25, curl(-62, 90)), K(0.5, curl(92, 90)), K(0.75, curl(92, -64))];
  defs.curls = {
    normal: V('', ['Ellbogen bleiben am Körper', 'Hantel bis zur Schulter beugen', 'Langsam wieder ganz strecken'], 3.2, keys, { props: [{ k: 'dumbbell', j: 'nWrist' }, { k: 'dumbbell', j: 'fWrist' }], contacts: feetContacts(), still: 0.25 }),
    easy: V('', ['Leichtere Hantel nehmen', 'Ellbogen bleiben am Körper', 'Langsam beugen und strecken'], 3.6, keys, { props: [{ k: 'dumbbell', j: 'nWrist', size: 0.7 }, { k: 'dumbbell', j: 'fWrist', size: 0.7 }], contacts: feetContacts(), still: 0.25 }),
  };
}

// Schulterdrücken
{
  const low = stand(0, { na: L(78, -90, -90), fa: L(80, -88, -88) });
  const high = stand(0, { na: L(-86, -88, -90), fa: L(-84, -86, -88) });
  const keys = [K(0, low), K(0.12, low), K(0.45, high), K(0.58, high)];
  defs.press = {
    normal: V('', ['Hanteln auf Schulterhöhe, Ellbogen unten', 'Gerade nach oben drücken', 'Bauch fest, kein Hohlkreuz'], 2.6, keys, { props: [{ k: 'dumbbell', j: 'nWrist' }, { k: 'dumbbell', j: 'fWrist' }], contacts: feetContacts(), still: 0.4 }),
    easy: V('', ['Leichtere Hanteln nehmen', 'Gerade nach oben drücken', 'Langsam zurück auf Schulterhöhe'], 2.8, keys, { props: [{ k: 'dumbbell', j: 'nWrist', size: 0.7 }, { k: 'dumbbell', j: 'fWrist', size: 0.7 }], contacts: feetContacts(), still: 0.4 }),
  };
}

// Rudern mit Band
{
  const POST: Vec = [150, -112];
  const base = stand(0, { root: [-6, -98], torso: -84, head: -86 });
  const fwd = { ...base, na: grip([58, -118], 0, 1), fa: grip([60, -118], 0, 1) };
  const pull = { ...base, na: grip([14, -112], 0, 1), fa: grip([16, -112], 0, 1) };
  const keys = [K(0, fwd), K(0.1, fwd), K(0.45, pull), K(0.58, pull)];
  const band = (color: string): Prop[] => [
    { k: 'post', at: POST },
    { k: 'band', pts: ['fWrist', POST], color },
    { k: 'band', pts: ['nWrist', POST], color },
  ];
  defs.rows = {
    normal: V('', ['Band auf Brusthöhe befestigen', 'Ellbogen eng am Körper nach hinten ziehen', 'Schulterblätter zusammen, langsam nachgeben'], 2.6, keys, { props: band('#ff6b5b'), contacts: feetContacts(), still: 0.45 }),
    easy: V('', ['Leichteres Band oder näher an die Befestigung', 'Ellbogen nach hinten ziehen', 'Langsam zurück'], 2.6, keys, { props: band('#3fc9bd'), contacts: feetContacts(), still: 0.45 }),
  };
}

// Kugelhantel-Schwünge
{
  const hinge = stand(0, { root: [-30, -90], torso: -28, head: -40, nl: planted(0), fl: planted(0), na: L(118, 118, 118), fa: L(116, 116, 116) });
  const top = stand(0, { root: [-2, STAND_Y + 0.5], torso: -92, head: -90, na: L(-4, -4, -4), fa: L(-2, -2, -2) });
  const mid = stand(0, { root: [-2, STAND_Y + 0.5], torso: -92, head: -90, na: L(48, 48, 48), fa: L(50, 50, 50) });
  defs.swings = {
    normal: V('', ['Hüfte nach hinten schieben, Rücken gerade', 'Hüfte explosiv nach vorne strecken', 'Die Kugel schwingt bis auf Brusthöhe, Arme locker'], 1.8, [K(0, hinge), K(0.45, top, { e: 'out' }), K(0.6, top), K(0.95, hinge, { e: 'in' })], {
      props: [{ k: 'kettlebell', j: 'nWrist' }],
      contacts: feetContacts(),
      still: 0.3,
    }),
    easy: V('', ['Leichtere Kugel nehmen', 'Hüfte nach hinten, dann nach vorne strecken', 'Nur bis Hüfthöhe schwingen'], 2, [K(0, hinge), K(0.45, mid, { e: 'out' }), K(0.55, mid), K(0.95, hinge, { e: 'in' })], {
      props: [{ k: 'kettlebell', j: 'nWrist', size: 0.8 }],
      contacts: feetContacts(),
      still: 0.3,
    }),
  };
}

// Bergsteiger: high plank, knees drive in one after the other
{
  const at: Vec = [-90, 0];
  const t = bisect((x) => J(pushBody(x, false, at), 'nShoulder')[1], WY - 0.985 * (SK.upper + SK.fore), 0, 60);
  const base = pushBody(t, false, at);
  const sh = solve(base).J.nShoulder;
  const toe = solve(base).J.nBall;
  const extended: LimbPose = { a: 180 - t, b: 180 - t, c: 90 - t, ik: [toe[0], 0], toe: true, bend: -1 };
  const driven: LimbPose = L(20, 172, 150);
  const body = (n: LimbPose, f: LimbPose) => ({ ...base, anchor: { j: 'nShoulder' as JointName, at: sh }, nl: n, fl: f, na: palm(sh[0] - 1), fa: palm(sh[0] - 1) });
  const A = body(driven, extended);
  const B = body(extended, driven);
  const drivenSoft: LimbPose = L(50, 170, 150);
  const A2 = body(drivenSoft, extended);
  const B2 = body(extended, drivenSoft);
  defs.mountain = {
    normal: V('', ['Hände unter den Schultern, Körper gerade', 'Knie abwechselnd zügig Richtung Brust', 'Hüfte bleibt unten'], 1, [K(0, A), K(0.5, B)], { contacts: [{ j: 'nWrist', y: 0, r: SK.wristLift }], still: 0 }),
    easy: V('', ['Hände unter den Schultern', 'Ein Knie langsam nach vorne, Fuß wieder ablegen', 'Dann das andere Bein'], 2.6, [K(0, A2), K(0.2, A2), K(0.5, B2), K(0.7, B2)], { contacts: [{ j: 'nWrist', y: 0, r: SK.wristLift }], still: 0.1 }),
  };
}

// Hockstrecksprünge (burpees)
{
  const standUp = stand(0, { fl: onBall([23, 0], 0), nl: onBall([23, 0], 0), na: L(80, 70, 70), fa: L(78, 68, 68) });
  const HX = 66;
  const crouch = stand(0, { root: [-12, -44], torso: -18, head: -6, nl: onBall([23, 0], 22), fl: onBall([23, 0], 22), na: palm(HX), fa: palm(HX + 2) });
  // plank: shoulders over the hands, feet jumped back
  const plankAt = (t: number) => P({ torso: -t, head: -t + 8, nl: L(180 - t, 180 - t, 90 - t), fl: L(180 - t, 180 - t, 90 - t), anchor: { j: 'nShoulder', at: [HX + 1, WY - 71] }, na: palm(HX), fa: palm(HX + 2) });
  const tP = bisect((t) => lowestY(solve(plankAt(t)), false, ['hand', 'fore', 'upper']), 0, 0, 45);
  const plank = plankAt(tP);
  const halfP = { ...plank, fl: { ...crouch.fl } };
  const hop = (A: Pose, B: Pose, lift = 14) => {
    const p = blend(A, B, solve(A), solve(B), 0.5);
    return { ...p, root: add(p.root!, [0, -lift]) };
  };
  const out = hop(crouch, plank);
  const back = hop(plank, crouch);
  const air = P({ root: [0, -122], torso: -88, head: -86, nl: L(90, 92, 50), fl: L(88, 90, 50), na: L(-80, -84, -84), fa: L(-84, -88, -88) });
  const reach = stand(0, { fl: onBall([23, 0], 0), nl: onBall([23, 0], 0), na: L(-84, -86, -86), fa: L(-86, -88, -88) });
  defs.burpees = {
    normal: V('', ['In die Hocke, Hände vor die Füße', 'Füße nach hinten springen in den Liegestütz, zurück in die Hocke', 'Hochspringen und Arme nach oben strecken'], 3.2, [
      K(0, standUp), K(0.14, crouch), K(0.21, out), K(0.28, plank), K(0.4, plank), K(0.47, back), K(0.54, crouch), K(0.7, air, { e: 'out' }), K(0.84, standUp, { e: 'in' }),
    ], { still: 0.3 }),
    easy: V('', ['In die Hocke, Hände vor die Füße', 'Beine nacheinander nach hinten und wieder vor', 'Aufstehen und Arme strecken, ohne Sprung'], 5.2, [
      K(0, standUp), K(0.12, crouch), K(0.18, hop(crouch, halfP, 10)), K(0.24, halfP), K(0.36, plank), K(0.46, plank), K(0.58, halfP), K(0.64, hop(halfP, crouch, 10)), K(0.7, crouch), K(0.82, standUp), K(0.9, reach),
    ], { contacts: [], still: 0.36 }),
  };
}

// Hampelmänner (front view)
{
  const closed = (y = -100) => P({ root: [0, y], nl: planted(10), fl: planted(-10), na: L(82, 86, 86), fa: L(98, 94, 94) });
  const open = P({ root: [0, -95], nl: planted(40), fl: planted(-40), na: L(-60, -76, -76), fa: L(-120, -104, -104) });
  const air = P({ root: [0, -114], nl: L(80, 82, 0), fl: L(100, 98, 0), na: L(-10, -30, -30), fa: L(-170, -150, -150) });
  const airB = P({ root: [0, -114], nl: L(80, 82, 0), fl: L(100, 98, 0), na: L(10, 0, 0), fa: L(170, 180, 180) });
  const stepN = P({ root: [4, -96], nl: planted(44), fl: planted(-10), na: L(-60, -76, -76), fa: L(-120, -104, -104) });
  const stepF = P({ root: [-4, -96], nl: planted(10), fl: planted(-44), na: L(-60, -76, -76), fa: L(-120, -104, -104) });
  defs.jacks = {
    normal: V('', ['Aufrecht stehen, Füße zusammen', 'Springen: Beine auseinander, Arme über den Kopf', 'Zurückspringen in die Ausgangsstellung'], 1.2, [K(0, closed()), K(0.25, airB), K(0.5, open), K(0.75, air)], { front: true, still: 0.5 }),
    easy: V('', ['Ein Bein zur Seite tippen, Arme hoch', 'Zurück zur Mitte, Arme runter', 'Dann die andere Seite, ohne Sprung'], 2.4, [K(0, closed()), K(0.25, stepN), K(0.5, closed()), K(0.75, stepF)], { front: true, still: 0.25 }),
  };
}

// Laufen / Gehen (side view, running in place on the spot)
{
  const runA = ground(P({ torso: -78, head: -84, nl: L(58, 88, -6), fl: L(122, 172, 120), na: L(130, 50, 50), fa: L(50, -40, -40) }), false, -1.5);
  const runB = ground(P({ torso: -78, head: -84, nl: L(92, 104, 10), fl: L(30, 110, 50), na: L(96, 20, 20), fa: L(80, -10, -10) }), false, -1.5);
  const runC = ground(P({ torso: -78, head: -84, nl: L(114, 140, 62), fl: L(38, 100, 10), na: L(70, -30, -30), fa: L(118, 60, 60) }), false, -6);
  const walkA = ground(P({ torso: -88, head: -88, nl: L(68, 82, -10), fl: L(112, 116, 30), na: L(115, 95, 95), fa: L(70, 55, 55) }));
  const walkB = ground(P({ torso: -88, head: -88, nl: L(90, 92, 0), fl: L(80, 120, 50), na: L(92, 85, 85), fa: L(88, 80, 80) }));
  defs.run = {
    normal: V('', ['Locker aufrecht, leicht nach vorne geneigt', 'Kurze Schritte, auf dem Mittelfuß landen', 'Arme schwingen im rechten Winkel mit'], 0.8, [K(0, runA, { e: 'lin' }), K(0.17, runB, { e: 'lin' }), K(0.33, runC, { e: 'lin' }), K(0.5, mirror(runA), { e: 'lin' }), K(0.67, mirror(runB), { e: 'lin' }), K(0.83, mirror(runC), { e: 'lin' })], { floor: 'mat', still: 0 }),
    easy: V('', ['Eine Minute locker laufen', 'Dann eine Minute zügig gehen', 'Im Wechsel, bis die Strecke geschafft ist'], 1.3, [K(0, walkA, { e: 'lin' }), K(0.25, walkB, { e: 'lin' }), K(0.5, mirror(walkA), { e: 'lin' }), K(0.75, mirror(walkB), { e: 'lin' })], { still: 0 }),
  };
}

// Seilspringen
{
  const hands = { na: L(100, 20, 10), fa: L(98, 18, 8) };
  const ground1 = stand(0, { root: [-1, STAND_Y + 3], nl: onBall([23, 0], 18), fl: onBall([23, 0], 18), ...hands });
  const airP = P({ root: [0, STAND_Y - 17], nl: L(90, 92, 40), fl: L(89, 91, 40), ...hands });
  const jogA = P({ root: [0, STAND_Y - 4], nl: onBall([23, 0], 20), fl: L(70, 128, 40), ...hands });
  const jogB = P({ root: [0, STAND_Y - 4], nl: L(70, 128, 40), fl: onBall([23, 0], 20), ...hands });
  defs.rope = {
    normal: V('', ['Kleine Sprünge auf den Fußballen', 'Ellbogen nah am Körper, Seil aus den Handgelenken drehen', 'Locker und gleichmäßig atmen'], 0.55, [K(0, ground1), K(0.5, airP, { e: 'out' })], { props: [{ k: 'rope', n: 1 }], still: 0.5 }),
    easy: V('', ['Langsames Tempo', 'Abwechselnd ein Fuß, wie beim Joggen auf der Stelle', 'Pausen machen, wenn nötig'], 1.2, [K(0, jogA), K(0.5, jogB)], { props: [{ k: 'rope', n: 2 }], still: 0.25 }),
  };
}

// Radfahren (Heimtrainer)
{
  const C: Vec = [0, -38];
  const R = 17;
  const keysFor = (torso: number, seat: Vec, bar: Vec): Key[] => {
    const out: Key[] = [];
    for (let i = 0; i < 8; i++) {
      const phi = (i / 8) * 360;
      const pn = add(C, rot(phi, [R, 0]));
      const pf = add(C, rot(phi + 180, [R, 0]));
      const cn = 12 + 14 * Math.sin((phi * Math.PI) / 180);
      const cf = 12 + 14 * Math.sin(((phi + 180) * Math.PI) / 180);
      out.push(
        K(i / 8, P({ root: seat, torso, head: torso + 12, nl: { ...onBall(pn, cn) }, fl: { ...onBall(pf, cf) }, na: grip(bar, 0, 1), fa: grip(add(bar, [2, 0]), 0, 1) }), { e: 'lin' }),
      );
    }
    return out;
  };
  const props: Prop[] = [{ k: 'bike', at: C }];
  defs.bike = {
    normal: V('', ['Sattel auf Hüfthöhe einstellen', 'Gleichmäßig und rund treten', 'Oberkörper ruhig, Hände locker am Lenker'], 1, keysFor(-52, [-38, -121], [26, -126]), { props, floor: 'mat', still: 0.25 }),
    easy: V('', ['Wenig Widerstand einstellen', 'Locker und gleichmäßig treten', 'Aufrecht sitzen, normal atmen'], 1.6, keysFor(-74, [-38, -121], [20, -124]), { props, still: 0.25 }),
  };
}

// Schwimmen (freestyle, side view)
{
  const SURF = -60;
  const sw = (n: number, f: number, kick: number) =>
    P({ root: [0, SURF + 4], torso: -2, head: 6, nl: L(180 + kick, 184 + kick, 166 + kick), fl: L(180 - kick, 184 - kick, 166 - kick), na: L(n, n, n), fa: L(f, f, f) });
  const recov = (n: number, f: number, kick: number, recNear: boolean) => {
    const p = sw(n, f, kick);
    const bentRec = L(-120, -40, -40);
    return recNear ? { ...p, na: bentRec } : { ...p, fa: bentRec };
  };
  const keys = [
    K(0, sw(0, 150, 8), { e: 'lin' }),
    K(0.25, sw(60, 220, -8), { e: 'lin' }),
    K(0.5, sw(130, 0, 8), { e: 'lin' }),
    K(0.75, recov(240, 60, -8, true), { e: 'lin' }),
  ];
  keys[1] = K(0.25, recov(60, 240, -8, false), { e: 'lin' });
  const glide = sw(0, 2, 0);
  const keysE = [K(0, glide), K(0.25, glide), K(0.4, recov(60, 240, -6, false)), K(0.55, sw(130, 0, 6)), K(0.7, recov(240, 60, -6, true)), K(0.85, sw(0, 130, 6))];
  defs.swim = {
    normal: V('', ['Flach im Wasser liegen, Gesicht ins Wasser', 'Arme abwechselnd weit nach vorne und unter dem Körper durchziehen', 'Beine schlagen locker aus der Hüfte'], 1.6, keys, {
      floor: 'water',
      props: [{ k: 'water', at: [0, SURF] }],
      still: 0.25,
    }),
    easy: V('', ['Ruhiges Tempo', 'Nach jedem Zug kurz gleiten', 'Am Beckenrand Pausen machen'], 3, keysE, { floor: 'water', props: [{ k: 'water', at: [0, SURF] }], still: 0.4 }),
  };
}

// Treppen steigen: the steps scroll down so the climber stays in place
{
  const w = 32;
  const h = 18;
  const P0: Vec = [-22, 0];
  const P1: Vec = [P0[0] + w, -h];
  const mid = (a: Vec): Vec => [a[0] - w / 2, a[1] + h / 2];
  const body = (lean: number, extra: Partial<Pose>) => P({ root: [-14, -112], torso: lean, head: lean + 4, ...extra });
  const rail = { na: grip([18, -96], -20, 1) };
  const mk = (lean: number, withRail: boolean): Key[] => {
    const arms = withRail ? rail : {};
    return [
      K(0, body(lean, { root: [-18, -104], nl: onBall(P1, 0), fl: onBall(P0, 20), ...arms }), { e: 'lin' }),
      K(0.25, body(lean, { root: [-17, -106], nl: onBall(mid(P1), 0), fl: L(50, 120, 10), ...arms }), { e: 'lin' }),
      K(0.5, body(lean, { root: [-18, -104], fl: onBall(P1, 0), nl: onBall(P0, 20), ...arms }), { e: 'lin' }),
      K(0.75, body(lean, { root: [-17, -106], fl: onBall(mid(P1), 0), nl: L(50, 120, 10), ...arms }), { e: 'lin' }),
    ];
  };
  const stairs: Prop = { k: 'stairs', at: [P0[0] - 26, 0], w, h, n: 6, scroll: 2 };
  defs.stairs = {
    normal: V('', ['Ganzen Fuß auf die Stufe setzen', 'Aufrecht bleiben, Blick nach vorne', 'Zügig und gleichmäßig steigen'], 1.4, mk(-84, false), { props: [stairs], floor: 'none', still: 0.25 }),
    easy: V('', ['Langsam steigen, Hand am Geländer', 'Jede Stufe einzeln', 'Pausen auf dem Absatz sind erlaubt'], 2.6, mk(-86, true), {
      props: [stairs, { k: 'rail', at: [-150, -96 + 168 * (h / w)], w: 300, h: 300 * (h / w) }],
      floor: 'none',
      still: 0.25,
    }),
  };
}

// Dehnen: three stretches in a row
{
  const quad = (d: number, wall: boolean) =>
    P({
      root: [0, STAND_Y + 1],
      torso: -90,
      head: -90,
      fl: planted(0),
      nl: L(98 + d, -88 - d, -40),
      na: relTo('nAnkle', [2, 2], 100, -1),
      fa: wall ? grip([70, -150], -10, 1) : L(-10, -10, -10),
    });
  const fold = (d: number, soft: boolean) =>
    soft
      ? stand(0, { root: [-22, -86], torso: -30 - d, head: -10 - d, na: relTo('nKnee', [4, -14], 90, 1), fa: relTo('nKnee', [6, -14], 90, 1) })
      : stand(0, { root: [-26, -98], torso: 34 + d, head: 66 + d, na: relTo('nAnkle', [8, -24 + d], 100, 1), fa: relTo('nAnkle', [10, -24 + d], 100, 1) });
  const tri = (d: number, deep: boolean) =>
    stand(0, { na: L(-98 - d, deep ? 120 : 60, 120), fa: relTo('nElbow', [4, 6], 0, -1), head: -86 });
  const mk = (soft: boolean): Key[] => [
    K(0, quad(0, soft), { cut: true }),
    K(0.15, quad(soft ? 4 : 10, soft)),
    K(0.333, fold(0, soft), { cut: true }),
    K(0.48, fold(soft ? 3 : 8, soft)),
    K(0.666, tri(0, !soft), { cut: true }),
    K(0.82, tri(6, !soft)),
  ];
  defs.stretch = {
    normal: V('', ['Oberschenkel: Ferse zum Po ziehen', 'Rückseite: Beine gestreckt, Oberkörper nach vorne fallen lassen', 'Trizeps: Ellbogen hinter den Kopf, sanft ziehen'], 9, mk(false), { still: 0.15 }),
    easy: V('', ['Oberschenkel: eine Hand an der Wand', 'Rückseite: Knie gebeugt, Hände auf die Oberschenkel', 'Arm nur so weit, wie es angenehm ist'], 9, mk(true), {
      props: [{ k: 'wall', at: [84, 0], facing: 1, on: [0, 0.333] }],
      still: 0.15,
    }),
  };
}

// Mobilisation: arm circles, then leg swings
{
  const circ = (a: number, bent: boolean) => stand(0, { na: bent ? L(a, a + 155, a + 155) : L(a, a, a), fa: bent ? L(a + 4, a + 159, a + 159) : L(a + 4, a + 4, a + 4) });
  const swing = (a: number, chair: boolean) =>
    P({ root: [-2, -101], fl: planted(0), nl: L(a, a + 25, a - 110), na: L(50, 10, 10), fa: chair ? grip([-40, -100], 60, 1) : L(-10, -12, -12) });
  const mk = (bent: boolean, lo: number, hi: number, chair: boolean): Key[] => [
    K(0, circ(90, bent), { cut: true }),
    K(0.125, circ(180, bent), { e: 'lin' }),
    K(0.25, circ(270, bent), { e: 'lin' }),
    K(0.375, circ(0, bent), { e: 'lin' }),
    K(0.5, swing(90, chair), { cut: true }),
    K(0.625, swing(lo, chair)),
    K(0.875, swing(hi, chair)),
  ];
  defs.mobility = {
    normal: V('', ['Arme groß nach hinten kreisen', 'Ein Bein locker vor und zurück schwingen', 'Ruhig atmen, nichts erzwingen'], 7, mk(false, 30, 140, false), { still: 0.2 }),
    easy: V('', ['Hände auf die Schultern, Ellbogen kreisen', 'Bein klein vor und zurück schwingen', 'Mit einer Hand festhalten'], 8, mk(true, 60, 115, true), {
      props: [{ k: 'chair', at: [-76, 0], w: 40, h: 40, facing: 1, on: [0.5, 1] }],
      still: 0.2,
    }),
  };
}

// Hüftöffner: low lunge, then deep squat
{
  const KNEE: Vec = [-40, -SK.kneeR];
  const lunge = (a: number, softHands: boolean) =>
    P({
      torso: -92,
      head: -90,
      anchor: { j: 'fKnee', at: KNEE },
      fl: L(a, 180, 172),
      nl: planted(48),
      na: relTo('nKnee', softHands ? [-14, -12] : [2, -14], 0, 1),
      fa: relTo('nKnee', softHands ? [-12, -12] : [4, -14], 0, 1),
    });
  const deep = (d: number) => stand(0, { root: [-18, -40 - d], torso: -66, head: -78, na: relTo('nShoulder', [34, 22], -70, 1), fa: relTo('nShoulder', [36, 22], -70, 1) });
  const half = (d: number) => stand(0, { root: [-26, -70 - d], torso: -66, head: -78, na: grip([56, -96], -10, 1), fa: grip([58, -96], -10, 1) });
  defs.hips = {
    normal: V('', ['Tiefer Ausfallschritt, hinteres Knie am Boden', 'Hüfte sanft nach vorne unten schieben', 'Danach tiefe Hocke, Ellbogen drücken die Knie auseinander'], 8, [
      K(0, lunge(118, false), { cut: true }),
      K(0.2, lunge(134, false)),
      K(0.5, deep(0), { cut: true }),
      K(0.7, deep(4)),
    ], { still: 0.2 }),
    easy: V('', ['Ausfallschritt, Knie auf einer weichen Unterlage', 'Hüfte nur leicht nach vorne schieben', 'Halbe Hocke, an etwas festhalten'], 8, [
      K(0, lunge(108, true), { cut: true }),
      K(0.2, lunge(118, true)),
      K(0.5, half(0), { cut: true }),
      K(0.7, half(4)),
    ], { props: [{ k: 'post', at: [66, -96], on: [0.5, 1] }], still: 0.2 }),
  };
}

// Dehnen mit Band: lying hamstring stretch, then seated fold
{
  const lying = (a: number, bent: boolean) =>
    P({ root: [0, -14.5], torso: 180, head: 212, fl: L(0, 0, -90), nl: bent ? L(a, a + 30, a - 60) : L(a, a, a - 90), na: grip([-8, -62], -60, 1), fa: grip([-6, -62], -60, 1) });
  const seated = (t: number, bent: boolean) =>
    ground(
      P({
        root: [0, -30],
        torso: t,
        head: t + 14,
        nl: bent ? L(-30, 40, -40) : L(0, 0, -80),
        fl: bent ? L(-28, 42, -38) : L(0, 0, -78),
        na: bent ? grip([30, -52], -10, 1) : grip([50, -40], -10, 1),
        fa: bent ? grip([32, -52], -10, 1) : grip([52, -40], -10, 1),
      }),
    );
  const mk = (bent: boolean): Key[] => [
    K(0, lying(bent ? -56 : -72, bent), { cut: true }),
    K(0.22, lying(bent ? -62 : -82, bent)),
    K(0.5, seated(bent ? -78 : -58, bent), { cut: true }),
    K(0.72, seated(bent ? -74 : -50, bent)),
  ];
  const bands: Prop[] = [
    { k: 'band', pts: ['nWrist', 'nBall', 'fWrist'], on: [0, 0.5], color: '#a985f2' },
    { k: 'band', pts: ['nWrist', 'nBall', 'fWrist'], on: [0.5, 1], color: '#a985f2' },
  ];
  defs.bandstretch = {
    normal: V('', ['Auf dem Rücken, Band um den Fuß, Bein gestreckt hochziehen', 'Danach im Sitzen: Band um die Füße, Oberkörper nach vorne', 'Jede Dehnung ruhig halten, nicht wippen'], 8, mk(false), { props: bands, still: 0.15 }),
    easy: V('', ['Bein nur so hoch, wie es angenehm ist', 'Knie dürfen leicht gebeugt sein', 'Im Sitzen aufrecht bleiben'], 8, mk(true), { props: bands, still: 0.15 }),
  };
}

// Gerätetraining: lat pulldown machine
{
  const SEAT: Vec = [0, -44];
  const base = (lean: number, wrist: Vec) =>
    P({ root: [0, SEAT[1] - 13], torso: lean, head: lean + 2, nl: planted(50), fl: planted(50), na: grip(wrist, -90, -1), fa: grip(add(wrist, [2, 0]), -90, -1) });
  const up = base(-90, [6, -182]);
  const down = base(-100, [14, -128]);
  const keys = [K(0, up), K(0.12, up), K(0.45, down), K(0.58, down)];
  defs.gym = {
    normal: V('', ['Sitz und Polster einstellen', 'Stange zur oberen Brust ziehen, Ellbogen nach unten', 'Langsam zurück, Gewicht kontrollieren'], 2.6, keys, { props: [{ k: 'machine', at: SEAT, n: 6 }], contacts: feetContacts(), still: 0.45 }),
    easy: V('', ['Weniger Gewicht einstecken', 'Ruhig und sauber ziehen', 'Zwischen den Sätzen Pause machen'], 3, keys, { props: [{ k: 'machine', at: SEAT, n: 3 }], contacts: feetContacts(), still: 0.45 }),
  };
}

// ---------- registry ----------

const titleOf = (id: string) => QUEST_POOL.find((q) => q.id === id)?.title ?? id;

/** Animation definitions for every built-in exercise except steps, reading and walking. */
export const EXERCISE_ANIMS: Record<string, ExerciseAnimDef> = Object.fromEntries(
  Object.entries(defs).map(([id, d]) => [
    id,
    {
      id,
      title: titleOf(id),
      normal: { ...d.normal, name: titleOf(id) },
      easy: { ...d.easy, name: VARIANTS[id] ?? titleOf(id) + ' leicht' },
    },
  ]),
);

export const hasExerciseAnim = (id: string | undefined) => !!id && id in EXERCISE_ANIMS;
