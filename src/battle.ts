// Enemies and bosses: pure logic, unit-tested.
import {
  QUEST_POOL,
  VARIANTS,
  addDays,
  battlePool,
  daysBetween,
  isUnlocked,
  scaleFactor,
  type Difficulty,
  type GameState,
  type QuestAttr,
  type QuestTemplate,
} from './game';
import { metricValue, phaseProof, type HealthMetric } from './proof';

export type MoveKind = 'exercise' | 'steps' | 'run';

export interface MoveSpec {
  kind: MoveKind;
  exerciseId?: string; // for kind 'exercise': id from QUEST_POOL
  base: number; // amount at level 1, difficulty 2
}

export interface EnemyTemplate {
  id: string;
  name: string;
  icon: string;
  taunt: string;
  attr: QuestAttr;
  moves: MoveSpec[];
}

const ex = (exerciseId: string, base: number): MoveSpec => ({ kind: 'exercise', exerciseId, base });
const steps = (base: number): MoveSpec => ({ kind: 'steps', base });
const run = (base: number): MoveSpec => ({ kind: 'run', base });

/** Everyday enemies: they personify bad habits and fall within one day. */
export const ENEMIES: EnemyTemplate[] = [
  { id: 'sofa-troll', name: 'Sofa-Troll', icon: '🧌', attr: 'staerke', taunt: 'Bleib doch noch ein bisschen sitzen …', moves: [ex('squats', 30)] },
  { id: 'snooze-gremlin', name: 'Snooze-Gremlin', icon: '👺', attr: 'ausdauer', taunt: 'Nur noch fünf Minuten.', moves: [ex('jacks', 50)] },
  { id: 'handy-zombie', name: 'Handy-Zombie', icon: '🧟', attr: 'ausdauer', taunt: 'Scroll weiter. Nur noch ein Video.', moves: [steps(6000)] },
  { id: 'ausreden-geist', name: 'Ausreden-Geist', icon: '👻', attr: 'beweglichkeit', taunt: 'Heute ist eh zu wenig Zeit.', moves: [ex('stretch', 10)] },
  { id: 'couch-krake', name: 'Couch-Krake', icon: '🐙', attr: 'staerke', taunt: 'Acht Arme halten dich fest.', moves: [ex('pushups', 15), ex('plank', 45)] },
  { id: 'chips-golem', name: 'Chips-Golem', icon: '🗿', attr: 'ausdauer', taunt: 'Knusper, knusper.', moves: [ex('burpees', 12)] },
  { id: 'serien-vampir', name: 'Serien-Vampir', icon: '🧛', attr: 'ausdauer', taunt: 'Nächste Folge startet in 5 Sekunden.', moves: [run(2)] },
  { id: 'faulpelz', name: 'Faulpelz', icon: '🦥', attr: 'beweglichkeit', taunt: 'Laaangsam. Ganz laaangsam.', moves: [ex('mobility', 8), steps(4000)] },
  { id: 'zucker-kobold', name: 'Zucker-Kobold', icon: '🍬', attr: 'staerke', taunt: 'Ein Riegel geht noch.', moves: [ex('lunges', 12), ex('wallsit', 45)] },
];

/** Weekly bosses: three phases, Monday to Sunday (plus a steps phase if they have none, see bossMoves). */
export const BOSSES: EnemyTemplate[] = [
  { id: 'schweinehund', name: 'Der innere Schweinehund', icon: '🐗', attr: 'staerke', taunt: 'Ich kenne all deine Ausreden.', moves: [ex('pushups', 80), steps(40000), ex('plank', 180)] },
  { id: 'montags-monster', name: 'Das Montags-Monster', icon: '👹', attr: 'ausdauer', taunt: 'Die Woche gehört mir.', moves: [ex('squats', 150), run(5), ex('stretch', 30)] },
  { id: 'aufschiebe-drache', name: 'Der Aufschiebe-Drache', icon: '🐉', attr: 'ausdauer', taunt: 'Morgen. Immer erst morgen.', moves: [ex('burpees', 50), steps(50000), ex('mobility', 30)] },
  { id: 'winterschlaf-baer', name: 'Der Winterschlaf-Bär', icon: '🐻', attr: 'staerke', taunt: 'Draußen ist es viel zu kalt.', moves: [ex('lunges', 80), ex('stairs', 30), ex('wallsit', 300)] },
  { id: 'ausreden-hydra', name: 'Die Ausreden-Hydra', icon: '🐍', attr: 'beweglichkeit', taunt: 'Schlag einen Kopf ab, zwei wachsen nach.', moves: [ex('pushups', 60), ex('jacks', 200), ex('hips', 20)] },
];

export interface LogEntry {
  date: string;
  amount: number;
}

export interface BattlePhase {
  id: string;
  kind: MoveKind;
  exerciseId?: string;
  title: string;
  icon: string;
  unit: string;
  target: number;
  log: LogEntry[];
  easy?: boolean; // easier variant (title from VARIANTS); missing = normal
}

export interface Battle {
  id: string;
  enemyId: string;
  name: string;
  icon: string;
  taunt: string;
  attr: QuestAttr;
  boss: boolean;
  elite: boolean;
  start: string;
  end: string; // inclusive
  xp: number;
  phases: BattlePhase[];
  defeatedOn?: string;
}

/** Per-day data synced from Health Connect (Samsung Health). */
export interface HealthDay {
  steps: number;
  runKm: number;
  // Added later: missing in old saves (normalize fills 0), read with metricValue().
  bikeMin?: number; // cycling workouts, minutes
  swimMin?: number; // swimming workouts, minutes
  floors?: number; // floors climbed
  strengthMin?: number; // strength workouts, minutes
}

// ---------- generation ----------

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const DIFF_ONLY: Record<Difficulty, number> = { 1: 0.6, 2: 1, 3: 1.5 };

const roundTo = (v: number, step: number) => Math.max(step, Number((Math.round(v / step) * step).toFixed(1)));

/** Exercises of `pool` the player's level allows (see EXERCISE_MIN_LEVEL). Locked ones are swapped like missing equipment. */
const unlockedAt = (pool: QuestTemplate[], level: number) => pool.filter((q) => isUnlocked(q, level));

/**
 * Swap moves the player cannot do (missing equipment, switched off) for a possible
 * exercise of the same attribute, keeping the same relative effort.
 */
function adaptMove(move: MoveSpec, attr: QuestAttr, pool: QuestTemplate[], rand: () => number): MoveSpec {
  if (move.kind === 'steps') return move;
  const wanted = move.kind === 'run' ? 'run' : move.exerciseId!;
  if (pool.some((q) => q.id === wanted)) return move;
  const original = QUEST_POOL.find((q) => q.id === wanted)!;
  let options = pool.filter((q) => q.attr === original.attr && !q.custom);
  if (options.length === 0) options = pool.filter((q) => q.attr === attr && !q.custom);
  if (options.length === 0) options = pool.filter((q) => !q.custom);
  if (options.length === 0) return move;
  const t = options[Math.floor(rand() * options.length)];
  if (t.id === 'run') return { kind: 'run', base: (move.base / original.base) * t.base };
  return { kind: 'exercise', exerciseId: t.id, base: (move.base / original.base) * t.base };
}

function makePhase(move: MoveSpec, level: number, difficulty: Difficulty, factor: number, idx: number, easy = false): BattlePhase {
  if (move.kind === 'steps') {
    // Steps and distance scale with difficulty only: level-based growth would get unrealistic.
    return { id: `p${idx}`, kind: 'steps', title: 'Schritte', icon: '👣', unit: 'Schritte', target: roundTo(move.base * DIFF_ONLY[difficulty] * factor, 500), log: [] };
  }
  if (move.kind === 'run') {
    return { id: `p${idx}`, kind: 'run', title: 'Laufen', icon: '🏃', unit: 'km', target: roundTo(move.base * DIFF_ONLY[difficulty] * factor, 0.5), log: [] };
  }
  const t = QUEST_POOL.find((q) => q.id === move.exerciseId)!;
  const variant = easy ? VARIANTS[t.id] : undefined;
  return {
    id: `p${idx}`,
    kind: 'exercise',
    exerciseId: t.id,
    title: variant ?? t.title,
    icon: t.icon,
    unit: t.unit,
    target: roundTo(move.base * scaleFactor(level, difficulty) * factor, t.step),
    log: [],
    ...(variant ? { easy: true } : {}),
  };
}

/** Today's everyday enemy. Roughly one in five is an elite with more HP and more XP. */
export const ENEMIES_PER_DAY = 3;
/** Later enemies of the same day give a bit less XP. */
const WAVE_XP = [1, 0.8, 0.6];

export const enemyId = (date: string, wave: number) => (wave === 1 ? `enemy-${date}` : `enemy-${date}-${wave}`);

/** The day's enemies in order (up to three waves; the next appears once the previous falls). */
export const enemiesOf = (battles: Battle[], date: string) =>
  [1, 2, 3].map((w) => battles.find((b) => b.id === enemyId(date, w))).filter((b): b is Battle => !!b);

/** The enemy to show today: the first one still standing, else the last one beaten. */
export function currentEnemy(battles: Battle[], date: string): Battle | undefined {
  const list = enemiesOf(battles, date);
  return list.find((b) => !b.defeatedOn) ?? list[list.length - 1];
}

export function generateEnemy(
  date: string,
  level: number,
  difficulty: Difficulty,
  pool: QuestTemplate[] = QUEST_POOL,
  wave = 1,
  avoid: string[] = [],
  easy = false,
): Battle {
  const rand = mulberry32(hash('enemy' + date + (wave > 1 ? `#${wave}` : '')));
  let idx = Math.floor(rand() * ENEMIES.length);
  // a new wave never repeats a monster already met today
  while (avoid.includes(ENEMIES[idx].id)) idx = (idx + 1) % ENEMIES.length;
  const e = ENEMIES[idx];
  const elite = rand() < 0.2;
  const factor = elite ? 1.5 : 1;
  return {
    id: enemyId(date, wave),
    enemyId: e.id,
    name: e.name,
    icon: e.icon,
    taunt: e.taunt,
    attr: e.attr,
    boss: false,
    elite,
    start: date,
    end: date,
    xp: Math.round((40 + 4 * level) * (elite ? 1.6 : 1) * WAVE_XP[wave - 1]),
    phases: e.moves.map((m, i) => makePhase(adaptMove(m, e.attr, unlockedAt(pool, level), rand), level, difficulty, factor, i, easy)),
  };
}

/** Monday of the week that contains `date`. */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = (new Date(y, m - 1, d, 12).getDay() + 6) % 7; // 0 = Monday
  return addDays(date, -weekday);
}

/** A boss appears when at least 4 days of its week are left (Monday to Thursday). */
export function bossAvailable(date: string): boolean {
  return daysBetween(date, addDays(weekStart(date), 6)) >= 3;
}

/** Steps per week for the extra steps phase of bosses without one (difficulty 2). */
export const BOSS_STEPS_BASE = 35000;

/**
 * A boss's moves for a new fight: every boss has exactly one steps phase (Samsung Health
 * proof). Bosses without one get it appended as an extra phase.
 */
export function bossMoves(b: EnemyTemplate): MoveSpec[] {
  return b.moves.some((m) => m.kind === 'steps') ? b.moves : [...b.moves, steps(BOSS_STEPS_BASE)];
}

export function generateBoss(
  date: string,
  level: number,
  difficulty: Difficulty,
  pool: QuestTemplate[] = QUEST_POOL,
  easy = false,
): Battle {
  const start = weekStart(date);
  const rand = mulberry32(hash('boss' + start));
  const b = BOSSES[Math.floor(rand() * BOSSES.length)];
  return {
    id: `boss-${start}`,
    enemyId: b.id,
    name: b.name,
    icon: b.icon,
    taunt: b.taunt,
    attr: b.attr,
    boss: true,
    elite: false,
    start: date,
    end: addDays(start, 6),
    xp: 200 + 15 * level,
    phases: dedupe(bossMoves(b).map((m) => adaptMove(m, b.attr, unlockedAt(pool, level), rand))).map((m, i) => makePhase(m, level, difficulty, 1, i, easy)),
  };
}

/** Two phases with the same exercise (after swapping) merge into one bigger phase. */
function dedupe(moves: MoveSpec[]): MoveSpec[] {
  const out: MoveSpec[] = [];
  for (const m of moves) {
    const same = out.find((o) => o.kind === m.kind && o.exerciseId === m.exerciseId);
    if (same) same.base += m.base;
    else out.push({ ...m });
  }
  return out;
}

// ---------- progress ----------

const inWindow = (b: Battle, date: string) => date >= b.start && date <= b.end;

/** The synced metric a phase is proven by (steps, runs, and health-proof exercises like cycling), or null. */
export function phaseMetric(p: BattlePhase): HealthMetric | null {
  const proof = phaseProof(p);
  return proof.kind === 'health' ? proof.metric : null;
}

/** Health-backed phases read from synced data when connected, otherwise from manual entries. */
export function phaseProgress(b: Battle, p: BattlePhase, health: Record<string, HealthDay> | null): number {
  const metric = health ? phaseMetric(p) : null;
  if (health && metric) {
    let sum = 0;
    for (const [date, h] of Object.entries(health)) {
      if (inWindow(b, date)) sum += metricValue(h, metric);
    }
    return Number(sum.toFixed(2));
  }
  return Number(p.log.reduce((s, l) => s + l.amount, 0).toFixed(2));
}

export const isComplete = (b: Battle, health: Record<string, HealthDay> | null) =>
  b.phases.every((p) => phaseProgress(b, p, health) >= p.target);

/** Remaining HP as a share between 0 and 1. */
export function hpLeft(b: Battle, health: Record<string, HealthDay> | null): number {
  const done = b.phases.reduce((s, p) => s + Math.min(phaseProgress(b, p, health) / p.target, 1), 0);
  return 1 - done / b.phases.length;
}

export type BattleStatus = 'active' | 'defeated' | 'escaped';

export function battleStatus(b: Battle, today: string): BattleStatus {
  if (b.defeatedOn) return 'defeated';
  return today > b.end ? 'escaped' : 'active';
}

export function logDamage(b: Battle, phaseId: string, date: string, amount: number): Battle {
  if (!inWindow(b, date) || amount === 0) return b;
  return {
    ...b,
    phases: b.phases.map((p) => (p.id === phaseId ? { ...p, log: [...p.log, { date, amount }] } : p)),
  };
}

export function undoDamage(b: Battle, phaseId: string, date: string): Battle {
  return {
    ...b,
    phases: b.phases.map((p) => {
      if (p.id !== phaseId) return p;
      const idx = p.log.map((l) => l.date).lastIndexOf(date);
      return idx < 0 ? p : { ...p, log: p.log.filter((_, i) => i !== idx) };
    }),
  };
}

/** Ensure today's enemy and this week's boss exist. Returns the same object if nothing changed. */
export function ensureBattles(state: GameState, today: string, level: number): GameState {
  if (!state.profile) return state;
  const add: Battle[] = [];
  const has = (id: string) => state.battles.some((b) => b.id === id);
  const pool = battlePool(state, level);
  const easy = !!state.profile.easyVariants;
  const todays = enemiesOf(state.battles, today);
  if (todays.length === 0) {
    add.push(generateEnemy(today, level, state.profile.difficulty, pool, 1, [], easy));
  } else {
    const last = todays[todays.length - 1];
    const wave = todays.length + 1;
    if (last.defeatedOn && wave <= ENEMIES_PER_DAY && !has(enemyId(today, wave))) {
      add.push(generateEnemy(today, level, state.profile.difficulty, pool, wave, todays.map((b) => b.enemyId), easy));
    }
  }
  if (bossAvailable(today) && !has(`boss-${weekStart(today)}`)) add.push(generateBoss(today, level, state.profile.difficulty, pool, easy));
  return add.length ? { ...state, battles: [...state.battles, ...add] } : state;
}

/**
 * Stamp or clear `defeatedOn` so XP is counted exactly once and follows undo.
 * Only battles that are still running (or were won) can change.
 */
export function settleBattles(state: GameState, today: string): GameState {
  const health = state.health.connected ? state.health.days : null;
  let changed = false;
  const battles = state.battles.map((b) => {
    const done = isComplete(b, health);
    if (done && !b.defeatedOn) {
      changed = true;
      return { ...b, defeatedOn: today };
    }
    if (!done && b.defeatedOn) {
      changed = true;
      const { defeatedOn: _, ...rest } = b;
      return rest;
    }
    return b;
  });
  return changed ? { ...state, battles } : state;
}

export const defeated = (state: GameState) => state.battles.filter((b) => b.defeatedOn);
