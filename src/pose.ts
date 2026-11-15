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

export type ScanKind = 'reps' | 'hold';

export interface ScanSpec {
  kind: ScanKind;
  setup: string; // where to put the phone
  cue: string; // short instruction while moving
}

/** Exercises the camera can check, with how to set up the phone. */
export const SCANNABLE: Record<string, ScanSpec> = {
  pushups: { kind: 'reps', setup: 'Stell das Handy seitlich auf den Boden, etwa 2 m entfernt, sodass du von der Seite ganz zu sehen bist.', cue: 'Runter bis die Arme gebeugt sind, dann ganz hoch.' },
  squats: { kind: 'reps', setup: 'Stell das Handy etwa 2–3 m entfernt seitlich auf, sodass du von Kopf bis Fuß zu sehen bist.', cue: 'Tief in die Hocke, dann ganz aufrichten.' },
  lunges: { kind: 'reps', setup: 'Stell das Handy etwa 2–3 m entfernt seitlich auf, sodass du von Kopf bis Fuß zu sehen bist.', cue: 'Großer Schritt, hinteres Knie Richtung Boden, zurück in den Stand.' },
  jacks: { kind: 'reps', setup: 'Stell das Handy etwa 2–3 m vor dich, sodass du von vorne ganz zu sehen bist.', cue: 'Arme über den Kopf und Beine auseinander, dann zurück.' },
  pullups: { kind: 'reps', setup: 'Stell das Handy so auf, dass Stange, Kopf und Arme zu sehen sind.', cue: 'Kinn über die Stange, dann Arme ganz strecken.' },
  plank: { kind: 'hold', setup: 'Stell das Handy seitlich auf den Boden, etwa 2 m entfernt, sodass du von der Seite ganz zu sehen bist.', cue: 'Körper gerade halten. Die Zeit läuft nur, solange die Haltung stimmt.' },
  wallsit: { kind: 'hold', setup: 'Stell das Handy seitlich auf, sodass du von Kopf bis Fuß zu sehen bist.', cue: 'Knie etwa im rechten Winkel halten. Die Zeit läuft nur in der Haltung.' },
};

export const isScannable = (exerciseId: string | undefined) => !!exerciseId && exerciseId in SCANNABLE;

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
});

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

/**
 * Feed one frame. `t` is a timestamp in ms. Returns the next state; nothing is
 * counted while the needed body parts are not clearly visible.
 */
export function step(state: ScanState, lm: Point[] | undefined, t: number, aspect = 1): ScanState {
  const dt = state.lastT === null ? 0 : Math.min(t - state.lastT, 500);
  const base = { ...state, lastT: t };
  if (!lm || lm.length < 29) return { ...base, bodyVisible: false, inPosition: false };
  const s = side(lm);
  const P = (i: number) => lm[i];
  const ema = (v: number) => (state.smooth === null ? v : state.smooth * 0.5 + v * 0.5);

  switch (state.exerciseId) {
    case 'pushups': {
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
      return hysteresis({ ...base, bodyVisible: true, smooth: a }, a, 110, 160);
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
      const open = armsUp && feet > 1.4;
      const closed = armsDown && feet < 1.1;
      const v = open ? 0 : closed ? 180 : 90;
      return hysteresis({ ...base, bodyVisible: true, smooth: v }, v, 45, 135);
    }
    case 'pullups': {
      if (!visible(lm, [NOSE, L.wrist, R.wrist, s.elbow, s.shoulder])) return { ...base, bodyVisible: false };
      const handsUp = P(L.wrist).y < P(NOSE).y && P(R.wrist).y < P(NOSE).y;
      if (!handsUp) return { ...base, bodyVisible: true };
      const a = ema(angle(P(s.shoulder), P(s.elbow), P(s.wrist), aspect));
      // "down" here means pulled up (elbows bent); a rep completes when the arms straighten again
      return hysteresis({ ...base, bodyVisible: true, smooth: a }, a, 80, 145);
    }
    case 'plank': {
      if (!visible(lm, [s.shoulder, s.hip, s.ankle])) return { ...base, bodyVisible: false, inPosition: false };
      const straight = angle(P(s.shoulder), P(s.hip), P(s.ankle), aspect) > 155;
      const flat = tilt(P(s.shoulder), P(s.ankle), aspect) < 35;
      const ok = straight && flat;
      return { ...base, bodyVisible: true, inPosition: ok, holdMs: state.holdMs + (ok ? dt : 0) };
    }
    case 'wallsit': {
      if (!visible(lm, [s.hip, s.knee, s.ankle])) return { ...base, bodyVisible: false, inPosition: false };
      const k = angle(P(s.hip), P(s.knee), P(s.ankle), aspect);
      const ok = k > 70 && k < 120;
      return { ...base, bodyVisible: true, inPosition: ok, holdMs: state.holdMs + (ok ? dt : 0) };
    }
    default:
      return base;
  }
}

/** Progress in the exercise's own unit: reps, or whole seconds for holds. */
export const scanAmount = (s: ScanState) => (SCANNABLE[s.exerciseId]?.kind === 'hold' ? Math.floor(s.holdMs / 1000) : s.reps);
