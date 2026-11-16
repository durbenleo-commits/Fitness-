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

export interface ScanSpec {
  kind: ScanKind;
  setup: string; // where to put the phone
  cue: string; // short instruction while moving
  easySetup?: string; // easier variant, if the phone goes somewhere else
  easyCue?: string; // easier variant
}

/** Exercise id for presence mode: a timer that only runs while the player is clearly in view. */
export const PRESENCE = '__presence';

export const PRESENCE_SPEC: ScanSpec = {
  kind: 'presence',
  setup: 'Stell das Handy etwa 2–3 m entfernt auf, sodass du mit Schultern und Hüfte gut zu sehen bist.',
  cue: 'Die Zeit läuft nur, solange du gut zu sehen bist.',
};

/** Exercises the camera can check, with how to set up the phone. */
export const SCANNABLE: Record<string, ScanSpec> = {
  pushups: { kind: 'reps', setup: 'Stell das Handy seitlich auf den Boden, etwa 2 m entfernt, sodass du von der Seite ganz zu sehen bist.', cue: 'Runter bis die Arme gebeugt sind, dann ganz hoch.', easyCue: 'Knie am Boden lassen. Runter bis die Arme gebeugt sind, dann ganz hoch.' },
  squats: { kind: 'reps', setup: 'Stell das Handy etwa 2–3 m entfernt seitlich auf, sodass du von Kopf bis Fuß zu sehen bist.', cue: 'Tief in die Hocke, dann ganz aufrichten.', easyCue: 'Halb in die Hocke, dann ganz aufrichten.' },
  lunges: { kind: 'reps', setup: 'Stell das Handy etwa 2–3 m entfernt seitlich auf, sodass du von Kopf bis Fuß zu sehen bist.', cue: 'Großer Schritt, hinteres Knie Richtung Boden, zurück in den Stand.', easyCue: 'Halt dich an einer Stuhllehne fest. Hinteres Knie Richtung Boden, zurück in den Stand.' },
  jacks: { kind: 'reps', setup: 'Stell das Handy etwa 2–3 m vor dich, sodass du von vorne ganz zu sehen bist.', cue: 'Arme über den Kopf und Beine auseinander, dann zurück.', easyCue: 'Ohne Sprung: ein Bein zur Seite und Arme über den Kopf, dann zurück.' },
  pullups: { kind: 'reps', setup: 'Stell das Handy so auf, dass Stange, Kopf und Arme zu sehen sind.', cue: 'Kinn über die Stange, dann Arme ganz strecken.', easySetup: 'Stell das Handy seitlich auf, sodass du unter der Stange von der Seite ganz zu sehen bist.', easyCue: 'Schräg unter der Stange: Brust zur Stange ziehen, dann Arme ganz strecken.' },
  plank: { kind: 'hold', setup: 'Stell das Handy seitlich auf den Boden, etwa 2 m entfernt, sodass du von der Seite ganz zu sehen bist.', cue: 'Körper gerade halten. Die Zeit läuft nur, solange die Haltung stimmt.', easyCue: 'Auf Unterarmen und Knien: Schultern, Hüfte und Knie in einer Linie. Die Zeit läuft nur in der Haltung.' },
  wallsit: { kind: 'hold', setup: 'Stell das Handy seitlich auf, sodass du von Kopf bis Fuß zu sehen bist.', cue: 'Knie etwa im rechten Winkel halten. Die Zeit läuft nur in der Haltung.', easyCue: 'Knie leicht gebeugt halten, höher als im rechten Winkel. Die Zeit läuft nur in der Haltung.' },
  situps: { kind: 'reps', setup: 'Leg das Handy seitlich auf den Boden, etwa 2 m entfernt, sodass du im Liegen von der Seite ganz zu sehen bist.', cue: 'Oberkörper aufrichten, dann wieder ablegen.', easyCue: 'Oberkörper halb aufrichten, dann wieder ablegen.' },
  curls: { kind: 'reps', setup: 'Stell das Handy etwa 2 m entfernt seitlich auf, sodass Oberkörper und Arm von der Seite zu sehen sind.', cue: 'Ellbogen am Körper, Hantel ganz hoch, dann Arm ganz strecken. Zählt den Arm, der zur Kamera zeigt.' },
  press: { kind: 'reps', setup: 'Stell das Handy etwa 2 m vor dich, sodass du von vorne mit Kopf und ausgestreckten Armen zu sehen bist.', cue: 'Hanteln über den Kopf drücken, dann bis unter die Schultern senken.' },
  rows: { kind: 'reps', setup: 'Stell das Handy etwa 2 m entfernt seitlich auf, sodass Oberkörper und Arme von der Seite zu sehen sind.', cue: 'Band zum Bauch ziehen, dann Arme ganz strecken.' },
  swings: { kind: 'reps', setup: 'Stell das Handy etwa 2–3 m entfernt seitlich auf, sodass du von Kopf bis Fuß zu sehen bist.', cue: 'Kugel bis auf Schulterhöhe schwingen, dann zwischen die Beine zurück.' },
  burpees: { kind: 'reps', setup: 'Stell das Handy etwa 2–3 m entfernt seitlich auf, sodass du von Kopf bis Fuß zu sehen bist.', cue: 'Runter in den Liegestütz, dann ganz aufrichten.', easyCue: 'Ohne Sprung: Beine nacheinander in den Liegestütz setzen, dann ganz aufrichten.' },
  stretch: { kind: 'hold', setup: 'Stell das Handy etwa 2–3 m entfernt schräg vor dich auf, sodass du von Kopf bis Fuß zu sehen bist.', cue: 'Halte jede Dehnung 30 Sekunden. Die Zeit läuft nur, solange die Haltung stimmt.' },
  mountain: { kind: 'reps', setup: 'Stell das Handy seitlich auf den Boden, etwa 2 m entfernt, sodass du von der Seite ganz zu sehen bist.', cue: 'Im Liegestütz abwechselnd ein Knie zur Brust ziehen.', easyCue: 'Im Liegestütz langsam abwechselnd ein Knie zur Brust ziehen.' },
};

export const isScannable = (exerciseId: string | undefined) => !!exerciseId && exerciseId in SCANNABLE;

/** Setup and cue for an exercise (or presence mode), with the easier variant's texts when asked. */
export function scanSpec(exerciseId: string, easy = false): ScanSpec | undefined {
  const spec = exerciseId === PRESENCE ? PRESENCE_SPEC : SCANNABLE[exerciseId];
  if (!spec || !easy) return spec;
  return { ...spec, setup: spec.easySetup ?? spec.setup, cue: spec.easyCue ?? spec.cue };
}

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
  /** null when the needed body parts are not clearly visible, else whether the pose is held. */
  check: (lm: Point[], aspect: number) => boolean | null;
}

const kneeAngle = (lm: Point[], s: typeof L, aspect: number) => angle(lm[s.hip], lm[s.knee], lm[s.ankle], aspect);
const elbowAngle = (lm: Point[], s: typeof L, aspect: number) => angle(lm[s.shoulder], lm[s.elbow], lm[s.wrist], aspect);

/** Side bend: the wrist of `up` is above the head and the shoulder line drops by more than 12° toward the other side. */
function sideBend(up: typeof L, other: typeof L) {
  return (lm: Point[], aspect: number): boolean | null => {
    if (!visible(lm, [NOSE, L.shoulder, R.shoulder, up.wrist])) return null;
    const handUp = lm[up.wrist].y < lm[NOSE].y;
    const towardOther = lm[other.shoulder].y > lm[up.shoulder].y; // the other shoulder is lower
    return handUp && towardOther && tilt(lm[L.shoulder], lm[R.shoulder], aspect) > 12;
  };
}

export const STRETCH_POSES: StretchPose[] = [
  {
    id: 'forward-fold',
    name: 'Vorbeuge',
    hint: 'Beine fast gestreckt, Hände unter die Knie.',
    check: (lm, aspect) => {
      if (!visible(lm, [L.hip, L.knee, L.ankle, R.hip, R.knee, R.ankle, L.wrist, R.wrist])) return null;
      const straight = kneeAngle(lm, L, aspect) > 150 && kneeAngle(lm, R, aspect) > 150;
      const kneeY = Math.max(lm[L.knee].y, lm[R.knee].y);
      return straight && lm[L.wrist].y > kneeY && lm[R.wrist].y > kneeY;
    },
  },
  {
    id: 'side-bend-left',
    name: 'Seitneigung links',
    hint: 'Rechten Arm über den Kopf, Oberkörper zur linken Seite neigen.',
    check: sideBend(R, L),
  },
  {
    id: 'side-bend-right',
    name: 'Seitneigung rechts',
    hint: 'Linken Arm über den Kopf, Oberkörper zur rechten Seite neigen.',
    check: sideBend(L, R),
  },
  {
    id: 'arms-up',
    name: 'Arme hoch',
    hint: 'Aufrecht stehen, beide Arme gestreckt nach oben.',
    check: (lm, aspect) => {
      if (!visible(lm, [NOSE, L.shoulder, R.shoulder, L.elbow, R.elbow, L.wrist, R.wrist, L.hip, R.hip])) return null;
      const s = side(lm);
      const up = lm[L.wrist].y < lm[NOSE].y && lm[R.wrist].y < lm[NOSE].y;
      const upright = tilt(lm[s.shoulder], lm[s.hip], aspect) > 60;
      const straight = elbowAngle(lm, L, aspect) > 140 && elbowAngle(lm, R, aspect) > 140;
      return up && upright && straight;
    },
  },
  {
    id: 'lunge-stretch',
    name: 'Ausfallschritt-Dehnung',
    hint: 'Großer Schritt nach vorn, vorderes Knie beugen, hinteres Bein gestreckt.',
    check: (lm, aspect) => {
      if (!visible(lm, [L.hip, L.knee, L.ankle, R.hip, R.knee, R.ankle])) return null;
      const l = kneeAngle(lm, L, aspect);
      const r = kneeAngle(lm, R, aspect);
      return (l < 120 && r > 150) || (r < 120 && l > 150);
    },
  },
];

/** One frame of the stretch routine: time counts only while the current pose is held. */
function stretchStep(state: ScanState, lm: Point[], dt: number, aspect: number, base: ScanState): ScanState {
  const idx = state.poseIndex ?? 0;
  const pose = STRETCH_POSES[idx];
  const ok = pose.check(lm, aspect);
  if (ok === null) return { ...base, bodyVisible: false, inPosition: false };
  const held = ok ? dt : 0;
  const poseMs = (state.poseMs ?? 0) + held;
  const nextIdx = poseMs >= STRETCH_POSE_MS ? (idx + 1) % STRETCH_POSES.length : idx;
  return {
    ...base,
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
 * counted while the needed body parts are not clearly visible. `easy` switches
 * to the easier variant's thresholds (see VARIANTS in game.ts).
 */
export function step(state: ScanState, lm: Point[] | undefined, t: number, aspect = 1, easy = false): ScanState {
  const dt = state.lastT === null ? 0 : Math.min(t - state.lastT, 500);
  const base = { ...state, lastT: t };
  if (!lm || lm.length < 29) return { ...base, bodyVisible: false, inPosition: false };
  const s = side(lm);
  const P = (i: number) => lm[i];
  const ema = (v: number) => (state.smooth === null ? v : state.smooth * 0.5 + v * 0.5);
  const hold = (ok: boolean): ScanState => ({ ...base, bodyVisible: true, inPosition: ok, holdMs: state.holdMs + (ok ? dt : 0) });

  switch (state.exerciseId) {
    case STRETCH:
      return stretchStep(state, lm, dt, aspect, base);
    case PRESENCE: {
      // Timer for stretching and the like: runs only while the player is clearly in view.
      const ok = visible(lm, [s.shoulder, s.hip]);
      return { ...hold(ok), bodyVisible: ok };
    }
    case 'pushups': {
      // Knee push-ups count too: the check uses the shoulder–hip line only.
      if (!visible(lm, [s.shoulder, s.elbow, s.wrist, s.hip])) return { ...base, bodyVisible: false };
      // Only count with the body roughly horizontal, so arm bends while standing do not count.
      const flat = tilt(P(s.shoulder), P(s.hip), aspect) < 45;
      const a = ema(angle(P(s.shoulder), P(s.elbow), P(s.wrist), aspect));
      const next = { ...base, bodyVisible: true, smooth: a };
      return flat ? hysteresis(next, a, 100, 150) : next;
    }
    case 'squats': {
      if (!visible(lm, [s.hip, s.knee, s.ankle])) return { ...base, bodyVisible: false };
      const a = ema(angle(P(s.hip), P(s.knee), P(s.ankle), aspect));
      return hysteresis({ ...base, bodyVisible: true, smooth: a }, a, easy ? 130 : 110, 160);
    }
    case 'lunges': {
      if (!visible(lm, [L.hip, L.knee, L.ankle, R.hip, R.knee, R.ankle])) return { ...base, bodyVisible: false };
      const a = ema(Math.min(angle(P(L.hip), P(L.knee), P(L.ankle), aspect), angle(P(R.hip), P(R.knee), P(R.ankle), aspect)));
      return hysteresis({ ...base, bodyVisible: true, smooth: a }, a, 115, 155);
    }
    case 'jacks': {
      if (!visible(lm, [L.shoulder, R.shoulder, L.wrist, R.wrist, L.ankle, R.ankle])) return { ...base, bodyVisible: false };
      const shoulderW = Math.abs(P(L.shoulder).x - P(R.shoulder).x) || 0.0001;
      const feet = Math.abs(P(L.ankle).x - P(R.ankle).x) / shoulderW;
      const armsUp = P(L.wrist).y < P(L.shoulder).y && P(R.wrist).y < P(R.shoulder).y;
      const armsDown = P(L.wrist).y > P(L.shoulder).y && P(R.wrist).y > P(R.shoulder).y;
      // map to a pseudo-angle: open = 0, closed = 180, so the shared hysteresis applies
      const v = pseudo(armsUp && feet > 1.4, armsDown && feet < 1.1);
      return hysteresis({ ...base, bodyVisible: true, smooth: v }, v, 45, 135);
    }
    case 'pullups': {
      if (easy) {
        // Australian pull-ups: body under a low bar, counted on the elbow angle like rows.
        if (!visible(lm, [s.shoulder, s.elbow, s.wrist])) return { ...base, bodyVisible: false };
        const a = ema(angle(P(s.shoulder), P(s.elbow), P(s.wrist), aspect));
        return hysteresis({ ...base, bodyVisible: true, smooth: a }, a, 80, 140);
      }
      if (!visible(lm, [NOSE, L.wrist, R.wrist, s.elbow, s.shoulder])) return { ...base, bodyVisible: false };
      const handsUp = P(L.wrist).y < P(NOSE).y && P(R.wrist).y < P(NOSE).y;
      if (!handsUp) return { ...base, bodyVisible: true };
      const a = ema(angle(P(s.shoulder), P(s.elbow), P(s.wrist), aspect));
      // "down" here means pulled up (elbows bent); a rep completes when the arms straighten again
      return hysteresis({ ...base, bodyVisible: true, smooth: a }, a, 80, 145);
    }
    case 'plank': {
      // Easy: knee plank, so the line runs shoulder–hip–knee instead of to the ankle.
      const end = easy ? s.knee : s.ankle;
      if (!visible(lm, [s.shoulder, s.hip, end])) return { ...base, bodyVisible: false, inPosition: false };
      const straight = angle(P(s.shoulder), P(s.hip), P(end), aspect) > 155;
      const flat = tilt(P(s.shoulder), P(end), aspect) < 35;
      return hold(straight && flat);
    }
    case 'wallsit': {
      if (!visible(lm, [s.hip, s.knee, s.ankle])) return { ...base, bodyVisible: false, inPosition: false };
      const k = angle(P(s.hip), P(s.knee), P(s.ankle), aspect);
      return hold(k > 70 && k < (easy ? 140 : 120));
    }
    case 'situps': {
      if (!visible(lm, [s.shoulder, s.hip, s.knee])) return { ...base, bodyVisible: false };
      // Lying down: the thigh is never upright. Bowing forward while standing does not count.
      const lying = tilt(P(s.hip), P(s.knee), aspect) < 70;
      const a = ema(angle(P(s.shoulder), P(s.hip), P(s.knee), aspect));
      const next = { ...base, bodyVisible: true, smooth: a };
      // "down" = sat up; a rep completes when lying back again
      return lying ? hysteresis(next, a, easy ? 110 : 95, 125) : next;
    }
    case 'curls': {
      if (!visible(lm, [s.shoulder, s.elbow, s.wrist, s.hip])) return { ...base, bodyVisible: false };
      const upright = tilt(P(s.shoulder), P(s.hip), aspect) > 60;
      const a = ema(angle(P(s.shoulder), P(s.elbow), P(s.wrist), aspect));
      const next = { ...base, bodyVisible: true, smooth: a };
      // "down" = curled; a rep completes when the arm is straight again
      return upright ? hysteresis(next, a, 60, 140) : next;
    }
    case 'press': {
      if (!visible(lm, [NOSE, L.wrist, R.wrist, L.shoulder, R.shoulder])) return { ...base, bodyVisible: false };
      const pressed = P(L.wrist).y < P(NOSE).y && P(R.wrist).y < P(NOSE).y;
      const start = P(L.wrist).y > P(L.shoulder).y && P(R.wrist).y > P(R.shoulder).y;
      const v = pseudo(pressed, start);
      return hysteresis({ ...base, bodyVisible: true, smooth: v }, v, 45, 135);
    }
    case 'rows': {
      if (!visible(lm, [s.shoulder, s.elbow, s.wrist])) return { ...base, bodyVisible: false };
      const a = ema(angle(P(s.shoulder), P(s.elbow), P(s.wrist), aspect));
      const next = { ...base, bodyVisible: true, smooth: a };
      // hands stay below the shoulders; "down" = pulled, a rep completes on extension
      return P(s.wrist).y > P(s.shoulder).y ? hysteresis(next, a, 80, 140) : next;
    }
    case 'swings': {
      if (!visible(lm, [s.shoulder, s.hip, s.wrist])) return { ...base, bodyVisible: false };
      const torso = Math.abs(P(s.hip).y - P(s.shoulder).y);
      const top = P(s.wrist).y <= P(s.shoulder).y + 0.1 * torso; // at or above shoulder height
      const bottom = P(s.wrist).y > P(s.hip).y;
      const v = pseudo(top, bottom);
      return hysteresis({ ...base, bodyVisible: true, smooth: v }, v, 45, 135);
    }
    case 'burpees': {
      if (!visible(lm, [s.shoulder, s.hip])) return { ...base, bodyVisible: false };
      // torso tilt: plank (< 30) is "down", standing again (> 60) completes the rep
      const a = ema(tilt(P(s.shoulder), P(s.hip), aspect));
      return hysteresis({ ...base, bodyVisible: true, smooth: a }, a, 30, 60);
    }
    case 'mountain': {
      if (!visible(lm, [L.shoulder, L.hip, L.knee, R.shoulder, R.hip, R.knee])) return { ...base, bodyVisible: false };
      const horizontal = tilt(P(s.shoulder), P(s.hip), aspect) < 45;
      const prev = state.legs ?? [
        { phase: 'unknown' as Phase, smooth: null },
        { phase: 'unknown' as Phase, smooth: null },
      ];
      if (!horizontal) return { ...base, bodyVisible: true, legs: prev };
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
      return { ...base, bodyVisible: true, reps, legs, phase, smooth: Math.min(legs[0].smooth, legs[1].smooth) };
    }
    default:
      return base;
  }
}

/** Progress in the exercise's own unit: reps, or whole seconds for holds and presence mode. */
export const scanAmount = (s: ScanState) =>
  s.exerciseId === PRESENCE || SCANNABLE[s.exerciseId]?.kind === 'hold' ? Math.floor(s.holdMs / 1000) : s.reps;
