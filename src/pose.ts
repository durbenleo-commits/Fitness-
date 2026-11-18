// Rep counting from pose landmarks (MediaPipe's 33-point body model). Pure logic,
// unit-tested with synthetic poses; the camera screen only feeds frames in.

export interface Point {
  x: number; // 0..1, image width
  y: number; // 0..1, image height (down is larger)
  visibility?: number;
}

// MediaPipe pose landmark indices
const L = { ear: 7, shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27, heel: 29, toe: 31 };
const R = { ear: 8, shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28, heel: 30, toe: 32 };
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

/** Floor exercises lying down: the movement goes up and down, seen best from the side. */
const LYING_SIDE_SETUP =
  'Leg das Handy seitlich neben dich auf den Boden, etwa 2 m entfernt, sodass du im Liegen von der Seite ganz zu sehen bist. Nur von der Seite, nicht an Kopf oder Füße.';

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
  stretch: { kind: 'hold', view: 'any', setup: 'Stell das Handy etwa 2–3 m entfernt schräg vor dich, sodass du von Kopf bis Fuß zu sehen bist. Bei den Seitneigungen schaust du zur Kamera, bei der Ausfallschritt-Dehnung stehst du seitlich.', cue: 'Halte jede Dehnung 30 Sekunden. Die Zeit läuft nur, solange die Haltung stimmt.', easyCue: 'Sanft dehnen, nicht so tief: halte jede Dehnung 30 Sekunden. Die Zeit läuft nur, solange die Haltung stimmt.' },
  mountain: { kind: 'reps', view: 'side', setup: 'Stell das Handy seitlich auf den Boden, etwa 2 m entfernt, sodass du von der Seite ganz zu sehen bist. Nur von der Seite, nicht vor deinen Kopf.', cue: 'Im Liegestütz abwechselnd ein Knie zur Brust ziehen.', easyCue: 'Im Liegestütz langsam abwechselnd ein Knie zur Brust ziehen.' },
  // ---- calisthenics ----
  dips: { kind: 'reps', view: 'side', setup: 'Stell das Handy seitlich auf, etwa 2 m entfernt, sodass du von der Seite mit Armen und Hüfte zu sehen bist. Nur von der Seite, nicht von vorne.', cue: 'Runter, bis die Oberarme etwa waagerecht sind, dann Arme ganz strecken.', easyCue: 'Hände hinter dir auf einem Stuhl, Füße nah: runter, bis die Arme gebeugt sind, dann ganz strecken.' },
  pike: { kind: 'reps', view: 'side', setup: 'Stell das Handy seitlich auf den Boden, etwa 2 m entfernt, sodass du von der Seite ganz zu sehen bist. Nur von der Seite, nicht vor deinen Kopf.', cue: 'Hüfte hoch wie ein umgedrehtes V. Kopf Richtung Boden, dann Arme ganz strecken.', easyCue: 'Hüfte nur leicht anheben. Kopf Richtung Boden, dann Arme ganz strecken.' },
  diamond: { kind: 'reps', view: 'any', setup: `${SIDE_OR_FRONT_SETUP} Von vorne prüft die App auch, ob die Hände eng zusammen sind.`, cue: 'Hände unter der Brust zu einer Raute. Runter bis die Arme gebeugt sind, dann ganz hoch.', easyCue: 'Knie am Boden, Hände zu einer Raute. Runter bis die Arme gebeugt sind, dann ganz hoch.' },
  bridge: { kind: 'reps', view: 'side', setup: LYING_SIDE_SETUP, cue: 'Auf dem Rücken, Knie gebeugt: Hüfte hoch, bis Schultern, Hüfte und Knie eine Linie bilden, dann ablegen.', easyCue: 'Auf dem Rücken, Knie gebeugt: Hüfte halb hoch, dann ablegen.' },
  legraises: { kind: 'reps', view: 'side', setup: LYING_SIDE_SETUP, cue: 'Auf dem Rücken: gestreckte Beine bis senkrecht heben, dann langsam fast ablegen.', easyCue: 'Auf dem Rücken: Knie gebeugt zur Brust heben, dann wieder absenken.' },
  hollow: { kind: 'hold', view: 'side', setup: LYING_SIDE_SETUP, cue: 'Auf dem Rücken: Schultern und gestreckte Beine knapp über dem Boden halten. Die Zeit läuft nur in der Haltung.', easyCue: 'Auf dem Rücken: Schultern anheben, Knie gebeugt in der Luft halten. Die Zeit läuft nur in der Haltung.' },
  sideplank: { kind: 'hold', view: 'front', setup: 'Leg das Handy etwa 2 m vor dich auf den Boden, sodass du im Seitstütz mit Brust oder Rücken zur Kamera ganz zu sehen bist. Nur von vorne, nicht an Kopf oder Füße.', cue: 'Auf einem Unterarm, Körper gerade von Kopf bis Fuß. Die Zeit läuft nur in der Haltung.', easyCue: 'Auf Unterarm und Knien, Schultern, Hüfte und Knie in einer Linie. Die Zeit läuft nur in der Haltung.' },
  superman: { kind: 'hold', view: 'side', setup: LYING_SIDE_SETUP, cue: 'Auf dem Bauch: Arme gestreckt nach vorn, Brust und Beine anheben. Die Zeit läuft nur in der Haltung.', easyCue: 'Auf dem Bauch: nur die gestreckten Arme anheben, Beine bleiben liegen. Die Zeit läuft nur in der Haltung.' },
  splitsquat: { kind: 'reps', view: 'side', setup: 'Stell das Handy seitlich auf, etwa 2–3 m entfernt und nicht höher als deine Hüfte, sodass du von Kopf bis Fuß zu sehen bist. Nur von der Seite, nicht von vorne.', cue: 'Hinterer Fuß auf einer Bank oder einem Stuhl. Vorderes Knie beugen, bis der Oberschenkel waagerecht ist, dann hoch. Bein nach der Hälfte wechseln.', easyCue: 'Beide Füße am Boden, Schrittstellung. Hinteres Knie Richtung Boden, dann hoch. Bein nach der Hälfte wechseln.' },
  pistol: { kind: 'reps', view: 'any', setup: LEGS_SETUP, cue: 'Auf einem Bein ganz tief in die Hocke, anderes Bein gestreckt nach vorn, dann hoch. Bein nach der Hälfte wechseln.', easyCue: 'Auf einem Bein langsam auf einen Stuhl setzen, anderes Bein nach vorn, dann wieder hoch. Bein nach der Hälfte wechseln.' },
  jumpsquats: { kind: 'reps', view: 'any', setup: LEGS_SETUP, cue: 'In die Hocke, dann hoch abspringen. Gezählt wird erst der Sprung.', easyCue: 'Schnell halb in die Hocke und ganz aufrichten, ohne Sprung.' },
  handstand: { kind: 'hold', view: 'side', setup: 'Stell das Handy seitlich auf, etwa 2–3 m entfernt, sodass du an der Wand von Händen bis Füßen zu sehen bist. Nur von der Seite, nicht von vorne.', cue: 'Handstand an der Wand, Arme gestreckt. Die Zeit läuft nur in der Haltung.', easyCue: 'Füße auf einem Stuhl, Hände am Boden, Hüfte hoch über den Schultern. Die Zeit läuft nur in der Haltung.' },
  chinups: { kind: 'reps', view: 'any', setup: 'Stell das Handy etwa 2–3 m entfernt vor dich oder seitlich auf, sodass Stange, Kopf und Arme zu sehen sind.', cue: 'Handflächen zu dir. Kinn über die Stange, dann Arme ganz strecken.', easySetup: 'Stell das Handy seitlich auf, etwa 2 m entfernt, sodass du unter der Stange von der Seite ganz zu sehen bist. Nur von der Seite.', easyCue: 'Schräg unter der Stange, Handflächen zu dir: Brust zur Stange ziehen, dann Arme ganz strecken.', easyView: 'side' },
  kneeraises: { kind: 'reps', view: 'side', setup: 'Stell das Handy seitlich auf, etwa 2–3 m entfernt, sodass du an der Stange von Händen bis Füßen zu sehen bist. Nur von der Seite, nicht von vorne.', cue: 'An der Stange hängen, beide Knie bis über die Hüfte ziehen, dann Beine ganz strecken.', easySetup: LYING_SIDE_SETUP, easyCue: 'Auf dem Rücken: Knie gebeugt zur Brust heben, dann wieder absenken.' },
  lsit: { kind: 'hold', view: 'side', setup: 'Stell das Handy seitlich auf den Boden, etwa 2 m entfernt, sodass du im Sitzen von der Seite ganz zu sehen bist. Nur von der Seite, nicht von vorne.', cue: 'Hände neben der Hüfte, Arme gestreckt, Po und gestreckte Beine vom Boden heben. Die Zeit läuft nur in der Haltung.', easyCue: 'Hände neben der Hüfte, Arme gestreckt, Po und Füße vom Boden heben, Knie angezogen. Die Zeit läuft nur in der Haltung.' },
  calves: { kind: 'reps', view: 'side', setup: 'Stell das Handy seitlich auf den Boden, etwa 2 m entfernt, sodass du von der Seite ganz und die Füße gut zu sehen sind. Nur von der Seite, nicht von vorne.', cue: 'Beine gestreckt, ganz auf die Zehenspitzen, dann Fersen ganz absenken.', easyCue: 'Mit einer Hand an der Wand halten. Auf die Zehenspitzen, dann Fersen ganz absenken.' },
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
  [[NOSE, L.ear, R.ear], 'Kopf'],
  [[L.shoulder, R.shoulder], 'Schultern'],
  [[L.elbow, R.elbow], 'Ellbogen'],
  [[L.wrist, R.wrist], 'Handgelenke'],
  [[L.hip, R.hip], 'Hüfte'],
  [[L.knee, R.knee], 'Knie'],
  [[L.ankle, R.ankle, L.heel, R.heel, L.toe, R.toe], 'Füße'],
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

/**
 * The player's own standing value of a height measure (see hipOverAnkles), learned only from
 * frames where the player stands: it jumps up at once and follows lower values slowly.
 */
const learnStand = (old: number | undefined, raw: number, standing: boolean) =>
  !standing ? old : old === undefined || raw > old ? raw : old + 0.05 * (raw - old);

/** Face down (prone): nose clearly below the ear in the image. Face up: clearly above. Unknown if not seen. */
function faceDir(lm: Point[], s: typeof L): 'down' | 'up' | undefined {
  const [n, e] = [lm[NOSE], lm[s.ear]];
  if (vis(n) <= 0.5 || vis(e) <= 0.5) return undefined;
  const d = Math.hypot(n.x - e.x, n.y - e.y);
  if (n.y - e.y > 0.4 * d && d > 0) return 'down';
  if (e.y - n.y > 0.4 * d && d > 0) return 'up';
  return undefined;
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
  // jump squats: image height of the floor under the feet (mean ankle y, follows slowly; see step)
  floor?: number;
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
  easyHint?: string; // German, the gentler version (easy variant), if it differs
  /** null when the needed body parts are not clearly visible, else whether the pose is held (`easy`: gentler, less deep). */
  check: (lm: Point[], aspect: number, easy?: boolean) => boolean | null;
}

/** A stretch pose whose `held` test only runs once all `needs` are clearly visible. */
function stretchPose(p: Omit<StretchPose, 'check'>, held: (lm: Point[], aspect: number, easy: boolean) => boolean): StretchPose {
  return { ...p, check: (lm, aspect, easy = false) => (visible(lm, p.needs) ? held(lm, aspect, easy) : null) };
}

const kneeAngle = (lm: Point[], s: typeof L, aspect: number) => angle(lm[s.hip], lm[s.knee], lm[s.ankle], aspect);
const elbowAngle = (lm: Point[], s: typeof L, aspect: number) => angle(lm[s.shoulder], lm[s.elbow], lm[s.wrist], aspect);

/** Side bend: the wrist of `up` is above the head and the shoulder line drops by more than 12° (easy: 7°) toward the other side. */
function sideBend(id: string, name: string, hint: string, muscles: string, up: typeof L, other: typeof L): StretchPose {
  // The shoulder line tilts sideways: only seen with the chest toward the camera. From the side the
  // shoulders overlap and their line can point anywhere, so a clear side view never counts.
  return stretchPose({ id, name, hint, muscles, needs: [NOSE, L.shoulder, R.shoulder, up.wrist], view: 'front', easyHint: `${hint} Nur leicht neigen.` }, (lm, aspect, easy) => {
    const handUp = lm[up.wrist].y < lm[NOSE].y;
    // The other hand stays down (if seen): with both arms up and the phone low and at an angle,
    // perspective alone tilts the shoulder line.
    const otherDown = vis(lm[other.wrist]) <= 0.5 || lm[other.wrist].y > lm[NOSE].y;
    const towardOther = lm[other.shoulder].y > lm[up.shoulder].y; // the other shoulder is lower
    return handUp && otherDown && towardOther && tilt(lm[L.shoulder], lm[R.shoulder], aspect) > (easy ? 7 : 12) && facing(lm, aspect) !== 'side';
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
      easyHint: 'Knie leicht gebeugt, Hände nur bis zu den Oberschenkeln.',
    },
    (lm, aspect, easy) => {
      // Easy: knees may bend a little more, and the hands only need to reach the middle of the thighs.
      const minKnee = easy ? 135 : 150;
      const straight = kneeAngle(lm, L, aspect) > minKnee && kneeAngle(lm, R, aspect) > minKnee;
      const kneeY = Math.max(lm[L.knee].y, lm[R.knee].y);
      const reach = easy ? avg(Math.max(lm[L.hip].y, lm[R.hip].y), kneeY) : kneeY;
      return straight && lm[L.wrist].y > reach && lm[R.wrist].y > reach;
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
      easyHint: 'Aufrecht stehen, beide Arme nach oben, Ellbogen dürfen leicht gebeugt sein.',
    },
    (lm, aspect, easy) => {
      const s = side(lm);
      const up = lm[L.wrist].y < lm[NOSE].y && lm[R.wrist].y < lm[NOSE].y;
      const upright = tilt(lm[s.shoulder], lm[s.hip], aspect) > 60;
      const minElbow = easy ? 120 : 140;
      const straight = elbowAngle(lm, L, aspect) > minElbow && elbowAngle(lm, R, aspect) > minElbow;
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
      easyHint: 'Seitlich zur Kamera stellen. Kleiner Schritt nach vorn, vorderes Knie leicht beugen, hinteres Bein fast gestreckt.',
    },
    (lm, aspect, easy) => {
      const l = kneeAngle(lm, L, aspect);
      const r = kneeAngle(lm, R, aspect);
      const [bent, straight] = easy ? [135, 140] : [120, 150];
      return (l < bent && r > straight) || (r < bent && l > straight);
    },
  ),
];

/**
 * One frame of the stretch routine: time counts only while the current pose is held. The easy
 * variant ("sanft") keeps 30 s per pose but accepts gentler, less deep poses (see STRETCH_POSES).
 */
function stretchStep(state: ScanState, lm: Point[], dt: number, aspect: number, base: ScanState, easy: boolean): ScanState {
  const idx = state.poseIndex ?? 0;
  const pose = STRETCH_POSES[idx];
  const ok = pose.check(lm, aspect, easy);
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
  /** Run another exercise's detector on this frame (same movement), keeping this exercise's id. */
  const as = (id: string, e: boolean): ScanState => ({ ...step({ ...state, exerciseId: id }, lm, t, aspect, e), exerciseId: state.exerciseId });

  switch (state.exerciseId) {
    case STRETCH:
      return stretchStep(state, pts, dt, aspect, base, easy);
    case PRESENCE: {
      // Timer for stretching and the like: runs only while the player is clearly in view.
      const miss = need([s.shoulder, s.hip]);
      return miss.length ? { ...hold(false), bodyVisible: false, missing: miss } : hold(true);
    }
    case 'pushups':
    case 'diamond': {
      const view = bodyView(pts, aspect);
      if (view === 'front') {
        const miss = missingFront(pts, FRONT_PUSHUP_PARTS);
        if (miss.length) return lost(miss, { view });
        // Head-on: depth from how far the shoulders are above the hands. Knee push-ups count too.
        // Frames out of the push-up position are left out of the smoothing, so they cannot lag
        // into the next frames and fake a "down". Diamond push-ups: head-on the hands must also be
        // close together under the chest (less than 0.6 shoulder widths apart); from the side the
        // hand width cannot be seen, so it counts like a push-up.
        const narrow = state.exerciseId !== 'diamond' || Math.abs(P(L.wrist).x - P(R.wrist).x) * aspect < 0.6 * shoulderWidth(pts, aspect);
        if (!frontProne(pts, aspect) || !narrow) return { ...base, bodyVisible: true, view, smooth: prevView === view ? state.smooth : null };
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
        const standRef = learnStand(old, raw, standing);
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
    // ---------- calisthenics ----------
    case 'chinups':
      // Same movement as pull-ups (and Australian pull-ups for the easy variant), only the grip differs.
      return as('pullups', easy);
    case 'dips': {
      // Elbows bend backward, toward a camera behind or in front: needs the side view.
      const view = facing(pts, aspect);
      const wrong = wrongView(view, 'side');
      if (wrong) return wrong;
      const miss = need([s.shoulder, s.elbow, s.wrist, s.hip]);
      if (miss.length) return lost(miss, { view });
      // Torso upright and the hands pushing down (below the elbows): bending the arms while lying
      // (push-ups) or curling (hands rise above the elbows) does not count.
      const upright = tilt(P(s.shoulder), P(s.hip), aspect) > 50;
      const handsDown = P(s.wrist).y > P(s.elbow).y;
      const a = ema(angle(P(s.shoulder), P(s.elbow), P(s.wrist), aspect));
      const next = { ...base, bodyVisible: true, smooth: a, view };
      // Easy (bench dips, feet close): a little less deep.
      return upright && handsDown ? hysteresis(next, a, easy ? 105 : 95, 145) : next;
    }
    case 'pike': {
      const view = facing(pts, aspect, true);
      const wrong = wrongView(view, 'side');
      if (wrong) return wrong;
      const miss = need([s.shoulder, s.elbow, s.wrist, s.hip, s.ankle]);
      if (miss.length) return lost(miss, { view });
      // Inverted V: the hips are the highest point and the body bends at the hips (below 120°, easy
      // "flach": below 150°); the hands are on the floor below the shoulders.
      const hipHigh = P(s.hip).y < P(s.shoulder).y && P(s.hip).y < P(s.ankle).y;
      const piked = angle(P(s.shoulder), P(s.hip), P(s.ankle), aspect) < (easy ? 150 : 120);
      const handsDown = P(s.wrist).y > P(s.shoulder).y;
      const a = ema(angle(P(s.shoulder), P(s.elbow), P(s.wrist), aspect));
      const next = { ...base, bodyVisible: true, smooth: a, view };
      return hipHigh && piked && handsDown ? hysteresis(next, a, easy ? 110 : 100, 145) : next;
    }
    case 'bridge': {
      // The hips rise toward the ceiling; head-on (camera at head or feet) that is invisible.
      const view = facing(pts, aspect, true);
      const wrong = wrongView(view, 'side');
      if (wrong) return wrong;
      const miss = need([s.shoulder, s.hip, s.knee, s.ankle]);
      if (miss.length) return lost(miss, { view });
      // Lying on the back: shoulders and feet on the floor (their line about level), knees bent and
      // pointing up. Standing and bowing never passes, as shoulders and feet are far apart in height.
      const lying = tilt(P(s.shoulder), P(s.ankle), aspect) < 30 && P(s.knee).y < P(s.hip).y;
      const kneesBent = angle(P(s.hip), P(s.knee), P(s.ankle), aspect) < 130;
      // Hip angle (shoulder–hip–knee): about 120–140° lying, 180° with the body in one line.
      // Mapped to 180 − angle, so "down" = bridged (above 160°, easy "halbe Höhe": above 150°);
      // a rep completes when the hips are lowered again (below 145°, easy 142°).
      const v = ema(180 - angle(P(s.shoulder), P(s.hip), P(s.knee), aspect));
      const next = { ...base, bodyVisible: true, smooth: v, view };
      return lying && kneesBent ? hysteresis(next, v, easy ? 30 : 20, easy ? 38 : 35) : next;
    }
    case 'kneeraises':
      if (easy) return as('legraises', true); // "Knieheben liegend" = leg raises with bent knees
    // falls through
    case 'legraises': {
      const hanging = state.exerciseId === 'kneeraises';
      const view = facing(pts, aspect, !hanging);
      const wrong = wrongView(view, 'side');
      if (wrong) return wrong;
      if (hanging) {
        // Hanging from the bar: hands well above the shoulders, both knees pulled up (hip angle
        // below 105° on both legs, so marching on the spot with the arms up does not count).
        const miss = need([s.shoulder, s.wrist, s.hip, L.knee, R.knee]);
        if (miss.length) return lost(miss, { view });
        const T = dist(P(s.shoulder), P(s.hip), aspect);
        const hangs = P(s.wrist).y < P(s.shoulder).y - 0.3 * T;
        const a = ema(Math.max(angle(P(s.shoulder), P(s.hip), P(L.knee), aspect), angle(P(s.shoulder), P(s.hip), P(R.knee), aspect)));
        const next = { ...base, bodyVisible: true, smooth: a, view };
        return hangs ? hysteresis(next, a, 105, 150) : next;
      }
      // Lying on the back, torso flat. Normal: straight legs (knee > 140°), hip angle to the ankle
      // from about 180° (legs down) to below 110° (legs up). Easy: bent knees, hip angle to the knee.
      const miss = need(easy ? [s.shoulder, s.hip, s.knee] : [s.shoulder, s.hip, s.knee, s.ankle]);
      if (miss.length) return lost(miss, { view });
      const flat = tilt(P(s.shoulder), P(s.hip), aspect) < 30;
      const straight = easy || angle(P(s.hip), P(s.knee), P(s.ankle), aspect) > 140;
      const a = ema(angle(P(s.shoulder), P(s.hip), P(easy ? s.knee : s.ankle), aspect));
      const next = { ...base, bodyVisible: true, smooth: a, view };
      return flat && straight ? hysteresis(next, a, easy ? 100 : 110, easy ? 145 : 155) : next;
    }
    case 'hollow': {
      const view = facing(pts, aspect, true);
      const wrong = wrongView(view, 'side');
      if (wrong) return wrong;
      const miss = need(easy ? [s.shoulder, s.hip, s.knee] : [s.shoulder, s.hip, s.knee, s.ankle]);
      if (miss.length) return lost(miss, { view });
      // Lying on the back (the face does not point down), shoulders lifted (more than 0.15 torso
      // lengths above the hips, torso flatter than 45°). Normal: straight legs, ankles lifted above
      // the hips, legs flatter than 45°. Easy: knees bent and lifted above the hips.
      const T = dist(P(s.shoulder), P(s.hip), aspect);
      const shouldersUp = P(s.hip).y - P(s.shoulder).y > 0.15 * T && tilt(P(s.hip), P(s.shoulder), aspect) < 45;
      const legs = easy
        ? P(s.knee).y < P(s.hip).y - 0.1 * T
        : angle(P(s.hip), P(s.knee), P(s.ankle), aspect) > 150 &&
          P(s.ankle).y < P(s.hip).y - 0.08 * dist(P(s.hip), P(s.ankle), aspect) &&
          tilt(P(s.hip), P(s.ankle), aspect) < 45;
      return { ...hold(shouldersUp && legs && faceDir(pts, s) !== 'down'), view };
    }
    case 'superman': {
      const view = facing(pts, aspect, true);
      const wrong = wrongView(view, 'side');
      if (wrong) return wrong;
      const miss = need(easy ? [s.shoulder, s.wrist, s.hip] : [s.shoulder, s.wrist, s.hip, s.knee, s.ankle]);
      if (miss.length) return lost(miss, { view });
      // Lying on the belly (the face does not point up), torso flatter than 35°. Arms stretched
      // forward beyond the head and lifted (wrists above the shoulders, arm line flatter than 50°).
      // Normal also lifts the chest (shoulders > 0.15 torso lengths above the hips) and the straight
      // legs (ankles above the hips). Easy ("nur Arme"): arms only, clearly lifted.
      const T = dist(P(s.shoulder), P(s.hip), aspect);
      const lying = tilt(P(s.shoulder), P(s.hip), aspect) < 35;
      const forward = Math.abs(P(s.wrist).x - P(s.hip).x) > Math.abs(P(s.shoulder).x - P(s.hip).x);
      const armsUp = P(s.wrist).y < P(s.shoulder).y - (easy ? 0.1 * T : 0) && tilt(P(s.shoulder), P(s.wrist), aspect) < 50;
      const chestUp = easy || P(s.hip).y - P(s.shoulder).y > 0.15 * T;
      const legsUp = easy || (P(s.ankle).y < P(s.hip).y && angle(P(s.hip), P(s.knee), P(s.ankle), aspect) > 140);
      return { ...hold(lying && forward && armsUp && chestUp && legsUp && faceDir(pts, s) !== 'up'), view };
    }
    case 'sideplank': {
      // Seen with chest or back toward the camera, the shoulders are stacked one above the other.
      // From the head or the feet the line through the body cannot be seen; standing sideways the
      // two shoulders overlap. `facing` does not work here (it expects level shoulders), so: both
      // shoulders far apart in the image (> 0.25 torso lengths) = front, else side.
      const miss = need([L.shoulder, R.shoulder, L.hip, R.hip]);
      if (miss.length) return lost(miss);
      const ms = mid(P(L.shoulder), P(R.shoulder));
      const mh = mid(P(L.hip), P(R.hip));
      const T = dist(ms, mh, aspect) || 0.0001;
      const view: BodyView = dist(P(L.shoulder), P(R.shoulder), aspect) > 0.25 * T ? 'front' : 'side';
      const wrong = wrongView(view, 'front');
      if (wrong) return wrong;
      const ends = easy ? [L.knee, R.knee] : [L.ankle, R.ankle];
      const missEnd = need(ends);
      if (missEnd.length) return lost(missEnd, { view });
      const me = mid(P(ends[0]), P(ends[1]));
      // Shoulders stacked (shoulder line steeper than 50°), body straight from shoulders to feet
      // (knees when easy), and the body line slightly raised: 10–45° (knees: 12–55°). Lying on the
      // side on the floor is flatter, standing is steeper.
      const stacked = tilt(P(L.shoulder), P(R.shoulder), aspect) > 50;
      const straight = angle(ms, mh, me, aspect) > (easy ? 150 : 155);
      const t = tilt(ms, me, aspect);
      const raised = easy ? t > 12 && t < 55 : t > 10 && t < 45;
      return { ...hold(stacked && straight && raised), view };
    }
    case 'splitsquat': {
      // Knee angles: head-on the bent front knee points at the camera. Side view only.
      const view = facing(pts, aspect);
      const wrong = wrongView(view, 'side');
      if (wrong) return wrong;
      const miss = need([L.hip, L.knee, L.ankle, R.hip, R.knee, R.ankle]);
      if (miss.length) return lost(miss, { view });
      const kl = angle(P(L.hip), P(L.knee), P(L.ankle), aspect);
      const kr = angle(P(R.hip), P(R.knee), P(R.ankle), aspect);
      if (easy) {
        // Split squat, both feet on the floor: like lunges, the more bent knee counts. Only in a
        // split stance (feet more than 0.6 shin lengths apart, about level), so lifting a knee while
        // walking or stepping on the spot does not count.
        const shin = Math.max(dist(P(L.knee), P(L.ankle), aspect), dist(P(R.knee), P(R.ankle), aspect));
        const stance = Math.abs(P(L.ankle).x - P(R.ankle).x) * aspect > 0.6 * shin && Math.abs(P(L.ankle).y - P(R.ankle).y) < 0.3 * shin;
        const a = ema(Math.min(kl, kr));
        const next = { ...base, bodyVisible: true, smooth: a, view };
        return stance ? hysteresis(next, a, 115, 150) : next;
      }
      // Bulgarian: the rear foot is up on a bench, so its knee stays bent all the time. The front
      // leg is the one with the lower ankle; the rear ankle must be clearly raised (> 0.2 shin lengths),
      // otherwise this is an ordinary lunge.
      const [front, rear] = P(L.ankle).y >= P(R.ankle).y ? [L, R] : [R, L];
      const shin = dist(P(front.knee), P(front.ankle), aspect);
      const raised = P(rear.ankle).y < P(front.ankle).y - 0.2 * shin;
      const a = ema(front === L ? kl : kr);
      const next = { ...base, bodyVisible: true, smooth: a, view };
      return raised ? hysteresis(next, a, 105, 150) : next;
    }
    case 'pistol': {
      // One-leg squat. Standing leg = the one with the lower ankle; the free foot must be clearly
      // off the floor (> 0.25 shin lengths above the other) at the bottom, so a normal squat never
      // counts. Easy (sit down on a chair on one leg): less deep.
      const view: BodyView = facing(pts, aspect) === 'front' ? 'front' : 'side';
      const miss = need(FRONT_LEG_PARTS.filter((i) => view === 'front' || (i !== L.shoulder && i !== R.shoulder)));
      if (miss.length) return lost(miss, { view });
      const [st, free] = P(L.ankle).y >= P(R.ankle).y ? [L, R] : [R, L];
      const shin = dist(P(st.knee), P(st.ankle), aspect) || 0.0001;
      const lifted = P(free.ankle).y < P(st.ankle).y - 0.25 * shin;
      if (view === 'front') {
        // Head-on: hip height above the standing ankle as a share of the player's own standing value
        // (as for squats, learned while the standing thigh is upright).
        const raw = (P(st.ankle).y - avg(P(L.hip).y, P(R.hip).y)) / shoulderWidth(pts, aspect);
        const standing = (P(st.knee).y - avg(P(L.hip).y, P(R.hip).y)) / shin > 0.85;
        const standRef = learnStand(state.standRef, raw, standing);
        const h = smoothIn(view, raw / (standRef ?? STAND_HIP_SW));
        const next = { ...base, bodyVisible: true, smooth: h, view, standRef };
        const down = easy ? 0.7 : 0.55;
        return h < down && !lifted ? next : hysteresis(next, h, down, 0.85);
      }
      const a = smoothIn(view, angle(P(st.hip), P(st.knee), P(st.ankle), aspect));
      const next = { ...base, bodyVisible: true, smooth: a, view };
      const down = easy ? 100 : 80;
      return a < down && !lifted ? next : hysteresis(next, a, down, 150);
    }
    case 'jumpsquats': {
      if (easy) return as('squats', true); // fast half squats without the jump
      // A rep = a squat (side: knee below 120°, front: hips below 0.8 of the standing height),
      // then a jump: both feet clearly off the floor (mean ankle more than 0.1 leg lengths above
      // the floor). The floor is the lowest ankle height seen; it follows higher values slowly
      // (2 % per frame), so walking toward or away from the phone does not leave it wrong for long.
      const view: BodyView = facing(pts, aspect) === 'front' ? 'front' : 'side';
      const parts = view === 'front' ? FRONT_LEG_PARTS : [s.hip, s.knee, s.ankle];
      const miss = need(parts);
      if (miss.length) return lost(miss, { view });
      const ankleY = view === 'front' ? avg(P(L.ankle).y, P(R.ankle).y) : P(s.ankle).y;
      const floor = state.floor === undefined || ankleY > state.floor ? ankleY : state.floor + 0.02 * (ankleY - state.floor);
      const leg = dist(P(s.hip), P(s.ankle), aspect);
      const airborne = ankleY < floor - 0.1 * leg;
      let deep: boolean;
      let standRef = state.standRef;
      if (view === 'front') {
        const raw = hipOverAnkles(pts, aspect);
        standRef = learnStand(standRef, raw, !airborne && Math.min(...thighDrops(pts, aspect)) > 0.85);
        deep = raw / (standRef ?? STAND_HIP_SW) < 0.8;
      } else deep = angle(P(s.hip), P(s.knee), P(s.ankle), aspect) < 120;
      // "down" = squatted; the rep completes in the air
      const v = pseudo(deep, airborne);
      return hysteresis({ ...base, bodyVisible: true, smooth: v, view, floor, standRef }, v, 45, 135);
    }
    case 'handstand': {
      const view = facing(pts, aspect);
      const wrong = wrongView(view, 'side');
      if (wrong) return wrong;
      const miss = need([s.wrist, s.elbow, s.shoulder, s.hip, s.ankle]);
      if (miss.length) return lost(miss, { view });
      const T = dist(P(s.shoulder), P(s.hip), aspect);
      const armsStraight = angle(P(s.shoulder), P(s.elbow), P(s.wrist), aspect) > 140;
      const handsDown = P(s.wrist).y > P(s.shoulder).y;
      if (easy) {
        // Pike hold, feet on a chair: hips clearly above the shoulders (> 0.3 torso lengths), torso
        // steeper than 45°, bent at the hips (< 135°), feet off the floor (above the hands).
        const hipsUp = P(s.hip).y < P(s.shoulder).y - 0.3 * T && tilt(P(s.shoulder), P(s.hip), aspect) > 45;
        const piked = angle(P(s.shoulder), P(s.hip), P(s.ankle), aspect) < 135;
        const feetUp = P(s.ankle).y < P(s.wrist).y - 0.2 * T;
        return { ...hold(armsStraight && handsDown && hipsUp && piked && feetUp), view };
      }
      // Upside down: hands lowest, then shoulders, hips, feet on top; body steeper than 60° and
      // about straight (> 140°, the back may arch against the wall).
      const inverted = P(s.hip).y < P(s.shoulder).y - 0.5 * T && P(s.ankle).y < P(s.hip).y;
      const steep = tilt(P(s.shoulder), P(s.ankle), aspect) > 60;
      const straight = angle(P(s.shoulder), P(s.hip), P(s.ankle), aspect) > 140;
      return { ...hold(armsStraight && handsDown && inverted && steep && straight), view };
    }
    case 'lsit': {
      const view = facing(pts, aspect);
      const wrong = wrongView(view, 'side');
      if (wrong) return wrong;
      const miss = need([s.shoulder, s.elbow, s.wrist, s.hip, s.knee, s.ankle]);
      if (miss.length) return lost(miss, { view });
      // Torso upright (> 55°), arms straight (> 140°) with the hands beside the hips (not more than
      // 0.25 torso lengths above them), and the feet off the floor: above the hands by more than
      // 0.1 torso lengths (sitting on the floor with straight legs, feet and hands are level).
      // Normal: straight legs (> 150°) about level (< 25°). Easy (tuck): knees pulled up (hip angle < 100°).
      const T = dist(P(s.shoulder), P(s.hip), aspect);
      const upright = tilt(P(s.shoulder), P(s.hip), aspect) > 55;
      const arms = angle(P(s.shoulder), P(s.elbow), P(s.wrist), aspect) > 140 && P(s.wrist).y > P(s.hip).y - 0.25 * T;
      const feetUp = P(s.ankle).y < P(s.wrist).y - 0.1 * T;
      const legs = easy
        ? angle(P(s.shoulder), P(s.hip), P(s.knee), aspect) < 100
        : angle(P(s.hip), P(s.knee), P(s.ankle), aspect) > 150 && tilt(P(s.hip), P(s.ankle), aspect) < 25;
      return { ...hold(upright && arms && feetUp && legs), view };
    }
    case 'calves': {
      // The heel rises over the toes: only seen from the side.
      const view = facing(pts, aspect);
      const wrong = wrongView(view, 'side');
      if (wrong) return wrong;
      const miss = need([s.shoulder, s.hip, s.knee, s.ankle, s.heel, s.toe]);
      if (miss.length) return lost(miss, { view });
      // Standing upright with straight legs (squatting on the toes does not count). Lift = how far
      // the heel is above the toes, in foot lengths: flat about 0, on the toes about 0.3–0.4.
      const upright = tilt(P(s.shoulder), P(s.hip), aspect) > 60 && angle(P(s.hip), P(s.knee), P(s.ankle), aspect) > 150;
      const foot = dist(P(s.heel), P(s.toe), aspect) || 0.0001;
      const lift = smoothIn('side', (P(s.toe).y - P(s.heel).y) / foot);
      const v = pseudo(lift > (easy ? 0.22 : 0.28), lift < 0.1);
      const next = { ...base, bodyVisible: true, smooth: lift, view };
      return upright ? hysteresis(next, v, 45, 135) : next;
    }
    default:
      return pts.length ? base : { ...base, bodyVisible: false, inPosition: false };
  }
}

/** Progress in the exercise's own unit: reps, or whole seconds for holds and presence mode. */
export const scanAmount = (s: ScanState) =>
  s.exerciseId === PRESENCE || SCANNABLE[s.exerciseId]?.kind === 'hold' ? Math.floor(s.holdMs / 1000) : s.reps;
