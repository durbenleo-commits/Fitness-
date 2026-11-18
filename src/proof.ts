// What counts as proof that a quest (or an arena move) was really done. Pure logic.
// No value imports from game.ts, so game.ts can use this module without an import cycle.
import type { BattlePhase, HealthDay } from './battle';
import type { QuestTemplate } from './game';

export type HealthMetric = 'steps' | 'runKm' | 'bikeMin' | 'swimMin' | 'floors' | 'strengthMin';

export type Proof =
  | { kind: 'health'; metric: HealthMetric }
  // Pose counter counts reps or holds (ids from SCANNABLE in pose.ts). `seconds` is set when the
  // quest is in minutes but the scan counts seconds (the stretch routine): then that is the target.
  // `reps`/`perUnit` are set when the camera counts more than the quest amount: lunges are "pro Bein",
  // the detector counts every lunge on either leg, so 10 pro Bein = 20 counted (perUnit 2).
  | { kind: 'camera'; scanId: string; seconds?: number; reps?: number; perUnit?: number }
  | { kind: 'presence'; seconds: number } // timer that only runs while the camera sees the person
  | { kind: 'photo' }; // reading: log the page reached with a photo of it (reading.ts logPages)

export type ProofKind = Proof['kind'];

type BuiltInProof =
  | { kind: 'health'; metric: HealthMetric }
  | { kind: 'camera'; scanId?: string } // scanId defaults to the exercise id
  | { kind: 'presence' }
  | { kind: 'photo' };

/** Proof for every built-in exercise in QUEST_POOL (game.ts). */
export const BUILT_IN_PROOF: Record<string, BuiltInProof> = {
  // synced from Health Connect
  steps: { kind: 'health', metric: 'steps' },
  run: { kind: 'health', metric: 'runKm' },
  bike: { kind: 'health', metric: 'bikeMin' },
  swim: { kind: 'health', metric: 'swimMin' },
  stairs: { kind: 'health', metric: 'floors' },
  gym: { kind: 'health', metric: 'strengthMin' },
  // counted by the camera
  pushups: { kind: 'camera' },
  squats: { kind: 'camera' },
  lunges: { kind: 'camera' },
  jacks: { kind: 'camera' },
  pullups: { kind: 'camera' },
  plank: { kind: 'camera' },
  wallsit: { kind: 'camera' },
  situps: { kind: 'camera' },
  curls: { kind: 'camera' },
  press: { kind: 'camera' },
  rows: { kind: 'camera' },
  swings: { kind: 'camera' },
  burpees: { kind: 'camera' },
  mountain: { kind: 'camera' },
  // calisthenics (pose detection in pose.ts, ids as here)
  dips: { kind: 'camera' },
  pike: { kind: 'camera' },
  diamond: { kind: 'camera' },
  bridge: { kind: 'camera' },
  legraises: { kind: 'camera' },
  hollow: { kind: 'camera' },
  sideplank: { kind: 'camera' },
  superman: { kind: 'camera' },
  splitsquat: { kind: 'camera' },
  pistol: { kind: 'camera' },
  jumpsquats: { kind: 'camera' },
  handstand: { kind: 'camera' },
  chinups: { kind: 'camera' },
  kneeraises: { kind: 'camera' },
  lsit: { kind: 'camera' },
  calves: { kind: 'camera' },
  // stretch routine: poses held in front of the camera (quests in minutes, scan in seconds)
  stretch: { kind: 'camera', scanId: 'stretch' },
  mobility: { kind: 'camera', scanId: 'stretch' },
  hips: { kind: 'camera', scanId: 'stretch' },
  bandstretch: { kind: 'camera', scanId: 'stretch' },
  // reading: page photo
  read: { kind: 'photo' },
  // timer while the camera sees the player (all in minutes)
  rope: { kind: 'presence' },
  walk: { kind: 'presence' }, // retired, still on old days
};

/**
 * Camera exercises that are "pro Bein" but counted on either leg: the camera target is doubled
 * (10 pro Bein = 20 counted).
 */
export const PER_LEG_SCANS: readonly string[] = ['lunges', 'splitsquat', 'pistol'];

/** Seconds of presence per unit for custom quests (and unknown units). */
const PRESENCE_SECONDS_PER_UNIT: Record<string, number> = {
  'Min.': 60,
  'Sek.': 1,
  'Wdh.': 3,
  'Sätze': 60,
};

const presence = (seconds: number): Proof => ({ kind: 'presence', seconds: Math.max(1, Math.round(seconds)) });

/** Custom quests (and anything unknown) are judged by their unit. */
function proofByUnit(unit: string, amount: number): Proof {
  if (unit === 'Schritte') return { kind: 'health', metric: 'steps' };
  if (unit === 'km') return { kind: 'health', metric: 'runKm' };
  return presence(amount * (PRESENCE_SECONDS_PER_UNIT[unit] ?? 60));
}

/** How a quest has to be proven. `amount` is what the quest (or the remaining arena move) asks for. */
export function proofFor(q: { templateId: string; unit: string; amount: number }, customQuests: QuestTemplate[] = []): Proof {
  const custom = customQuests.find((t) => t.id === q.templateId && t.custom);
  const builtIn = custom ? undefined : BUILT_IN_PROOF[q.templateId];
  if (!builtIn) return proofByUnit(custom?.unit ?? q.unit, q.amount);
  if (builtIn.kind === 'health') return builtIn;
  if (builtIn.kind === 'photo') return builtIn;
  if (builtIn.kind === 'camera') {
    const scanId = builtIn.scanId ?? q.templateId;
    // the stretch routine counts seconds, its quests are in minutes
    if (scanId === 'stretch') return { kind: 'camera', scanId, seconds: Math.max(1, Math.round(q.unit === 'Sek.' ? q.amount : q.amount * 60)) };
    // lunges (split squats, pistols) are counted on both legs: "pro Bein" means the camera target is doubled
    if (PER_LEG_SCANS.includes(scanId) && q.unit === 'pro Bein') return { kind: 'camera', scanId, reps: Math.max(1, Math.ceil(q.amount * 2)), perUnit: 2 };
    return { kind: 'camera', scanId };
  }
  // built-in presence exercises are all measured in minutes
  return presence(q.unit === 'Sek.' ? q.amount : q.amount * 60);
}

/** Proof for an arena move. Steps and run moves are always health; `amount` defaults to the full target. */
export function phaseProof(p: Pick<BattlePhase, 'kind' | 'exerciseId' | 'unit' | 'target'>, amount: number = p.target): Proof {
  if (p.kind === 'steps') return { kind: 'health', metric: 'steps' };
  if (p.kind === 'run') return { kind: 'health', metric: 'runKm' };
  return proofFor({ templateId: p.exerciseId ?? '', unit: p.unit, amount });
}

/** What the scanner has to count for a camera proof: seconds, counted reps, or the plain amount. */
export function scanTarget(proof: Extract<Proof, { kind: 'camera' }>, amount: number): number {
  return proof.seconds ?? proof.reps ?? Math.max(1, Math.ceil(amount));
}

/** Convert a scanner count back to the quest's own unit (20 counted lunges = 10 pro Bein). */
export function scanToAmount(proof: Pick<Extract<Proof, { kind: 'camera' }>, 'perUnit'>, counted: number): number {
  return counted / (proof.perUnit ?? 1);
}

type QuestLike = { templateId: string; unit: string; amount: number };

/**
 * The normal (1×) target of a quest in the units its proof measures: counted reps or seconds
 * for the camera (same as scanTarget), seconds for a presence timer, the amount itself for
 * health data (quest unit) and reading (pages).
 */
export function questTarget(q: QuestLike, customQuests: QuestTemplate[] = []): number {
  const p = proofFor(q, customQuests);
  if (p.kind === 'camera') return scanTarget(p, q.amount);
  if (p.kind === 'presence') return p.seconds;
  return q.amount;
}

/**
 * The most that counts for a quest (2× its amount), in the same units as questTarget. The UI
 * lets the scanner run on up to this value. Lunges "pro Bein": 10 pro Bein = 20 counted, max 40.
 */
export function questMaxTarget(q: QuestLike, customQuests: QuestTemplate[] = []): number {
  return questTarget(q, customQuests) * 2;
}

/**
 * Convert what the scanner counted (reps or seconds, as for questTarget) back to the quest's
 * own unit, e.g. 40 counted lunges = 20 pro Bein, 960 s of stretching = 16 Min. Not clamped:
 * completeQuest clamps the result to amount..2×amount.
 */
export function scanToAchieved(q: QuestLike, counted: number, customQuests: QuestTemplate[] = []): number {
  const p = proofFor(q, customQuests);
  if (!Number.isFinite(counted) || counted <= 0) return 0;
  if (p.kind === 'camera' && p.seconds === undefined) return Number(scanToAmount(p, counted).toFixed(2));
  if (p.kind === 'health' || p.kind === 'photo') return counted;
  const target = questTarget(q, customQuests);
  return Number(((q.amount * counted) / target).toFixed(2));
}

/** One synced value for a day; fields missing in old saves count as 0. */
export function metricValue(h: HealthDay | undefined, metric: HealthMetric): number {
  return h ? (h[metric] ?? 0) : 0;
}

/**
 * The health value already reached on `date` for this quest, or null when the
 * quest is not proven by health data.
 */
export function healthProgress(
  q: { templateId: string; unit: string; amount: number },
  healthDays: Record<string, HealthDay>,
  date: string,
  customQuests: QuestTemplate[] = [],
): number | null {
  const p = proofFor(q, customQuests);
  if (p.kind !== 'health') return null;
  return metricValue(healthDays[date], p.metric);
}
