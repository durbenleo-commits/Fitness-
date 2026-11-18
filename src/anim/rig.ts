// Pure rig math for the exercise animations: no DOM, no React. Tested in rig.test.ts.
//
// The figure is a 2D puppet seen from the side (it faces right) or from the front.
// - Coordinates: SVG convention, x to the right, y down. The floor is y = 0, so "up" is negative y.
// - Angles are world angles in degrees: 0 = right, 90 = down, -90 = up, 180 = left.
// - The pelvis is the root. Joint positions come from forward kinematics, so parts cannot come apart.
// - A pose may pin one joint to a point (anchor) and solve any limb with a two-bone IK to a target,
//   so hands and feet stay planted while the body moves.
// - Each bone is drawn in its own space: joint at (0,0), bone along +x, front/chest side is +y.
//   Side view: torso +y is the chest. Front view: torso +y is the figure's left side (screen right when upright).

export type Vec = [number, number];

export const rad = (d: number) => (d * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;
export function rot(a: number, [x, y]: Vec): Vec {
  const c = Math.cos(rad(a));
  const s = Math.sin(rad(a));
  return [x * c - y * s, x * s + y * c];
}
export const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
export const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpV = (a: Vec, b: Vec, t: number): Vec => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export function lerpAngle(a: number, b: number, t: number) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}
export const angleOf = (v: Vec) => deg(Math.atan2(v[1], v[0]));

export type Ease = 'io' | 'lin' | 'in' | 'out';
export function ease(t: number, e: Ease = 'io') {
  if (e === 'lin') return t;
  if (e === 'in') return 1 - Math.cos((Math.PI * t) / 2);
  if (e === 'out') return Math.sin((Math.PI * t) / 2);
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

/** Skeleton sizes (one unit is roughly 1 cm on a 1.80 m figure). */
export const SK = {
  torso: 60, // pelvis -> top of spine
  shoulder: [55, -1] as Vec, // shoulder joint in torso space (side view)
  neck: [57, -6] as Vec, // neck base in torso space (side view)
  headR: 19, // neck base -> head centre
  thigh: 48,
  shin: 46,
  upper: 38,
  fore: 34,
  toe: [26, 5] as Vec, // toe tip in foot space
  ball: [23, 8] as Vec, // ball of the foot on the sole
  heel: [-6, 8] as Vec, // heel on the sole
  sole: 8, // ankle centre above the floor when the foot is flat
  fingers: [14, 0] as Vec, // finger tips in hand space
  wristLift: 6, // wrist centre above the floor when the palm is flat
  kneeR: 8.5, // knee radius: knee centre above the floor when kneeling
};

/** Front view: shoulders and hips sit apart left and right. */
export const FRONT = {
  shoulder: { n: [53, 18] as Vec, f: [53, -18] as Vec },
  hip: { n: [2, 9] as Vec, f: [2, -9] as Vec },
  neck: [57, 0] as Vec,
  ball: [5, 8] as Vec,
  heel: [-5, 8] as Vec,
  toe: [8, 6] as Vec,
};

/** Draw offset of the far-side limbs in side view (depth). The front view has none. */
export const FAR_OFFSET: Vec = [7, -5];

export type Side = 'n' | 'f';
export type LimbKey = 'nl' | 'fl' | 'na' | 'fa';
export const LIMBS: LimbKey[] = ['nl', 'fl', 'na', 'fa'];

export type JointName =
  | 'pelvis'
  | 'neck'
  | 'head'
  | `${Side}${'Hip' | 'Knee' | 'Ankle' | 'Toe' | 'Ball' | 'Heel' | 'Shoulder' | 'Elbow' | 'Wrist' | 'Fingers'}`;

export type BoneName = 'torso' | 'head' | `${Side}${'Thigh' | 'Shin' | 'Foot' | 'Upper' | 'Fore' | 'Hand'}`;

/** An IK target: a world point, or a point relative to a joint that is not part of the same limb. */
export type Target = Vec | { rel: JointName; off: Vec };

export interface LimbPose {
  a: number; // thigh / upper arm world angle (FK)
  b: number; // shin / forearm world angle (FK)
  c: number; // foot / hand world angle (always used, also with IK)
  s?: number; // length scale of the first bone (foreshortening), default 1
  ik?: Target; // solve the limb so its end reaches this point (ankle / wrist, or the ball of the foot with toe)
  bend?: 1 | -1; // which way the knee / elbow points: +1 clockwise of the base->end line, -1 the other way
  toe?: boolean; // legs: the IK target is the ball of the foot instead of the ankle
}

export interface Pose {
  torso: number;
  head: number;
  root?: Vec; // pelvis position (ignored with anchor)
  anchor?: { j: JointName; at: Vec }; // pin this joint (not on an IK limb) to a point
  nl: LimbPose; // near leg
  fl: LimbPose; // far leg
  na: LimbPose; // near arm
  fa: LimbPose; // far arm
}

export interface Solved {
  J: Record<JointName, Vec>;
  ang: Record<BoneName, number>;
  len: { nThigh: number; fThigh: number; nUpper: number; fUpper: number };
  /** Distance between each IK target and where the limb end really is (0 when reached). */
  ikErr: Partial<Record<LimbKey, number>>;
}

const LIMB_INFO: Record<LimbKey, { side: Side; leg: boolean }> = {
  nl: { side: 'n', leg: true },
  fl: { side: 'f', leg: true },
  na: { side: 'n', leg: false },
  fa: { side: 'f', leg: false },
};

/** Joints that belong to a limb (these move when the limb is solved with IK). */
export function limbJoints(k: LimbKey): JointName[] {
  const { side, leg } = LIMB_INFO[k];
  return leg
    ? [`${side}Knee`, `${side}Ankle`, `${side}Toe`, `${side}Ball`, `${side}Heel`]
    : [`${side}Elbow`, `${side}Wrist`, `${side}Fingers`];
}

function footPts(front: boolean) {
  return front ? { toe: FRONT.toe, ball: FRONT.ball, heel: FRONT.heel } : { toe: SK.toe, ball: SK.ball, heel: SK.heel };
}

/** Two-bone solve from base towards target; returns first-bone angle, joint, end and the miss distance. */
export function twoBone(base: Vec, target: Vec, L1: number, L2: number, bend: 1 | -1) {
  let v = sub(target, base);
  let d = Math.hypot(v[0], v[1]);
  const maxD = L1 + L2 - 0.001;
  const minD = Math.abs(L1 - L2) + 0.001;
  let end = target;
  if (d < 1e-6) {
    v = [0, 1];
    d = minD;
    end = add(base, [0, minD]);
  } else if (d > maxD || d < minD) {
    const dc = Math.min(maxD, Math.max(minD, d));
    end = add(base, [(v[0] / d) * dc, (v[1] / d) * dc]);
    v = sub(end, base);
    d = dc;
  }
  const phi = angleOf(v);
  const cosA = Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)));
  const a1 = phi + bend * deg(Math.acos(cosA));
  const mid = add(base, rot(a1, [L1, 0]));
  const a2 = angleOf(sub(end, mid));
  return { a1, a2, mid, end, miss: dist(end, target) };
}

/** Forward kinematics, anchor, then IK for every limb that has a target. */
export function solve(pose: Pose, front = false): Solved {
  const J = {} as Record<JointName, Vec>;
  const ang = {} as Record<BoneName, number>;
  const T = pose.torso;
  ang.torso = T;
  ang.head = pose.head;
  J.pelvis = [0, 0];
  J.nShoulder = rot(T, front ? FRONT.shoulder.n : SK.shoulder);
  J.fShoulder = rot(T, front ? FRONT.shoulder.f : SK.shoulder);
  J.nHip = front ? rot(T, FRONT.hip.n) : [0, 0];
  J.fHip = front ? rot(T, FRONT.hip.f) : [0, 0];
  J.neck = rot(T, front ? FRONT.neck : SK.neck);
  J.head = add(J.neck, rot(pose.head, [SK.headR, 0]));
  const fp = footPts(front);
  const len = { nThigh: SK.thigh, fThigh: SK.thigh, nUpper: SK.upper, fUpper: SK.upper };

  const setLimb = (k: LimbKey, a: number, b: number, c: number) => {
    const { side, leg } = LIMB_INFO[k];
    const s = pose[k].s ?? 1;
    if (leg) {
      const L1 = SK.thigh * s;
      len[`${side}Thigh`] = L1;
      const hip = J[`${side}Hip`];
      J[`${side}Knee`] = add(hip, rot(a, [L1, 0]));
      J[`${side}Ankle`] = add(J[`${side}Knee`], rot(b, [SK.shin, 0]));
      J[`${side}Toe`] = add(J[`${side}Ankle`], rot(c, fp.toe));
      J[`${side}Ball`] = add(J[`${side}Ankle`], rot(c, fp.ball));
      J[`${side}Heel`] = add(J[`${side}Ankle`], rot(c, fp.heel));
      ang[`${side}Thigh`] = a;
      ang[`${side}Shin`] = b;
      ang[`${side}Foot`] = c;
    } else {
      const L1 = SK.upper * s;
      len[`${side}Upper`] = L1;
      J[`${side}Elbow`] = add(J[`${side}Shoulder`], rot(a, [L1, 0]));
      J[`${side}Wrist`] = add(J[`${side}Elbow`], rot(b, [SK.fore, 0]));
      J[`${side}Fingers`] = add(J[`${side}Wrist`], rot(c, SK.fingers));
      ang[`${side}Upper`] = a;
      ang[`${side}Fore`] = b;
      ang[`${side}Hand`] = c;
    }
  };
  for (const k of LIMBS) setLimb(k, pose[k].a, pose[k].b, pose[k].c);

  // place the body: anchor joint on its point, or pelvis on root
  const off = pose.anchor ? sub(pose.anchor.at, J[pose.anchor.j]) : pose.root ?? [0, 0];
  for (const j of Object.keys(J) as JointName[]) J[j] = add(J[j], off);

  const ikErr: Solved['ikErr'] = {};
  for (const k of LIMBS) {
    const lp = pose[k];
    if (!lp.ik) continue;
    const { side, leg } = LIMB_INFO[k];
    const target: Vec = Array.isArray(lp.ik) ? lp.ik : add(J[lp.ik.rel], lp.ik.off);
    const toeShift = leg && lp.toe ? rot(lp.c, fp.ball) : ([0, 0] as Vec);
    const endTarget = sub(target, toeShift);
    const base = leg ? J[`${side}Hip`] : J[`${side}Shoulder`];
    const L1 = (leg ? SK.thigh : SK.upper) * (lp.s ?? 1);
    const L2 = leg ? SK.shin : SK.fore;
    const r = twoBone(base, endTarget, L1, L2, lp.bend ?? (leg ? -1 : 1));
    // recompute the limb from the solved angles (keeps joints exactly connected)
    setLimb(k, r.a1, r.a2, lp.c);
    ikErr[k] = r.miss;
  }
  return { J, ang, len, ikErr };
}

// ---------- keyframes and variants ----------

export interface Key {
  t: number; // time in the cycle, 0..1 (first key should be at 0)
  pose: Pose;
  e?: Ease; // easing of the move INTO this key, default 'io'
  cut?: boolean; // jump to this key without blending (sequence of separate poses)
}

export type PropKind =
  | 'chair'
  | 'box'
  | 'wall'
  | 'bar'
  | 'dumbbell'
  | 'kettlebell'
  | 'band'
  | 'post'
  | 'rope'
  | 'bike'
  | 'water'
  | 'stairs'
  | 'rail'
  | 'machine';

export interface Prop {
  k: PropKind;
  /** chair, box, wall, stairs, bike, machine, post: reference point; bar: bar centre; water: surface y in at[1] */
  at?: Vec;
  w?: number;
  h?: number;
  n?: number; // stairs: number of steps
  /** attached props (dumbbell, kettlebell): the joint they hang from; band: the points it runs through */
  j?: JointName;
  pts?: (JointName | Vec)[];
  size?: number; // weight size factor
  facing?: 1 | -1; // chair: side of the backrest (-1 = backrest on the left)
  /** stairs: steps scrolled down-left per cycle so the climber stays in place */
  scroll?: number;
  /** visible only in this part of the cycle */
  on?: [number, number];
  color?: string;
}

/** A floor contact that must hold during [from, to] of the cycle: joint centre at height y (plus radius). */
export interface Contact {
  j: JointName;
  y: number; // surface height (0 = floor; negative = on a chair, step ...)
  r?: number; // distance from the joint centre to the surface (foot ball/heel: 0, wrist: wristLift, knee: kneeR ...)
  from?: number;
  to?: number;
}

export interface VariantAnim {
  name: string; // German title of this variant
  cues: string[]; // 1-3 short German cues
  dur: number; // seconds per cycle
  keys: Key[];
  front?: boolean; // front view
  props?: Prop[];
  contacts?: Contact[];
  floor?: 'mat' | 'water' | 'none';
  still?: number; // cycle time of the still frame (reduced motion, screenshots); default 0.5
}

export interface ExerciseAnimDef {
  id: string;
  title: string;
  normal: VariantAnim;
  easy: VariantAnim;
}

const cache = new WeakMap<Key, Solved>();
function solvedKey(k: Key, front: boolean): Solved {
  let s = cache.get(k);
  if (!s) {
    s = solve(k.pose, front);
    cache.set(k, s);
  }
  return s;
}

function limbEnd(s: Solved, k: LimbKey, toe: boolean): Vec {
  const { side, leg } = LIMB_INFO[k];
  if (leg) return toe ? s.J[`${side}Ball`] : s.J[`${side}Ankle`];
  return s.J[`${side}Wrist`];
}

function blendLimb(k: LimbKey, A: LimbPose, B: LimbPose, sa: Solved, sb: Solved, f: number): LimbPose {
  const out: LimbPose = {
    a: lerpAngle(A.a, B.a, f),
    b: lerpAngle(A.b, B.b, f),
    c: lerpAngle(A.c, B.c, f),
    s: lerp(A.s ?? 1, B.s ?? 1, f),
  };
  if (!A.ik && !B.ik) return out;
  out.bend = (B.ik ? B.bend : A.bend) ?? (LIMB_INFO[k].leg ? -1 : 1);
  const relA = A.ik && !Array.isArray(A.ik) ? A.ik : null;
  const relB = B.ik && !Array.isArray(B.ik) ? B.ik : null;
  if (relA && relB && relA.rel === relB.rel && !!A.toe === !!B.toe) {
    out.ik = { rel: relA.rel, off: lerpV(relA.off, relB.off, f) };
    out.toe = A.toe;
    return out;
  }
  const toe = A.ik && B.ik ? !!A.toe && !!B.toe : !!(A.ik ? A.toe : B.toe);
  out.toe = toe;
  out.ik = lerpV(limbEnd(sa, k, toe), limbEnd(sb, k, toe), f);
  return out;
}

/** Blend two keyframe poses; contacts shared by both stay put. */
export function blend(A: Pose, B: Pose, sa: Solved, sb: Solved, f: number): Pose {
  const p: Pose = {
    torso: lerpAngle(A.torso, B.torso, f),
    head: lerpAngle(A.head, B.head, f),
    nl: blendLimb('nl', A.nl, B.nl, sa, sb, f),
    fl: blendLimb('fl', A.fl, B.fl, sa, sb, f),
    na: blendLimb('na', A.na, B.na, sa, sb, f),
    fa: blendLimb('fa', A.fa, B.fa, sa, sb, f),
  };
  if (A.anchor && B.anchor && A.anchor.j === B.anchor.j) p.anchor = { j: A.anchor.j, at: lerpV(A.anchor.at, B.anchor.at, f) };
  else p.root = lerpV(sa.J.pelvis, sb.J.pelvis, f);
  return p;
}

/** Which two keys surround cycle time u, and how far between them (already eased). */
export function keyAt(v: VariantAnim, u: number) {
  const keys = v.keys;
  const t = ((u % 1) + 1) % 1;
  let i = keys.length - 1;
  for (let k = 0; k < keys.length; k++) if (keys[k].t <= t) i = k;
  const j = (i + 1) % keys.length;
  const t0 = keys[i].t;
  let t1 = keys[j].t;
  if (j === 0) t1 += 1;
  let tt = t;
  if (tt < t0) tt += 1;
  const span = t1 - t0;
  const raw = span > 0 ? (tt - t0) / span : 0;
  if (keys[j].cut) return { i, j, f: 0, raw };
  return { i, j, f: ease(Math.min(1, Math.max(0, raw)), keys[j].e), raw };
}

/** Interpolated pose at cycle time u (0..1). */
export function poseAt(v: VariantAnim, u: number): Pose {
  const { i, j, f } = keyAt(v, u);
  const A = v.keys[i];
  const B = v.keys[j];
  if (f <= 0) return A.pose;
  if (f >= 1) return B.pose;
  return blend(A.pose, B.pose, solvedKey(A, !!v.front), solvedKey(B, !!v.front), f);
}

/** Solved figure at cycle time u. */
export function frameAt(v: VariantAnim, u: number): Solved {
  return solve(poseAt(v, u), !!v.front);
}

/** Opacity dip around hard cuts between separate poses (1 = fully visible). */
export function cutFade(v: VariantAnim, u: number, width = 0.035): number {
  let o = 1;
  const t = ((u % 1) + 1) % 1;
  for (const k of v.keys) {
    if (!k.cut) continue;
    let d = Math.abs(t - k.t);
    d = Math.min(d, 1 - d);
    if (d < width) o = Math.min(o, d / width);
  }
  return o;
}

// ---------- outline points (floor checks and framing) ----------

function capsulePts(o: Vec, a: number, L: number, r0: number, r1: number): Vec[] {
  const p = (x: number, y: number) => add(o, rot(a, [x, y]));
  return [p(-r0, 0), p(0, -r0), p(0, r0), p(L / 2, -(r0 + r1) / 2), p(L / 2, (r0 + r1) / 2), p(L, -r1), p(L, r1), p(L + r1, 0)];
}
function shapePts(o: Vec, a: number, pts: Vec[]): Vec[] {
  return pts.map((q) => add(o, rot(a, q)));
}
const TORSO_PTS: Vec[] = [[-14, 1], [-11, -9], [-5, -13.5], [2, -14], [30, -14.5], [57, -14], [67, -10], [71, 1], [66, 12], [54, 17], [40, 17], [24, 14], [10, 13], [0, 12.5], [-9, 9]];
const TORSO_FRONT_PTS: Vec[] = [[-12, -16], [-14, 0], [-12, 16], [30, 19], [58, 23], [66, 14], [68, 0], [66, -14], [58, -23], [30, -19]];
const SHOE_PTS: Vec[] = [[-9.5, 0], [-7, 8], [26, 8], [26.8, 5], [20, -3.5], [4, -9], [-1, -9.5]];
const SHOE_FRONT_PTS: Vec[] = [[-8, 0], [-7, 8], [11, 8], [12, 2], [8, -6], [-4, -6]];
const HAND_PTS: Vec[] = [[-4, -5], [14, -4], [16.5, 0], [15, 5.5], [-3, 6]];
const circlePts = (c: Vec, r: number): Vec[] => Array.from({ length: 12 }, (_, i) => add(c, rot(i * 30, [r, 0])));

/** Points along the outline of every part, in world space, per side ('b' = body). */
export function outline(s: Solved, front = false): { side: Side | 'b'; part: string; pts: Vec[] }[] {
  const { J, ang, len } = s;
  const out: { side: Side | 'b'; part: string; pts: Vec[] }[] = [];
  for (const side of ['n', 'f'] as Side[]) {
    out.push({ side, part: 'thigh', pts: capsulePts(J[`${side}Hip`], ang[`${side}Thigh`], len[`${side}Thigh`], 11.5, 8.6) });
    out.push({ side, part: 'shin', pts: capsulePts(J[`${side}Knee`], ang[`${side}Shin`], SK.shin, 8.6, 6.3) });
    out.push({ side, part: 'foot', pts: shapePts(J[`${side}Ankle`], ang[`${side}Foot`], front ? SHOE_FRONT_PTS : SHOE_PTS) });
    out.push({ side, part: 'upper', pts: capsulePts(J[`${side}Shoulder`], ang[`${side}Upper`], len[`${side}Upper`], 8.8, 6.9) });
    out.push({ side, part: 'fore', pts: capsulePts(J[`${side}Elbow`], ang[`${side}Fore`], SK.fore, 6.9, 5.4) });
    out.push({ side, part: 'hand', pts: shapePts(J[`${side}Wrist`], ang[`${side}Hand`], HAND_PTS) });
  }
  out.push({ side: 'b', part: 'torso', pts: shapePts(J.pelvis, ang.torso, front ? TORSO_FRONT_PTS : TORSO_PTS) });
  out.push({ side: 'b', part: 'head', pts: circlePts(J.head, 17) });
  return out;
}

/** Lowest outline point of the figure (largest y), ignoring the given parts. */
export function lowestY(s: Solved, front = false, skip: string[] = []): number {
  let m = -Infinity;
  for (const o of outline(s, front)) if (!skip.includes(o.part)) for (const p of o.pts) m = Math.max(m, p[1]);
  return m;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Bounding box of the figure over the whole cycle, in display space (far limbs shifted by the depth offset). */
export function figureBounds(v: VariantAnim, samples = 48): Box {
  const b: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const off = v.front ? ([0, 0] as Vec) : FAR_OFFSET;
  for (let i = 0; i < samples; i++) {
    const s = frameAt(v, i / samples);
    for (const o of outline(s, v.front)) {
      for (const p0 of o.pts) {
        const p = o.side === 'f' ? add(p0, off) : p0;
        b.x0 = Math.min(b.x0, p[0]);
        b.y0 = Math.min(b.y0, p[1]);
        b.x1 = Math.max(b.x1, p[0]);
        b.y1 = Math.max(b.y1, p[1]);
      }
    }
  }
  return b;
}

/** Rough extent of a prop (for framing). */
export function propBounds(p: Prop): Box | null {
  const at = p.at ?? [0, 0];
  const w = p.w ?? 40;
  const h = p.h ?? 46;
  switch (p.k) {
    case 'chair':
      return { x0: at[0], y0: -h - (p.facing ? 46 : 0), x1: at[0] + w, y1: 0 };
    case 'box':
      return { x0: at[0], y0: -h, x1: at[0] + w, y1: 0 };
    case 'wall':
      return { x0: at[0] - 8, y0: -150, x1: at[0] + 8, y1: 0 };
    case 'bar':
      return at[1] > -160 ? { x0: at[0] - 30, y0: at[1] - 10, x1: at[0] + 10, y1: at[1] + 6 } : { x0: at[0] - 100, y0: at[1] - 18, x1: at[0] + 10, y1: 0 };
    case 'post':
      return { x0: at[0] - 8, y0: at[1] - 8, x1: at[0] + 8, y1: 0 };
    case 'stairs':
      return { x0: at[0], y0: at[1] - (p.n ?? 4) * h, x1: at[0] + (p.n ?? 4) * w + w, y1: 0 };
    case 'bike':
      return { x0: at[0] - 60, y0: at[1] - 120, x1: at[0] + 75, y1: 0 };
    case 'machine':
      return { x0: at[0] - 60, y0: -250, x1: at[0] + 80, y1: 0 };
    default:
      return null;
  }
}

/** Framing box for one variant and its props, padded, at a fixed aspect ratio (so switching keeps the layout). */
export function viewBoxFor(v: VariantAnim, aspect = 16 / 11, pad = 18): Box {
  const b: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (o: Box | null) => {
    if (!o) return;
    b.x0 = Math.min(b.x0, o.x0);
    b.y0 = Math.min(b.y0, o.y0);
    b.x1 = Math.max(b.x1, o.x1);
    b.y1 = Math.max(b.y1, o.y1);
  };
  grow(figureBounds(v));
  for (const p of v.props ?? []) if (p.k !== 'stairs' || !p.scroll) grow(propBounds(p));
  // keep the floor (and some of the mat below it) in frame
  b.y1 = Math.max(b.y1, 22);
  b.x0 -= pad;
  b.x1 += pad;
  b.y0 -= pad;
  let w = b.x1 - b.x0;
  let h = b.y1 - b.y0;
  if (w / h < aspect) {
    const nw = h * aspect;
    b.x0 -= (nw - w) / 2;
    w = nw;
  } else {
    const nh = w / aspect;
    b.y0 -= nh - h; // extra room goes on top so the floor stays near the bottom
    h = nh;
  }
  return { x0: b.x0, y0: b.y0, x1: b.x0 + w, y1: b.y0 + h };
}
