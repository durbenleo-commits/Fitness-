// Mastery ("Meisterschaft"): how well the player knows each built-in exercise, and which
// exercises that unlocks. Pure functions over the saved days, so past progress counts too.
import type { DayLog } from './game';

/** Mastery points from which a tier ("Stufe") is reached: index 0 = Stufe 1. */
export const MASTERY_TIERS = [3, 10, 25] as const;
export const MAX_TIER = MASTERY_TIERS.length;
/** A done quest of the easier variant counts this much (a normal one counts 1). */
export const EASY_MASTERY = 0.5;

export interface Requirement {
  id: string; // exercise template id
  tier: number; // Stufe needed
}

/**
 * What an exercise needs before it comes up as an extra or in the arena: every listed
 * exercise at the given Stufe. Exercises not listed are free from the start.
 */
export const PREREQUISITES: Record<string, Requirement[]> = {
  dips: [{ id: 'pushups', tier: 2 }],
  diamond: [{ id: 'pushups', tier: 2 }],
  pike: [{ id: 'diamond', tier: 2 }],
  handstand: [
    { id: 'pike', tier: 3 },
    { id: 'plank', tier: 3 },
  ],
  jumpsquats: [{ id: 'squats', tier: 2 }],
  splitsquat: [{ id: 'lunges', tier: 2 }],
  pistol: [{ id: 'splitsquat', tier: 3 }],
  hollow: [{ id: 'legraises', tier: 2 }],
  lsit: [
    { id: 'hollow', tier: 3 },
    { id: 'dips', tier: 2 },
  ],
  sideplank: [{ id: 'plank', tier: 1 }],
  chinups: [{ id: 'pullups', tier: 1 }],
  kneeraises: [
    { id: 'pullups', tier: 2 },
    { id: 'legraises', tier: 2 },
  ],
};

/** Exercises with prerequisites (the ones that can be locked). */
export const GATED_IDS = Object.keys(PREREQUISITES);

export type MasteryPoints = Record<string, number>;

/** Mastery with every prerequisite at the top Stufe: nothing locked (for tests and previews). */
export const ALL_MASTERED: MasteryPoints = Object.fromEntries(
  Object.values(PREREQUISITES).flatMap((rs) => rs.map((r) => [r.id, 25])),
);

/** Mastery points per template id: every done quest counts 1, the easier variant 0.5. Arena hits do not count. */
export function masteryPoints(days: Record<string, DayLog>): MasteryPoints {
  const pts: MasteryPoints = {};
  for (const day of Object.values(days)) {
    for (const q of day.quests) {
      if (!q.done) continue;
      pts[q.templateId] = (pts[q.templateId] ?? 0) + (q.easy ? EASY_MASTERY : 1);
    }
  }
  return pts;
}

/** Stufe for a number of points (0 = no tier yet). */
export function tierFor(points: number): number {
  let tier = 0;
  for (const need of MASTERY_TIERS) if (points >= need) tier++;
  return tier;
}

/** Points needed for a Stufe (0 for Stufe 0). */
export const pointsForTier = (tier: number) => (tier <= 0 ? 0 : MASTERY_TIERS[Math.min(tier, MAX_TIER) - 1]);

export interface MasteryInfo {
  points: number;
  tier: number;
  /** Points needed for the next Stufe, or null at the top. */
  next: number | null;
}

export function masteryOf(points: MasteryPoints, id: string): MasteryInfo {
  const p = points[id] ?? 0;
  const tier = tierFor(p);
  return { points: p, tier, next: tier < MAX_TIER ? MASTERY_TIERS[tier] : null };
}

/** Whether one requirement is met. */
export const requirementMet = (points: MasteryPoints, r: Requirement) => tierFor(points[r.id] ?? 0) >= r.tier;

/** Requirements of an exercise that are not met yet (empty = unlocked). */
export const unmetRequirements = (points: MasteryPoints, id: string): Requirement[] =>
  (PREREQUISITES[id] ?? []).filter((r) => !requirementMet(points, r));

/** Whether the exercise may come up as an extra / in the arena. Exercises without prerequisites always may. */
export const isUnlocked = (points: MasteryPoints, id: string) => unmetRequirements(points, id).length === 0;

/** Gated exercises whose prerequisites are all met. */
export const unlockedGatedIds = (points: MasteryPoints) => GATED_IDS.filter((id) => isUnlocked(points, id));

/**
 * Exercises to train for a goal, best first: for each unmet requirement the exercise itself
 * when it is unlocked, otherwise (a chain) the requirements of that one, deepest first.
 * `skip` leaves out exercises that come anyway (core quests); `open` says whether an exercise may
 * come up now (default: its prerequisites are met; game.ts also checks the level). Empty when
 * the goal's prerequisites are met.
 */
export function trainingSteps(
  points: MasteryPoints,
  goal: string,
  skip: (id: string) => boolean = () => false,
  open: (id: string) => boolean = (id) => isUnlocked(points, id),
): string[] {
  const found: { id: string; depth: number }[] = [];
  const seen = new Set<string>();
  const visit = (id: string, depth: number) => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const r of unmetRequirements(points, id)) {
      if (open(r.id)) {
        if (!skip(r.id) && !found.some((f) => f.id === r.id)) found.push({ id: r.id, depth });
      } else visit(r.id, depth + 1);
    }
  };
  visit(goal, 0);
  // stable sort: deepest first, otherwise the order of the table
  return found.map((f, i) => ({ ...f, i })).sort((a, b) => b.depth - a.depth || a.i - b.i).map((f) => f.id);
}

/**
 * The skill paths shown on the Meisterschaft screen: exercises grouped by movement, easiest
 * first, so the steps towards the hard ones read top to bottom. Display only, no rules.
 */
export const SKILL_PATHS: { id: string; title: string; line: string; ids: string[] }[] = [
  { id: 'push', title: 'Drücken', line: 'Von Liegestützen bis zum Handstand', ids: ['pushups', 'dips', 'diamond', 'pike', 'handstand'] },
  { id: 'legs', title: 'Beine', line: 'Von Kniebeugen bis zur Pistol Squat', ids: ['squats', 'jumpsquats', 'lunges', 'splitsquat', 'pistol'] },
  { id: 'core', title: 'Rumpf', line: 'Vom Unterarmstütz bis zum L-Sitz', ids: ['plank', 'sideplank', 'legraises', 'hollow', 'lsit'] },
  { id: 'pull', title: 'Ziehen', line: 'An der Klimmzugstange', ids: ['pullups', 'chinups', 'kneeraises'] },
];
