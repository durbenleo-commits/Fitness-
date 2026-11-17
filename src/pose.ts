// Rep counting from pose landmarks (MediaPipe's 33-point body model). Pure logic,
// unit-tested with synthetic poses; the camera screen only feeds frames in.

export interface Point {
  x: number; // 0..1, image width
  y: number; // 0..1, image height (down is larger)
  visibility?: number;
}

// MediaPipe pose landmark indices
const L = { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 };
const R = { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 };
const NOSE = 0;

export type ScanKind = 'reps' | 'hold' | 'presence';

/** How the camera must see the player: from the side, from the front (facing the phone), or either. */
export type ViewNeed = 'side' | 'front' | 'any';

export interface ScanSpec {
  kind: ScanKind;
  setup: string; // where to put the phone
  cue: string; // short instruction while moving
  view?: ViewNeed; // camera view the detector needs; missing = 'any'
  easySetup?: string; // easier variant, if the phone goes somewhere else
  easyCue?: string; // easier variant
  easyView?: ViewNeed; // easier variant, if it needs another view
}

/** Exercise id for presence mode: a timer that only runs while the player is clearly in view. */
export const PRESENCE = '__presence';

export const PRESENCE_SPEC: ScanSpec = {
  kind: 'presence',
  setup: 'Stell das Handy etwa 2–3 m entfernt auf, sodass du mit Schultern und Hüfte gut zu sehen bist.',
  cue: 'Die Zeit läuft nur, solange du gut zu sehen bist.',
  view: 'any',
};

/** Push-ups and planks are recognised from the side and head-on (phone in front of the head). */
const SIDE_OR_FRONT_SETUP =
  'Stell das Handy seitlich oder vor deinen Kopf auf den Boden, etwa 1,5–2 m entfernt. Von der Seite ist die Erkennung am genauesten.';

/** Standing leg exercises: the hip drop is measured from the side (knee angle) or from the front (hip height). */
const LEGS_SETUP =
  'Stell das Handy seitlich oder vor dich, etwa 2–3 m entfernt und nicht höher als deine Hüfte, sodass du von Kopf bis Fuß zu sehen bist.';

/** Exercises the camera can check, with how to set up the phone and which view the detector needs. */
export const SCANNABLE: Record<string, ScanSpec> = {
  pushups: { kind: 'reps', view: 'any', setup: SIDE_OR_FRONT_SETUP, cue: 'Runter bis die Arme gebeugt sind, dann ganz hoch.', easyCue: 'Knie am Boden lassen. Runter bis die Arme gebeugt sind, dann ganz hoch.' },
  squats: { kind: 'reps', view: 'any', setup: LEGS_SETUP, cue: 'Tief in die Hocke, dann ganz aufrichten.', easyCue: 'Halb in die Hocke, dann ganz aufrichten.' },
  lunges: { kind: 'reps', view: 'any', setup: LEGS_SETUP, cue: 'Großer Schritt, hinteres Knie Richtung Boden, zurück in den Stand.', easyCue: 'Halt dich an einer Stuhllehne fest. Hinteres Knie Richtung Boden, zurück in den Stand.' },
  jacks: { kind: 'reps', view: 'front', setup: 'Stell das Handy etwa 2–3 m vor dich, sodass du von vorne von Kopf bis Fuß zu sehen bist. Nur von vorne, nicht von der Seite.', cue: 'Arme über den Kopf und Beine auseinander, dann zurück.', easyCue: 'Ohne Sprung: ein Bein zur Seite und Arme über den Kopf, dann zurück.' },
  pullups: { kind: 'reps', view: 'any', setup: 'Stell das Handy etwa 2–3 m entfernt vor dich oder seitlich auf, sodass Stange, Kopf und Arme zu sehen sind. Bei weitem Griff ist von vorne am genauesten.', cue: 'Kinn über die Stange, dann Arme ganz strecken.', easySetup: 'Stell das Handy seitlich auf, etwa 2 m entfernt, sodass du unter der Stange von der Seite ganz zu sehen bist. Nur von der Seite.', easyCue: 'Schräg unter der Stange: Brust zur Stange ziehen, dann Arme ganz strecken.', easyView: 'side' },
  plank: { kind: 'hold', view: 'any', setup: SIDE_OR_FRONT_SETUP, cue: 'Körper gerade halten. Die Zeit läuft nur, solange die Haltung stimmt.', easyCue: 'Auf Unterarmen und Knien: Schultern, Hüfte und Knie in einer Linie. Die Zeit läuft nur in der Haltung.' },
  wallsit: { kind: 'hold', view: 'any', setup: LEGS_SETUP, cue: 'Knie etwa im rechten Winkel halten. Die Zeit läuft nur in der Haltung.', easyCue: 'Knie leicht gebeugt halten, höher als im rechten Winkel. Die Zeit läuft nur in der Haltung.' },
  situps: { kind: 'reps', view: 'side', setup: 'Leg das Handy seitlich neben dich auf den Boden, etwa 2 m entfernt, sodass du im Liegen von der Seite ganz zu sehen bist. Nur von der Seite, nicht an Kopf oder Füße.', cue: 'Oberkörper aufrichten, dann wieder ablegen.', easyCue: 'Oberkörper halb aufrichten, dann wieder ablegen.' },
  curls: { kind: 'reps', view: 'any', setup: 'Stell das Handy etwa 2 m entfernt seitlich oder vor dich, sodass Oberkörper, Arme und Hüfte zu sehen sind.', cue: 'Ellbogen am Körper, Hantel ganz hoch, dann Arm ganz strecken. Gezählt werden die Wiederholungen eines Arms.' },
  press: { kind: 'reps', view: 'any', setup: 'Stell das Handy etwa 2 m entfernt vor dich oder seitlich auf, sodass Kopf und ausgestreckte Arme zu sehen sind.', cue: 'Hanteln über den Kopf drücken, dann bis unter die Schultern senken.' },
  rows: { kind: 'reps', view: 'side', setup: 'Stell das Handy etwa 2 m entfernt seitlich auf, sodass Oberkörper und Arme von der Seite zu sehen sind. Nur von der Seite, nicht von vorne.', cue: 'Band zum Bauch ziehen, dann Arme ganz strecken.' },
  swings: { kind: 'reps', view: 'any', setup: 'Stell das Handy etwa 2–3 m entfernt seitlich oder vor dich, sodass du von Kopf bis Fuß zu sehen bist.', cue: 'Kugel bis auf Schulterhöhe schwingen, dann zwischen die Beine zurück.' },
  burpees: { kind: 'reps', view: 'any', setup: 'Stell das Handy etwa 2–3 m entfernt seitlich oder vor dich, sodass du von Kopf bis Fuß zu sehen bist, auch im Liegestütz.', cue: 'Runter in den Liegestütz, dann ganz aufrichten.', easyCue: 'Ohne Sprung: Beine nacheinander in den Liegestütz setzen, dann ganz aufrichten.' },
  stretch: { kind: 'hold', view: 'any', setup: 'Stell das Handy etwa 2–3 m entfernt schräg vor dich, sodass du von Kopf bis Fuß zu sehen bist. Bei den Seitneigungen schaust du zur Kamera, bei der Ausfallschritt-Dehnung stehst du seitlich.', cue: 'Halte jede Dehnung 30 Sekunden. Die Zeit läuft nur, solange die Haltung stimmt.' },
  mountain: { kind: 'reps', view: 'side', setup: 'Stell das Handy seitlich auf den Boden, etwa 2 m entfernt, sodass du von der Seite ganz zu sehen bist. Nur von der Seite, nicht vor deinen Kopf.', cue: 'Im Liegestütz abwechselnd ein Knie zur Brust ziehen.', easyCue: 'Im Liegestütz langsam abwechselnd ein Knie zur Brust ziehen.' },
};

export const isScannable = (exerciseId: string | undefined) => !!exerciseId && exerciseId in SCANNABLE;

/** Setup, cue and needed view for an exercise (or presence mode), with the easier variant's values when asked. */
export function scanSpec(exerciseId: string, easy = false): ScanSpec | undefined {
  const spec = exerciseId === PRESENCE ? PRESENCE_SPEC : SCANNABLE[exerciseId];
  if (!spec || !easy) return spec;
  return { ...spec, setup: spec.easySetup ?? spec.setup, cue: spec.easyCue ?? spec.cue, view: spec.easyView ?? spec.view };
}

/** The camera view an exercise needs ('any' when either works). */
export const viewNeed = (exerciseId: string, easy = false): ViewNeed => scanSpec(exerciseId, easy)?.view ?? 'any';

// ---------- geometry ----------

/** Angle at b (degrees) in a, b, c. `aspect` = width / height of the image. */
export function angle(a: Point, b: Point, c: Point, aspect = 1): number {
  const v1 = { x: (a.x - b.x) * aspect, y: a.y - b.y };
  const v2 = { x: (c.x - b.x) * aspect, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const len = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (len === 0) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, dot / len))) * 180) / Math.PI;
}

/** Tilt of the line a→b from horizontal, 0 = lying flat, 90 = upright. */
function tilt(a: Point, b: Point, aspect: number): number {
  const dx = Math.abs(a.x - b.x) * aspect;
  const dy = Math.abs(a.y - b.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

const vis = (p: Point | undefined) => (p ? (p.visibility ?? 1) : 0);

/** The body side the camera sees better. */
function side(lm: Point[]) {
  const score = (s: typeof L) => vis(lm[s.shoulder]) + vis(lm[s.elbow]) + vis(lm[s.hip]) + vis(lm[s.knee]) + vis(lm[s.ankle]);
  return score(L) >= score(R) ? L : R;
}

const visible = (lm: Point[], idx: number[]) => idx.every((i) => vis(lm[i]) > 0.5);

/** Distance in image-height units (x is scaled by the aspect ratio). */
const dist = (a: Point, b: Point, aspect: number) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// ---------- what the camera sees ----------

/** German names of body parts, in head-to-feet order, for "… nicht zu sehen" hints. */
const PART_NAMES: [number[], string][] = [
  [[NOSE], 'Kopf'],
  [[L.shoulder, R.shoulder], 'Schultern'],
  [[L.elbow, R.elbow], 'Ellbogen'],
  [[L.wrist, R.wrist], 'Handgelenke'],
  [[L.hip, R.hip], 'Hüfte'],
  [[L.knee, R.knee], 'Knie'],
  [[L.ankle, R.ankle], 'Füße'],
];

/** German names of the body parts among `idx` that are not clearly visible (visibility <= `min`); empty when all are seen. */
export function missingParts(lm: Point[], idx: number[], min = 0.5): string[] {
  const hidden = idx.filter((i) => vis(lm[i]) <= min);
  return PART_NAMES.filter(([ids]) => ids.some((i) => hidden.includes(i))).map(([, name]) => name);
}

/**
 * Head-on, the hips hide behind head and shoulders and MediaPipe reports them with lower
 * confidence, so frontal checks accept them from this visibility on (instead of 0.5).
 */
const HIP_VIS = 0.3;

export type BodyView = 'side' | 'front';

/**
 * Is the player seen from the side or head-on (head toward the camera, e.g. lying in a plank
 * with the phone in front of the head)? Frontal needs both shoulders clearly visible and at
 * least one sign for it, and no sign against it:
 * - nose (if seen) between the shoulders; from the side it sticks out beyond them,
 * - shoulder→hip distance (if hips seen) short compared to the shoulder width: head-on the torso
 *   points away from the camera and is foreshortened (standing upright it is about 1.3× as long),
 * - upper arms (if elbows seen) not much longer than the shoulder width; from the side the
 *   shoulders overlap, so the shoulder width is tiny compared to the arms.
 */
export function bodyView(lm: Point[], aspect = 1): BodyView {
  const ls = lm[L.shoulder];
  const rs = lm[R.shoulder];
  if (vis(ls) <= 0.5 || vis(rs) <= 0.5) return 'side';
  const sw = dist(ls, rs, aspect);
  if (sw < 0.02) return 'side';
  let signs = 0;
  if (vis(lm[NOSE]) > 0.5) {
    const lo = Math.min(ls.x, rs.x);
    const hi = Math.max(ls.x, rs.x);
    const margin = 0.25 * (hi - lo);
    if (lm[NOSE].x < lo - margin || lm[NOSE].x > hi + margin) return 'side';
    signs++;
  }
  if (vis(lm[L.hip]) > HIP_VIS && vis(lm[R.hip]) > HIP_VIS) {
    if (dist(mid(ls, rs), mid(lm[L.hip], lm[R.hip]), aspect) > 1.2 * sw) return 'side';
    signs++;
  }
  if (visible(lm, [L.elbow, R.elbow])) {
    if ((dist(ls, lm[L.elbow], aspect) + dist(rs, lm[R.elbow], aspect)) / 2 > 1.5 * sw) return 'side';
    signs++;
  }
  return signs > 0 ? 'front' : 'side';
}

const FRONT_PLANK_PARTS = [L.shoulder, R.shoulder, L.elbow, R.elbow];
const FRONT_PUSHUP_PARTS = [L.shoulder, R.shoulder, L.elbow, R.elbow, L.wrist, R.wrist];

/** Frontal parts that are missing: arms at the usual threshold, hips at the lower HIP_VIS. */
const missingFront = (lm: Point[], arms: number[]) => [...missingParts(lm, arms), ...missingParts(lm, [L.hip, R.hip], HIP_VIS)];

/**
 * Forearm plank seen head-on (phone on the floor in front of the head). Distances are relative
 * to the shoulder width `sw`, so they do not depend on how far away the phone is. The checks:
 * - shoulders roughly level (shoulder line tilted < 20°),
 * - both elbows clearly below their shoulders (> 0.4 sw; the upper arm is about 0.8 sw long),
 * - forearms on the floor: wrists (if seen) at elbow height or lower in the image, i.e. nearer
 *   the camera (tolerance 0.2 sw),
 * - hips raised: above the elbows in the image (by > 0.15 sw) and at most `maxHipDrop` sw below
 *   the shoulders. With the phone on the floor, the farther hips show slightly below the
 *   shoulders (about 0.3 sw in a straight plank); standing or sitting they are about 1.3 sw below,
 * - hips centred between the shoulders (within 0.35 sw).
 * Easy (knee plank): the hips sit lower, so they may drop to 0.6 sw instead of 0.4 sw.
 */
function frontPlank(lm: Point[], aspect: number, easy: boolean): boolean {
  const [ls, rs, le, re] = [lm[L.shoulder], lm[R.shoulder], lm[L.elbow], lm[R.elbow]];
  const sw = dist(ls, rs, aspect);
  const shoulders = mid(ls, rs);
  const hips = mid(lm[L.hip], lm[R.hip]);
  const elbowY = (le.y + re.y) / 2;
  const maxHipDrop = easy ? 0.6 : 0.4;
  const level = tilt(ls, rs, aspect) < 20;
  const elbowsDown = le.y > ls.y + 0.4 * sw && re.y > rs.y + 0.4 * sw;
  const forearmsDown = ([[le, lm[L.wrist]], [re, lm[R.wrist]]] as const).every(([e, w]) => vis(w) <= 0.5 || w.y >= e.y - 0.2 * sw);
  const hipsUp = hips.y < elbowY - 0.15 * sw && hips.y < shoulders.y + maxHipDrop * sw;
  const centred = Math.abs(hips.x - shoulders.x) * aspect < 0.35 * sw;
  return level && elbowsDown && forearmsDown && hipsUp && centred;
}

/**
 * Push-up seen head-on: lying face down, i.e. hands below the shoulders and below the elbows
 * (on the floor, nearest the camera), and the hips at most 1.0 sw below the shoulders (at the
 * top of a knee push-up about 0.9 sw; standing about 1.3 sw). Curling or pressing while standing
 * fails because the wrists rise above the elbows or the hips hang too low.
 */
function frontProne(lm: Point[], aspect: number): boolean {
  const [ls, rs] = [lm[L.shoulder], lm[R.shoulder]];
  const sw = dist(ls, rs, aspect);
  const shoulders = mid(ls, rs);
  const hips = mid(lm[L.hip], lm[R.hip]);
  const handsDown = ([[ls, lm[L.elbow], lm[L.wrist]], [rs, lm[R.elbow], lm[R.wrist]]] as const).every(
    ([s, e, w]) => w.y > s.y && w.y > e.y - 0.1 * sw,
  );
  return handsDown && hips.y < shoulders.y + 1.0 * sw;
}

/** Push-up depth head-on: vertical shoulder-to-wrist distance in shoulder widths (top ≈ 1.5, bottom ≈ 0.35). */
function frontPushupDepth(lm: Point[], aspect: number): number {
  const sw = dist(lm[L.shoulder], lm[R.shoulder], aspect) || 0.0001;
  return ((lm[L.wrist].y + lm[R.wrist].y) / 2 - (lm[L.shoulder].y + lm[R.shoulder].y) / 2) / sw;
}

/**
 * Which way the player faces the camera, for any posture. Head-on and lying, `bodyView` above is
 * stricter (it is tuned for planks and push-ups); this one is used by all other exercises.
 * Measured on the horizontal shoulder width `sw` (it shrinks to almost 0 from the side, where the
 * shoulders overlap) against the shoulder→hip line `T` (in image units, aspect-corrected):
 * - upright: facing the camera sw ≈ 0.7 T, so front from sw ≥ 0.5 T (turned less than about 45°),
 *   side up to sw ≤ 0.25 T (turned more than about 70°), in between undefined (oblique);
 * - `lying` (sit-ups, mountain climbers, Australian pull-ups): lying, the torso shows its full length
 *   from the side but is foreshortened head-on, so sw/T alone calls a slightly turned body "front".
 *   Then front also needs sw ≥ 2× the horizontal part of T (turned less than about 20°), and
 *   side already from sw ≤ 0.5× that part (turned more than about 55°).
 * A nose clearly outside the shoulders means side. Undefined when shoulders or hips are not seen.
 */
export function facing(lm: Point[], aspect = 1, lying = false): BodyView | undefined {
  const ls = lm[L.shoulder];
  const rs = lm[R.shoulder];
  if (vis(ls) <= 0.5 || vis(rs) <= 0.5) return undefined;
  const lo = Math.min(ls.x, rs.x);
  const hi = Math.max(ls.x, rs.x);
  const nose = lm[NOSE];
  if (vis(nose) > 0.5 && (nose.x < lo - 0.25 * (hi - lo) || nose.x > hi + 0.25 * (hi - lo))) return 'side';
  if (vis(lm[L.hip]) <= HIP_VIS || vis(lm[R.hip]) <= HIP_VIS) return undefined;
  const sw = (hi - lo) * aspect;
  const s = mid(ls, rs);
  const h = mid(lm[L.hip], lm[R.hip]);
  const T = dist(s, h, aspect);
  const tx = Math.abs(s.x - h.x) * aspect;
  if (sw <= 0.25 * T || (lying && sw <= 0.5 * tx)) return 'side';
  if (sw >= 0.5 * T && (!lying || sw >= 2 * tx)) return 'front';
  return undefined;
}

const avg = (a: number, b: number) => (a + b) / 2;
/** Shoulder width (image units, aspect-corrected); a tiny floor avoids dividing by 0. */
const shoulderWidth = (lm: Point[], aspect: number) => dist(lm[L.shoulder], lm[R.shoulder], aspect) || 0.0001;
/** Standing hip height above the ankles in shoulder widths (simulated MediaPipe proportions); only
 * used until the player's own value is known (see `standRef`). */
const STAND_HIP_SW = 2.3;

/**
 * Hip height seen from the front: vertical gap from the hips down to the mean ankle height, in
 * shoulder widths (about 2.3 standing, about half of that in a deep squat or at the bottom of a
 * lunge). It hardly depends on how high the phone is; body proportions and turning away (the
 * shoulders look narrower) change it, which is why it is compared with the player's own standing
 * value. One lifted foot (walking) moves the mean ankle by half its height only.
 */
function hipOverAnkles(lm: Point[], aspect: number): number {
  return (avg(lm[L.ankle].y, lm[R.ankle].y) - avg(lm[L.hip].y, lm[R.hip].y)) / shoulderWidth(lm, aspect);
}

/**
 * Per leg, seen from the front: vertical drop from the hips to the knee, in that leg's 2D shin
 * length (knee to ankle). Standing ≈ 1.05 (thigh and shin are about equally long, for everyone),
 * thigh level ≈ 0, below 0 when the hips sink below the knee. The shins stay upright in a wall
 * sit and when standing, so this barely depends on turning; a high phone makes bent thighs look
 * steeper.
 */
function thighDrops(lm: Point[], aspect: number): [number, number] {
  const hipY = avg(lm[L.hip].y, lm[R.hip].y);
  const drop = (s: typeof L) => (lm[s.knee].y - hipY) / (dist(lm[s.knee], lm[s.ankle], aspect) || 0.0001);
  return [drop(L), drop(R)];
}

const FRONT_LEG_PARTS = [L.shoulder, R.shoulder, L.hip, R.hip, L.knee, R.knee, L.ankle, R.ankle];
const FRONT_ARM_PARTS = [L.shoulder, R.shoulder, L.elbow, R.elbow, L.wrist, R.wrist];

/**
 * Curl seen from the front, per arm: how far the wrist is below its shoulder, in shoulder widths
 * (hanging ≈ 1.6, curled ≈ 0–0.3). null while the elbow is not low beside the body (more than
 * 0.4 sw below the shoulder; raising or pressing the arms is no curl).
 */
function frontCurl(lm: Point[], s: typeof L, aspect: number): number | null {
  const sw = shoulderWidth(lm, aspect);
  if (lm[s.elbow].y - lm[s.shoulder].y < 0.4 * sw) return null;
  return (lm[s.wrist].y - lm[s.shoulder].y) / sw;
}

/**
 * Burpee seen from the front: 'down' lying in the push-up position (hips at most 0.6 sw below the
 * shoulders; head-on the body is foreshortened), 'up' standing (hips more than 1.1 sw below the
 * shoulders, about 1.4 when upright), else null. Bending over with straight legs also brings the
 * shoulders down to the hips, so 'down' is refused while the knees are seen far below the hips
 * (legs upright under the body; in the push-up position they lie behind the hips).
 */
function frontBurpee(lm: Point[], aspect: number): 'down' | 'up' | null {
  const sw = shoulderWidth(lm, aspect);
  const gap = avg(lm[L.hip].y, lm[R.hip].y) - avg(lm[L.shoulder].y, lm[R.shoulder].y);
  if (gap > 1.1 * sw) return 'up';
  const legsUnder = visible(lm, [L.knee, R.knee]) && avg(lm[L.knee].y, lm[R.knee].y) - avg(lm[L.hip].y, lm[R.hip].y) > 0.7 * sw;
  return gap < 0.6 * sw && !legsUnder ? 'down' : null;
}

// ---------- counter ----------

export type Phase = 'up' | 'down' | 'unknown';

export interface ScanState {
  exerciseId: string;
  reps: number;
  holdMs: number;
  phase: Phase;
  inPosition: boolean; // for holds: the pose is correct right now
  bodyVisible: boolean;
  smooth: number | null; // smoothed main angle
  lastT: number | null;
  legs?: { phase: Phase; smooth: number | null }[]; // per-leg tracking (mountain climbers): [left, right]
  // stretch routine only: the pose to hold now (index into STRETCH_POSES) and how long it is held so far
  poseIndex?: number;
  poseName?: string;
  poseMs?: number;
  // per-arm tracking (curls seen from the front): [left, right]; reps is the higher of the two
  arms?: { phase: Phase; smooth: number | null; reps: number }[];
  // pull-ups: nose and hand height (image y) while last hanging with straight arms
  hang?: { nose: number; wrist: number };
  // squats and lunges seen from the front: the player's standing hip height (see hipOverAnkles)
  standRef?: number;
  // UI feedback, set per frame: how the player is seen right now (the view the detector used), the
  // German names of the needed body parts that are not clearly visible (only while bodyVisible is
  // false), and the view the exercise needs while the player is clearly seen from the other one
  // ('side': "Dreh dich zur Seite", 'front': "Stell dich frontal vor die Kamera"). Nothing is counted then.
  view?: BodyView;
  missing?: string[];
  wrongView?: BodyView;
}

export const initialScan = (exerciseId: string): ScanState => ({
  exerciseId,
  reps: 0,
  holdMs: 0,
  phase: 'unknown',
  inPosition: false,
  bodyVisible: false,
  smooth: null,
  lastT: null,
  ...(exerciseId === STRETCH ? { poseIndex: 0, poseName: STRETCH_POSES[0].name, poseMs: 0 } : {}),
});

// ---------- stretch routine ----------

/** Scan id of the stretch routine (stretching, mobility, hip openers, band stretches). */
export const STRETCH = 'stretch';

/** Each pose is held this long, then the routine moves on to the next one (and loops). */
export const STRETCH_POSE_MS = 30_000;

export interface StretchPose {
  id: string;
  name: string; // German, for the UI
  hint: string; // German, short instruction
  muscles: string; // German, the main muscles this pose stretches
  needs: number[]; // landmarks that must be clearly visible
  view?: ViewNeed; // camera view the check needs; missing = 'any'
  /** null when the needed body parts are not clearly visible, else whether the pose is held. */
  check: (lm: Point[], aspect: number) => boolean | null;
}

/** A stretch pose whose `held` test only runs once all `needs` are clearly visible. */
function stretchPose(p: Omit<StretchPose, 'check'>, held: (lm: Point[], aspect: number) => boolean): StretchPose {
  return { ...p, check: (lm, aspect) => (visible(lm, p.needs) ? held(lm, aspect) : null) };
}

const kneeAngle = (lm: Point[], s: typeof L, aspect: number) => angle(lm[s.hip], lm[s.knee], lm[s.ankle], aspect);
const elbowAngle = (lm: Point[], s: typeof L, aspect: number) => angle(lm[s.shoulder], lm[s.elbow], lm[s.wrist], aspect);

/** Side bend: the wrist of `up` is above the head and the shoulder line drops by more than 12° toward the other side. */
function sideBend(id: string, name: string, hint: string, muscles: string, up: typeof L, other: typeof L): StretchPose {
  // The shoulder line tilts sideways: only seen with the chest toward the camera. From the side the
  // shoulders overlap and their line can point anywhere, so a clear side view never counts.
  return stretchPose({ id, name, hint, muscles, needs: [NOSE, L.shoulder, R.shoulder, up.wrist], view: 'front' }, (lm, aspect) => {
    const handUp = lm[up.wrist].y < lm[NOSE].y;
    // The other hand stays down (if seen): with both arms up and the phone low and at an angle,
    // perspective alone tilts the shoulder line.
    const otherDown = vis(lm[other.wrist]) <= 0.5 || lm[other.wrist].y > lm[NOSE].y;
    const towardOther = lm[other.shoulder].y > lm[up.shoulder].y; // the other shoulder is lower
    return handUp && otherDown && towardOther && tilt(lm[L.shoulder], lm[R.shoulder], aspect) > 12 && facing(lm, aspect) !== 'side';
  });
}

/** What the stretch routine works on, per quest template id (all four use the same routine). */
export const STRETCH_FOCUS: Record<string, string> = {
  stretch: 'Dehnt: Oberschenkel, Waden, Rücken, Rumpfseiten, Schultern, Brust und Hüfte.',
  mobility: 'Mobilisiert und dehnt: Hüfte, Rücken, Rumpfseiten, Schultern, Oberschenkel und Waden.',
  hips: 'Schwerpunkt Hüfte (Ausfallschritt-Dehnung), dazu: Oberschenkel, Waden, Rücken, Rumpfseiten, Schultern und Brust.',
  bandstretch: 'Dehnt: Oberschenkel, Waden, Rücken, Rumpfseiten, Schultern, Brust und Hüfte.',
};

export const STRETCH_POSES: StretchPose[] = [
  stretchPose(
    {
      id: 'forward-fold',
      name: 'Vorbeuge',
      hint: 'Beine fast gestreckt, Hände unter die Knie.',
      muscles: 'Hintere Oberschenkel, Waden und unterer Rücken',
      needs: [L.hip, L.knee, L.ankle, R.hip, R.knee, R.ankle, L.wrist, R.wrist],
    },
    (lm, aspect) => {
      const straight = kneeAngle(lm, L, aspect) > 150 && kneeAngle(lm, R, aspect) > 150;
      const kneeY = Math.max(lm[L.knee].y, lm[R.knee].y);
      return straight && lm[L.wrist].y > kneeY && lm[R.wrist].y > kneeY;
    },
  ),
  sideBend('side-bend-left', 'Seitneigung links', 'Zur Kamera schauen. Rechten Arm über den Kopf, Oberkörper zur linken Seite neigen.', 'Seitlicher Rumpf und Flanke (rechte Seite)', R, L),
  sideBend('side-bend-right', 'Seitneigung rechts', 'Zur Kamera schauen. Linken Arm über den Kopf, Oberkörper zur rechten Seite neigen.', 'Seitlicher Rumpf und Flanke (linke Seite)', L, R),
  stretchPose(
    {
      id: 'arms-up',
      name: 'Arme hoch',
      hint: 'Aufrecht stehen, beide Arme gestreckt nach oben.',
      muscles: 'Schultern, Brustmuskeln und Rücken',
      needs: [NOSE, L.shoulder, R.shoulder, L.elbow, R.elbow, L.wrist, R.wrist, L.hip, R.hip],
    },
    (lm, aspect) => {
      const s = side(lm);
      const up = lm[L.wrist].y < lm[NOSE].y && lm[R.wrist].y < lm[NOSE].y;
      const upright = tilt(lm[s.shoulder], lm[s.hip], aspect) > 60;
      const straight = elbowAngle(lm, L, aspect) > 140 && elbowAngle(lm, R, aspect) > 140;
      return up && upright && straight;
    },
  ),
  stretchPose(
    {
      id: 'lunge-stretch',
      name: 'Ausfallschritt-Dehnung',
      hint: 'Seitlich zur Kamera stellen. Großer Schritt nach vorn, vorderes Knie beugen, hinteres Bein gestreckt.',
      muscles: 'Hüftbeuger und Oberschenkel-Vorderseite des hinteren Beins, Wade',
      needs: [L.hip, L.knee, L.ankle, R.hip, R.knee, R.ankle],
      // Knee angles: head-on the bent front knee points at the camera and cannot be measured.
      view: 'side',
    },
    (lm, aspect) => {
      const l = kneeAngle(lm, L, aspect);
      const r = kneeAngle(lm, R, aspect);
      return (l < 120 && r > 150) || (r < 120 && l > 150);
    },
  ),
];

/** One frame of the stretch routine: time counts only while the current pose is held. */
function stretchStep(state: ScanState, lm: Point[], dt: number, aspect: number, base: ScanState): ScanState {
  const idx = state.poseIndex ?? 0;
  const pose = STRETCH_POSES[idx];
  const ok = pose.check(lm, aspect);
  const view = facing(lm, aspect);
  // Seen from the wrong side for this pose (and not holding it anyway): say how to turn.
  const wrong = !ok && pose.view && pose.view !== 'any' && view && view !== pose.view ? { wrongView: pose.view } : {};
  if (ok === null) return { ...base, bodyVisible: false, inPosition: false, view, missing: missingParts(lm, pose.needs), ...wrong };
  const held = ok ? dt : 0;
  const poseMs = (state.poseMs ?? 0) + held;
  const nextIdx = poseMs >= STRETCH_POSE_MS ? (idx + 1) % STRETCH_POSES.length : idx;
  return {
    ...base,
    ...wrong,
    view,
    bodyVisible: true,
    inPosition: ok,
    holdMs: state.holdMs + held,
    poseIndex: nextIdx,
    poseName: STRETCH_POSES[nextIdx].name,
    poseMs: nextIdx === idx ? poseMs : 0,
  };
}

/** Thresholds with a gap between them so jitter cannot count twice. */
function hysteresis(state: ScanState, value: number, downBelow: number, upAbove: number): ScanState {
  let { phase, reps } = state;
  if (value < downBelow) phase = 'down';
  else if (value > upAbove) {
    if (phase === 'down') reps += 1;
    phase = 'up';
  }
  return { ...state, phase, reps };
}

/** Map a two-state pose to a pseudo-angle (active = 0, rest = 180) so the shared hysteresis applies. */
const pseudo = (active: boolean, rest: boolean) => (active ? 0 : rest ? 180 : 90);

/**
 * Feed one frame. `t` is a timestamp in ms. Returns the next state; nothing is
 * counted while the needed body parts are not clearly visible, or while the player
 * is clearly seen from a view the exercise cannot use (then `wrongView` says which
 * view is needed). `easy` switches to the easier variant's thresholds (see VARIANTS in game.ts).
 */
export function step(state: ScanState, lm: Point[] | undefined, t: number, aspect = 1, easy = false): ScanState {
  const dt = state.lastT === null ? 0 : Math.min(t - state.lastT, 500);
  // view, missing and wrongView describe this frame only
  const { view: prevView, missing: _missing, wrongView: _wrong, ...rest } = state;
  const base: ScanState = { ...rest, lastT: t };
  // No person found: run the detector on an empty frame, so it reports all its parts as missing.
  const pts = lm && lm.length >= 29 ? lm : [];
  const s = side(pts);
  const P = (i: number) => pts[i];
  const ema = (v: number) => (state.smooth === null ? v : state.smooth * 0.5 + v * 0.5);
  /** Like ema, but restarts when the view changes: the two views measure in different units. */
  const smoothIn = (view: BodyView, v: number) => (state.smooth === null || prevView !== view ? v : state.smooth * 0.5 + v * 0.5);
  const hold = (ok: boolean): ScanState => ({ ...base, bodyVisible: true, inPosition: ok, holdMs: state.holdMs + (ok ? dt : 0) });
  const lost = (missing: string[], extra: Partial<ScanState> = {}): ScanState => ({ ...base, bodyVisible: false, inPosition: false, missing, ...extra });
  /** The needed parts that are not clearly visible; empty when all are seen. */
  const need = (idx: number[]) => missingParts(pts, idx);
  /**
   * The player is clearly seen from the wrong view for an exercise that needs `needed`: count
   * nothing (the phase is kept), and tell the UI which view is needed.
   */
  const wrongView = (seen: BodyView | undefined, needed: BodyView): ScanState | null =>
    seen && seen !== needed ? { ...base, bodyVisible: true, inPosition: false, view: seen, wrongView: needed } : null;

  switch (state.exerciseId) {
    case STRETCH:
      return stretchStep(state, pts, dt, aspect, base);
    case PRESENCE: {
      // Timer for stretching and the like: runs only while the player is clearly in view.
      const miss = need([s.shoulder, s.hip]);
      return miss.length ? { ...hold(false), bodyVisible: false, missing: miss } : hold(true);
    }
    case 'pushups': {
      const view = bodyView(pts, aspect);
      if (view === 'front') {
        const miss = missingFront(pts, FRONT_PUSHUP_PARTS);
        if (miss.length) return lost(miss, { view });
        // Head-on: depth from how far the shoulders are above the hands. Knee push-ups count too.
        // Frames out of the push-up position are left out of the smoothing, so they cannot lag
        // into the next frames and fake a "down".
        if (!frontProne(pts, aspect)) return { ...base, bodyVisible: true, view, smooth: prevView === view ? state.smooth : null };
        const d = smoothIn(view, frontPushupDepth(pts, aspect));
        return hysteresis({ ...base, bodyVisible: true, smooth: d, view }, d, 0.75, 1.15);
      }
      // Knee push-ups count too: the check uses the shoulder–hip line only.
      const miss = need([s.shoulder, s.elbow, s.wrist, s.hip]);
      if (miss.length) return lost(miss, { view });
      // Only count with the body roughly horizontal, so arm bends while standing do not count.
      const flat = tilt(P(s.shoulder), P(s.hip), aspect) < 45;
      const a = smoothIn(view, angle(P(s.shoulder), P(s.elbow), P(s.wrist), aspect));
      const next = { ...base, bodyVisible: true, smooth: a, view };
      return flat ? hysteresis(next, a, 100, 150) : next;
    }
    case 'squats':
    case 'lunges': {
      if (facing(pts, aspect) === 'front') {
        // Head-on the knee bends toward the camera and its angle cannot be measured: count the hip
        // drop instead, as a share of the player's own standing hip height (see hipOverAnkles).
        // That is learned from frames with both thighs upright (see thighDrops): it jumps up at
        // once and follows lower values slowly, so frames on the way down barely move it.
        // Squats and lunges both lower the hips to about half (side view: knee angle below 110°).
        const view: BodyView = 'front';
        const miss = need(FRONT_LEG_PARTS);
        if (miss.length) return lost(miss, { view });
        const raw = hipOverAnkles(pts, aspect);
        const standing = Math.min(...thighDrops(pts, aspect)) > 0.85;
        const old = state.standRef;
        const standRef = !standing ? old : old === undefined || raw > old ? raw : old + 0.05 * (raw - old);
        const h = smoothIn(view, raw / (standRef ?? STAND_HIP_SW));
        // Lunges: standing up in the split stance (instead of with the feet together) is lower.
        const [down, up] = state.exerciseId === 'lunges' ? [0.7, 0.82] : easy ? [0.8, 0.9] : [0.7, 0.88];
        return hysteresis({ ...base, bodyVisible: true, smooth: h, view, standRef }, h, down, up);
      }
      const view: BodyView = 'side';
      if (state.exerciseId === 'squats') {
        const miss = need([s.hip, s.knee, s.ankle]);
        if (miss.length) return lost(miss, { view });
        const a = smoothIn(view, angle(P(s.hip), P(s.knee), P(s.ankle), aspect));
        return hysteresis({ ...base, bodyVisible: true, smooth: a, view }, a, easy ? 130 : 110, 160);
      }
      const miss = need([L.hip, L.knee, L.ankle, R.hip, R.knee, R.ankle]);
      if (miss.length) return lost(miss, { view });
      const a = smoothIn(view, Math.min(angle(P(L.hip), P(L.knee), P(L.ankle), aspect), angle(P(R.hip), P(R.knee), P(R.ankle), aspect)));
      return hysteresis({ ...base, bodyVisible: true, smooth: a, view }, a, 115, 155);
    }
    case 'jacks': {
      // Legs and arms open sideways: invisible from the side.
      const view = facing(pts, aspect);
      const wrong = wrongView(view, 'front');
      if (wrong) return wrong;
      const miss = need([L.shoulder, R.shoulder, L.wrist, R.wrist, L.ankle, R.ankle]);
      if (miss.length) return lost(miss, { view });
      const shoulderW = Math.abs(P(L.shoulder).x - P(R.shoulder).x) || 0.0001;
      const feet = Math.abs(P(L.ankle).x - P(R.ankle).x) / shoulderW;
      const armsUp = P(L.wrist).y < P(L.shoulder).y && P(R.wrist).y < P(R.shoulder).y;
      const armsDown = P(L.wrist).y > P(L.shoulder).y && P(R.wrist).y > P(R.shoulder).y;
      // map to a pseudo-angle: open = 0, closed = 180, so the shared hysteresis applies
      const v = pseudo(armsUp && feet > 1.4, armsDown && feet < 1.1);
      return hysteresis({ ...base, bodyVisible: true, smooth: v, view }, v, 45, 135);
    }
    case 'pullups': {
      if (easy) {
        // Australian pull-ups: body under a low bar, counted on the elbow angle like rows. The arms
        // pull toward the camera when it is at the head or the feet, so this needs the side view.
        const view = facing(pts, aspect, true);
        const wrong = wrongView(view, 'side');
        if (wrong) return wrong;
        const miss = need([s.shoulder, s.elbow, s.wrist]);
        if (miss.length) return lost(miss, { view });
        const a = ema(angle(P(s.shoulder), P(s.elbow), P(s.wrist), aspect));
        return hysteresis({ ...base, bodyVisible: true, smooth: a, view }, a, 80, 140);
      }
      // Works from the front and the side: "up" = chin over the bar, i.e. the nose above the hands,
      // "down" = hanging with straight arms. Wide grips bend the elbows sideways (best seen from the
      // front), chin-ups forward (best seen from the side); the nose check works either way.
      const view = facing(pts, aspect);
      const miss = need([NOSE, s.shoulder, s.elbow, s.wrist]);
      if (miss.length) return lost(miss, { view });
      const wrists = [L.wrist, R.wrist].filter((i) => vis(P(i)) > 0.5);
      const wristY = wrists.reduce((sum, i) => sum + P(i).y, 0) / wrists.length;
      const next = { ...base, bodyVisible: true, view };
      // Hanging from the bar, the hands are above the shoulders all the time.
      if (wristY >= P(s.shoulder).y) return next;
      const straight = angle(P(s.shoulder), P(s.elbow), P(s.wrist), aspect) > 145;
      const hanging = straight && P(NOSE).y > wristY;
      // The hands hold the bar and stay put while the body rises; raising or waving the arms moves
      // the hands instead, so the nose only "passes the hands" with them where they were when hanging.
      const ref = hanging ? { nose: P(NOSE).y, wrist: wristY } : state.hang;
      const still = !!ref && Math.abs(wristY - ref.wrist) < 0.4 * Math.max(ref.nose - ref.wrist, 0.0001);
      const top = P(NOSE).y < wristY && still;
      // "down" here means pulled up; a rep completes when hanging with straight arms again
      const v = pseudo(top, hanging);
      return hysteresis({ ...next, smooth: v, hang: ref }, v, 45, 135);
    }
    case 'plank': {
      const view = bodyView(pts, aspect);
      if (view === 'front') {
        // Head-on the feet hide behind the body, so they are not needed (see frontPlank).
        const miss = missingFront(pts, FRONT_PLANK_PARTS);
        if (miss.length) return lost(miss, { view });
        return { ...hold(frontPlank(pts, aspect, easy)), view };
      }
      // Easy: knee plank, so the line runs shoulder–hip–knee instead of to the ankle.
      const end = easy ? s.knee : s.ankle;
      const miss = need([s.shoulder, s.hip, end]);
      if (miss.length) return lost(miss, { view });
      const straight = angle(P(s.shoulder), P(s.hip), P(end), aspect) > 155;
      const flat = tilt(P(s.shoulder), P(end), aspect) < 35;
      return { ...hold(straight && flat), view };
    }
    case 'wallsit': {
      if (facing(pts, aspect) === 'front') {
        // Head-on: thighs level means the hips are about as low as the knees (see thighDrops).
        // 0.42 is about a 100° knee angle (110° with the phone low), 0.75 about 130°. Below -0.5 the
        // hips sink well under the knees (sitting on the floor, deep squat).
        const view: BodyView = 'front';
        const miss = need(FRONT_LEG_PARTS);
        if (miss.length) return lost(miss, { view });
        // Both thighs about level (the less bent one counts), not sunk far below the knees.
        const d = Math.max(...thighDrops(pts, aspect));
        return { ...hold(d > -0.5 && d < (easy ? 0.75 : 0.42)), view };
      }
      const view: BodyView = 'side';
      const miss = need([s.hip, s.knee, s.ankle]);
      if (miss.length) return lost(miss, { view });
      const k = angle(P(s.hip), P(s.knee), P(s.ankle), aspect);
      return { ...hold(k > 70 && k < (easy ? 140 : 120)), view };
    }
    case 'situps': {
      // The torso rises toward a camera at the head or the feet: needs the side view.
      const view = facing(pts, aspect, true);
      const wrong = wrongView(view, 'side');
      if (wrong) return wrong;
      const miss = need([s.shoulder, s.hip, s.knee]);
      if (miss.length) return lost(miss, { view });
      // Lying down: the thigh is never upright. Bowing forward while standing does not count.
      const lying = tilt(P(s.hip), P(s.knee), aspect) < 70;
      const a = ema(angle(P(s.shoulder), P(s.hip), P(s.knee), aspect));
      const next = { ...base, bodyVisible: true, smooth: a, view };
      // "down" = sat up; a rep completes when lying back again
      return lying ? hysteresis(next, a, easy ? 110 : 95, 125) : next;
    }
    case 'curls': {
      if (facing(pts, aspect) === 'front') {
        // Head-on the forearm swings toward the camera, so count how high each wrist rises toward
        // its shoulder (see frontCurl), both arms on their own; reps follow the busier arm, as the
        // side view counts one arm.
        const view: BodyView = 'front';
        const miss = [...need(FRONT_ARM_PARTS), ...missingParts(pts, [L.hip, R.hip], HIP_VIS)];
        if (miss.length) return lost(miss, { view });
        const sw = shoulderWidth(pts, aspect);
        const upright = avg(P(L.hip).y, P(R.hip).y) - avg(P(L.shoulder).y, P(R.shoulder).y) > 0.8 * sw;
        const prev = state.arms ?? [
          { phase: 'unknown' as Phase, smooth: null, reps: 0 },
          { phase: 'unknown' as Phase, smooth: null, reps: 0 },
        ];
        const arms = [L, R].map((arm, i) => {
          const c = frontCurl(pts, arm, aspect);
          // smoothing restarts after the side view, like smoothIn
          const last = prevView === view ? prev[i].smooth : null;
          if (c === null || !upright) return { ...prev[i], smooth: last };
          const v = last === null ? c : last * 0.5 + c * 0.5;
          let { phase, reps } = prev[i];
          // "down" = curled; a rep completes when the arm hangs straight again
          if (v < 0.4) phase = 'down';
          else if (v > 1.2) {
            if (phase === 'down') reps += 1;
            phase = 'up';
          }
          return { phase, smooth: v, reps };
        });
        const more = Math.max(arms[0].reps, arms[1].reps) - Math.max(prev[0].reps, prev[1].reps);
        const phase: Phase = arms.some((a) => a.phase === 'down') ? 'down' : arms.every((a) => a.phase === 'up') ? 'up' : state.phase;
        return { ...base, bodyVisible: true, view, arms, phase, reps: state.reps + more, smooth: null };
      }
      const view: BodyView = 'side';
      const miss = need([s.shoulder, s.elbow, s.wrist, s.hip]);
      if (miss.length) return lost(miss, { view });
      const upright = tilt(P(s.shoulder), P(s.hip), aspect) > 60;
      // The elbow stays low beside the body (pressing or raising the arm forward is no curl).
      const elbowLow = P(s.elbow).y - P(s.shoulder).y > 0.5 * dist(P(s.shoulder), P(s.elbow), aspect);
      const a = smoothIn(view, angle(P(s.shoulder), P(s.elbow), P(s.wrist), aspect));
      const next = { ...base, bodyVisible: true, smooth: a, view };
      // "down" = curled; a rep completes when the arm is straight again
      return upright && elbowLow ? hysteresis(next, a, 60, 140) : next;
    }
    case 'press': {
      // Heights only, so it works from the front and the side. From the side the far arm may hide
      // behind the head: then the near arm is enough.
      const view = facing(pts, aspect);
      const arms = view === 'side' ? [s] : [L, R];
      const miss = need([NOSE, ...arms.flatMap((a) => [a.shoulder, a.wrist])]);
      if (miss.length) return lost(miss, { view });
      // Pressed: the hands clearly above the head (not just at the forehead), i.e. more than 0.7× the
      // torso length above their shoulder, or 1.8× the nose–shoulder height while the hips are out
      // of the picture. Compared with the shoulder, not the nose: from the side the near hand is
      // closer to the camera than the nose, and a low phone makes nearer points look higher.
      const hipsSeen = vis(P(s.hip)) > HIP_VIS;
      const reach = hipsSeen ? 0.7 * Math.abs(P(s.hip).y - P(s.shoulder).y) : 1.8 * (P(s.shoulder).y - P(NOSE).y);
      const pressed = arms.every((a) => P(a.wrist).y < P(a.shoulder).y - reach);
      const start = arms.every((a) => P(a.wrist).y > P(a.shoulder).y);
      const v = pseudo(pressed, start);
      return hysteresis({ ...base, bodyVisible: true, smooth: v, view }, v, 45, 135);
    }
    case 'rows': {
      // The band is pulled toward the body, i.e. toward a camera in front: needs the side view.
      const view = facing(pts, aspect);
      const wrong = wrongView(view, 'side');
      if (wrong) return wrong;
      const miss = need([s.shoulder, s.elbow, s.wrist]);
      if (miss.length) return lost(miss, { view });
      const a = ema(angle(P(s.shoulder), P(s.elbow), P(s.wrist), aspect));
      const next = { ...base, bodyVisible: true, smooth: a, view };
      // hands stay below the shoulders; "down" = pulled, a rep completes on extension
      return P(s.wrist).y > P(s.shoulder).y ? hysteresis(next, a, 80, 140) : next;
    }
    case 'swings': {
      // Heights only, so it works from the front and the side.
      const view = facing(pts, aspect);
      const miss = need([s.shoulder, s.hip, s.wrist]);
      if (miss.length) return lost(miss, { view });
      const torso = Math.abs(P(s.hip).y - P(s.shoulder).y);
      // At or above shoulder height; the margin also covers the bell swinging toward or away from the
      // camera, which makes it look a little lower or higher.
      const top = P(s.wrist).y <= P(s.shoulder).y + 0.2 * torso;
      const bottom = P(s.wrist).y > P(s.hip).y;
      const v = pseudo(top, bottom);
      return hysteresis({ ...base, bodyVisible: true, smooth: v, view }, v, 45, 135);
    }
    case 'burpees': {
      if (facing(pts, aspect) === 'front') {
        // Head-on the torso does not tilt in the image: compare hip and shoulder heights instead
        // (see frontBurpee). Mapped to the side view's tilt angles, without smoothing.
        const view: BodyView = 'front';
        const miss = missingFront(pts, [L.shoulder, R.shoulder]);
        if (miss.length) return lost(miss, { view });
        const b = frontBurpee(pts, aspect);
        const v = b === 'down' ? 0 : b === 'up' ? 90 : 45;
        return hysteresis({ ...base, bodyVisible: true, smooth: v, view }, v, 30, 60);
      }
      const view: BodyView = 'side';
      const miss = need([s.shoulder, s.hip]);
      if (miss.length) return lost(miss, { view });
      // torso tilt: plank (< 30) is "down", standing again (> 60) completes the rep
      const a = smoothIn(view, tilt(P(s.shoulder), P(s.hip), aspect));
      const next = { ...base, bodyVisible: true, smooth: a, view };
      // Bending over with straight legs also tilts the torso flat: no "down" while the knee is
      // clearly below the hip (legs upright under the body instead of stretched back).
      const legsUnder = vis(P(s.knee)) > 0.5 && P(s.knee).y - P(s.hip).y > 0.6 * dist(P(s.shoulder), P(s.hip), aspect);
      if (legsUnder && a < 30) return next;
      return hysteresis(next, a, 30, 60);
    }
    case 'mountain': {
      // Knees driven toward the chest hide under the body head-on: needs the side view.
      const view = facing(pts, aspect, true);
      const wrong = wrongView(view, 'side');
      if (wrong) return wrong;
      const miss = need([L.shoulder, L.hip, L.knee, R.shoulder, R.hip, R.knee]);
      if (miss.length) return lost(miss, { view });
      const horizontal = tilt(P(s.shoulder), P(s.hip), aspect) < 45;
      const prev = state.legs ?? [
        { phase: 'unknown' as Phase, smooth: null },
        { phase: 'unknown' as Phase, smooth: null },
      ];
      if (!horizontal) return { ...base, bodyVisible: true, legs: prev, view };
      // Each leg on its own, so fast alternating still counts every knee drive.
      let reps = state.reps;
      const legs = [L, R].map((leg, i) => {
        const raw = angle(P(leg.shoulder), P(leg.hip), P(leg.knee), aspect);
        const a = prev[i].smooth === null ? raw : prev[i].smooth! * 0.5 + raw * 0.5;
        let phase = prev[i].phase;
        if (a < 100) phase = 'down';
        else if (a > 140) {
          if (phase === 'down') reps += 1;
          phase = 'up';
        }
        return { phase, smooth: a };
      });
      const phase: Phase = legs.some((l) => l.phase === 'down') ? 'down' : legs.every((l) => l.phase === 'up') ? 'up' : state.phase;
      return { ...base, bodyVisible: true, reps, legs, phase, smooth: Math.min(legs[0].smooth, legs[1].smooth), view };
    }
    default:
      return pts.length ? base : { ...base, bodyVisible: false, inPosition: false };
  }
}

/** Progress in the exercise's own unit: reps, or whole seconds for holds and presence mode. */
export const scanAmount = (s: ScanState) =>
  s.exerciseId === PRESENCE || SCANNABLE[s.exerciseId]?.kind === 'hold' ? Math.floor(s.holdMs / 1000) : s.reps;
