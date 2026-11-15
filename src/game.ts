// Pure game logic: no React, no storage. Everything here is unit-tested.

export type Attr = 'staerke' | 'ausdauer' | 'beweglichkeit' | 'disziplin';
export type Difficulty = 1 | 2 | 3;

export const ATTR_LABEL: Record<Attr, string> = {
  staerke: 'Stärke',
  ausdauer: 'Ausdauer',
  beweglichkeit: 'Beweglichkeit',
  disziplin: 'Disziplin',
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  1: 'Einsteiger',
  2: 'Fortgeschritten',
  3: 'Profi',
};

export interface QuestTemplate {
  id: string;
  title: string;
  icon: string;
  attr: Exclude<Attr, 'disziplin'>;
  base: number; // amount at level 1, difficulty 2
  step: number; // amounts are rounded to multiples of this
  unit: string;
  xp: number;
}

export const QUEST_POOL: QuestTemplate[] = [
  { id: 'pushups', title: 'Liegestütze', icon: '💪', attr: 'staerke', base: 12, step: 1, unit: 'Wdh.', xp: 30 },
  { id: 'squats', title: 'Kniebeugen', icon: '🦵', attr: 'staerke', base: 20, step: 1, unit: 'Wdh.', xp: 30 },
  { id: 'lunges', title: 'Ausfallschritte', icon: '🚶', attr: 'staerke', base: 10, step: 1, unit: 'pro Bein', xp: 30 },
  { id: 'situps', title: 'Crunches', icon: '🔥', attr: 'staerke', base: 20, step: 1, unit: 'Wdh.', xp: 25 },
  { id: 'wallsit', title: 'Wandsitzen', icon: '🧱', attr: 'staerke', base: 40, step: 5, unit: 'Sek.', xp: 25 },
  { id: 'plank', title: 'Unterarmstütz', icon: '🪵', attr: 'ausdauer', base: 40, step: 5, unit: 'Sek.', xp: 30 },
  { id: 'run', title: 'Laufen', icon: '🏃', attr: 'ausdauer', base: 2, step: 0.5, unit: 'km', xp: 45 },
  { id: 'walk', title: 'Spaziergang', icon: '👟', attr: 'ausdauer', base: 20, step: 5, unit: 'Min.', xp: 25 },
  { id: 'jacks', title: 'Hampelmänner', icon: '⭐', attr: 'ausdauer', base: 40, step: 5, unit: 'Wdh.', xp: 25 },
  { id: 'burpees', title: 'Burpees', icon: '⚡', attr: 'ausdauer', base: 8, step: 1, unit: 'Wdh.', xp: 40 },
  { id: 'stairs', title: 'Treppen steigen', icon: '🪜', attr: 'ausdauer', base: 6, step: 1, unit: 'Stockwerke', xp: 30 },
  { id: 'stretch', title: 'Dehnen', icon: '🧘', attr: 'beweglichkeit', base: 8, step: 1, unit: 'Min.', xp: 25 },
  { id: 'mobility', title: 'Mobility-Routine', icon: '🌀', attr: 'beweglichkeit', base: 10, step: 1, unit: 'Min.', xp: 30 },
  { id: 'hips', title: 'Hüftöffner', icon: '🦋', attr: 'beweglichkeit', base: 5, step: 1, unit: 'Min.', xp: 20 },
];

export interface QuestInstance {
  id: string; // unique within the day
  templateId: string;
  title: string;
  icon: string;
  attr: Exclude<Attr, 'disziplin'>;
  amount: number;
  unit: string;
  xp: number;
  done: boolean;
}

export interface DayLog {
  date: string; // YYYY-MM-DD, local time
  quests: QuestInstance[];
  rerollsUsed: number;
}

export interface Profile {
  name: string;
  difficulty: Difficulty;
  seasonDays: number;
  startDate: string;
}

export interface GameState {
  version: 1;
  profile: Profile | null;
  days: Record<string, DayLog>;
}

export const QUESTS_PER_DAY = 4;
export const REROLLS_PER_DAY = 1;
export const DAY_CLEAR_BONUS = 50;

export const emptyState = (): GameState => ({ version: 1, profile: null, days: {} });

// ---------- dates ----------

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // noon avoids DST edge cases
}

export function addDays(key: string, n: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromDateKey(b).getTime() - fromDateKey(a).getTime()) / 86_400_000);
}

// ---------- levels ----------

/** XP needed to go from `level` to `level + 1`. */
export const xpToNext = (level: number) => 100 + 25 * (level - 1);

export function levelFromXp(totalXp: number) {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level);
    level++;
  }
  return { level, intoLevel: remaining, needed: xpToNext(level) };
}

const RANKS: [number, string][] = [
  [1, 'Neuling'],
  [5, 'Herausforderer'],
  [10, 'Kämpfer'],
  [15, 'Veteran'],
  [20, 'Elite'],
  [30, 'Champion'],
  [40, 'Legende'],
];

export function rankFor(level: number): string {
  let rank = RANKS[0][1];
  for (const [min, name] of RANKS) if (level >= min) rank = name;
  return rank;
}

// ---------- quest generation ----------

/** Deterministic PRNG so a day's quests are stable for a given seed. */
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

const DIFFICULTY_FACTOR: Record<Difficulty, number> = { 1: 0.6, 2: 1, 3: 1.5 };

/** Quests grow 5 % per level, capped at 2.5× the starting amount. */
export function scaleFactor(level: number, difficulty: Difficulty): number {
  const growth = Math.min(1 + 0.05 * (level - 1), 2.5);
  return growth * DIFFICULTY_FACTOR[difficulty];
}

export function scaledAmount(t: QuestTemplate, level: number, difficulty: Difficulty): number {
  const raw = t.base * scaleFactor(level, difficulty);
  const rounded = Math.round(raw / t.step) * t.step;
  return Math.max(t.step, Number(rounded.toFixed(1)));
}

function instantiate(t: QuestTemplate, level: number, difficulty: Difficulty, slot: number): QuestInstance {
  return {
    id: `${t.id}-${slot}`,
    templateId: t.id,
    title: t.title,
    icon: t.icon,
    attr: t.attr,
    amount: scaledAmount(t, level, difficulty),
    unit: t.unit,
    xp: t.xp,
    done: false,
  };
}

/** One quest per attribute plus one random extra, all different. */
export function generateDay(date: string, level: number, difficulty: Difficulty, seed = 0): DayLog {
  const rand = mulberry32(hash(date) + seed);
  const pick = (list: QuestTemplate[]) => list[Math.floor(rand() * list.length)];
  const chosen: QuestTemplate[] = [];
  for (const attr of ['staerke', 'ausdauer', 'beweglichkeit'] as const) {
    chosen.push(pick(QUEST_POOL.filter((q) => q.attr === attr)));
  }
  while (chosen.length < QUESTS_PER_DAY) {
    const q = pick(QUEST_POOL.filter((t) => !chosen.includes(t)));
    chosen.push(q);
  }
  return {
    date,
    quests: chosen.map((t, i) => instantiate(t, level, difficulty, i)),
    rerollsUsed: 0,
  };
}

/** Swap one quest for a different one of the same attribute (or any, if none left). */
export function rerollQuest(day: DayLog, questId: string, level: number, difficulty: Difficulty): DayLog {
  const idx = day.quests.findIndex((q) => q.id === questId);
  if (idx < 0 || day.quests[idx].done || day.rerollsUsed >= REROLLS_PER_DAY) return day;
  const used = new Set(day.quests.map((q) => q.templateId));
  const current = day.quests[idx];
  let options = QUEST_POOL.filter((t) => t.attr === current.attr && !used.has(t.id));
  if (options.length === 0) options = QUEST_POOL.filter((t) => !used.has(t.id));
  if (options.length === 0) return day;
  const rand = mulberry32(hash(day.date + questId) + day.rerollsUsed + 1);
  const t = options[Math.floor(rand() * options.length)];
  const quests = [...day.quests];
  quests[idx] = { ...instantiate(t, level, difficulty, idx), id: `${t.id}-${idx}-r${day.rerollsUsed + 1}` };
  return { ...day, quests, rerollsUsed: day.rerollsUsed + 1 };
}

// ---------- derived stats ----------

export const isCleared = (day: DayLog | undefined) =>
  !!day && day.quests.length > 0 && day.quests.every((q) => q.done);

export function totalXp(state: GameState): number {
  let xp = 0;
  for (const day of Object.values(state.days)) {
    for (const q of day.quests) if (q.done) xp += q.xp;
    if (isCleared(day)) xp += DAY_CLEAR_BONUS;
  }
  return xp;
}

export function attributes(state: GameState): Record<Attr, number> {
  const out: Record<Attr, number> = { staerke: 0, ausdauer: 0, beweglichkeit: 0, disziplin: 0 };
  for (const day of Object.values(state.days)) {
    for (const q of day.quests) if (q.done) out[q.attr] += 1;
    if (isCleared(day)) out.disziplin += 1;
  }
  return out;
}

/** Consecutive cleared days ending today (or yesterday, if today is still open). */
export function currentStreak(state: GameState, today: string): number {
  let cursor = isCleared(state.days[today]) ? today : addDays(today, -1);
  let streak = 0;
  while (isCleared(state.days[cursor])) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function bestStreak(state: GameState): number {
  const cleared = Object.keys(state.days).filter((k) => isCleared(state.days[k])).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of cleared) {
    run = prev && daysBetween(prev, k) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

export function questsDone(state: GameState): number {
  let n = 0;
  for (const day of Object.values(state.days)) n += day.quests.filter((q) => q.done).length;
  return n;
}

/** 1-based day of the season; may exceed seasonDays once the season is over. */
export const seasonDay = (profile: Profile, today: string) => daysBetween(profile.startDate, today) + 1;

// ---------- persistence helpers ----------

export function isGameState(x: unknown): x is GameState {
  if (!x || typeof x !== 'object') return false;
  const s = x as GameState;
  return s.version === 1 && typeof s.days === 'object' && s.days !== null && 'profile' in s;
}
