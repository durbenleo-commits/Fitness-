// Pure game logic: no React, no storage. Everything here is unit-tested.
import type { Battle, HealthDay } from './battle';
import { metricValue, proofFor } from './proof';
import type { Book } from './reading';
import type { IconName } from './views/Icons';

export type Attr = 'staerke' | 'ausdauer' | 'beweglichkeit' | 'intelligenz' | 'disziplin';
export type QuestAttr = Exclude<Attr, 'disziplin'>;
export type Difficulty = 1 | 2 | 3;

export const ATTR_LABEL: Record<Attr, string> = {
  staerke: 'Stärke',
  ausdauer: 'Ausdauer',
  beweglichkeit: 'Beweglichkeit',
  intelligenz: 'Intelligenz',
  disziplin: 'Disziplin',
};

/** Physical attributes: random quests are drawn from these. Intelligenz only comes from reading. */
export const QUEST_ATTRS: QuestAttr[] = ['staerke', 'ausdauer', 'beweglichkeit'];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  1: 'Einsteiger',
  2: 'Fortgeschritten',
  3: 'Profi',
};

export interface QuestTemplate {
  id: string;
  title: string;
  icon: string;
  attr: QuestAttr;
  base: number; // built-in: amount at level 1, difficulty 2. Custom: the exact amount.
  step: number; // amounts are rounded to multiples of this
  unit: string;
  xp: number;
  custom?: boolean; // made by the player; amount never scales
  daily?: boolean; // custom only: appears every day as an extra quest
  noLevelScale?: boolean; // grows with difficulty only, not with level
  requires?: Equipment[]; // needs at least one of these
  jump?: boolean; // involves jumping (left out with "no jumping")
  fixed?: boolean; // appears every day
  retired?: boolean; // no longer handed out
}

export type Equipment =
  | 'outdoor'
  | 'stairs'
  | 'treadmill'
  | 'dumbbells'
  | 'kettlebell'
  | 'bar'
  | 'band'
  | 'rope'
  | 'bike'
  | 'pool'
  | 'gym';

export const EQUIPMENT: { id: Equipment; label: string; icon: IconName }[] = [
  { id: 'outdoor', label: 'Draußen laufen und gehen', icon: 'tree' },
  { id: 'stairs', label: 'Treppen', icon: 'stairs' },
  { id: 'dumbbells', label: 'Kurzhanteln', icon: 'staerke' },
  { id: 'kettlebell', label: 'Kugelhantel', icon: 'kettlebell' },
  { id: 'bar', label: 'Klimmzugstange', icon: 'bar' },
  { id: 'band', label: 'Widerstandsband', icon: 'band' },
  { id: 'rope', label: 'Springseil', icon: 'rope' },
  { id: 'bike', label: 'Fahrrad oder Heimtrainer', icon: 'bike' },
  { id: 'treadmill', label: 'Laufband', icon: 'treadmill' },
  { id: 'pool', label: 'Schwimmbad', icon: 'pool' },
  { id: 'gym', label: 'Fitnessstudio', icon: 'gym' },
];

/** A gym has all the smaller gear too. */
const GYM_INCLUDES: Equipment[] = ['dumbbells', 'kettlebell', 'bar', 'band', 'rope', 'bike', 'treadmill'];
export const DEFAULT_EQUIPMENT: Equipment[] = ['outdoor', 'stairs'];

export function hasEquipment(profile: Profile | null | undefined, eq: Equipment): boolean {
  const list = profile?.equipment ?? DEFAULT_EQUIPMENT;
  return list.includes(eq) || (list.includes('gym') && GYM_INCLUDES.includes(eq));
}

/** Why a built-in exercise is not possible right now, or null if it is. */
export function unavailableReason(t: QuestTemplate, profile: Profile | null | undefined): string | null {
  if (t.jump && profile?.noJumping) return 'Sprungübung';
  if (t.requires && !t.requires.some((eq) => hasEquipment(profile, eq))) {
    return 'Braucht ' + t.requires.map((eq) => EQUIPMENT.find((e) => e.id === eq)!.label).join(' oder ');
  }
  return null;
}

export const QUEST_POOL: QuestTemplate[] = [
  { id: 'pushups', title: 'Liegestütze', icon: '💪', attr: 'staerke', base: 12, step: 1, unit: 'Wdh.', xp: 30 },
  { id: 'squats', title: 'Kniebeugen', icon: '🦵', attr: 'staerke', base: 20, step: 1, unit: 'Wdh.', xp: 30 },
  { id: 'lunges', title: 'Ausfallschritte', icon: '🚶', attr: 'staerke', base: 10, step: 1, unit: 'pro Bein', xp: 30 },
  { id: 'situps', title: 'Bauchpressen', icon: '🔥', attr: 'staerke', base: 20, step: 1, unit: 'Wdh.', xp: 25 },
  { id: 'wallsit', title: 'Wandsitzen', icon: '🧱', attr: 'staerke', base: 40, step: 5, unit: 'Sek.', xp: 25 },
  { id: 'plank', title: 'Unterarmstütz', icon: '🪵', attr: 'ausdauer', base: 40, step: 5, unit: 'Sek.', xp: 30 },
  { id: 'run', title: 'Laufen', icon: '🏃', attr: 'ausdauer', base: 2, step: 0.5, unit: 'km', xp: 45, requires: ['outdoor', 'treadmill'] },
  // Retired: the daily step quest replaces it. Kept so old days still show its name.
  { id: 'walk', title: 'Spaziergang', icon: '👟', attr: 'ausdauer', base: 20, step: 5, unit: 'Min.', xp: 25, requires: ['outdoor', 'treadmill'], retired: true },
  { id: 'jacks', title: 'Hampelmänner', icon: '⭐', attr: 'ausdauer', base: 40, step: 5, unit: 'Wdh.', xp: 25, jump: true },
  { id: 'burpees', title: 'Hockstrecksprünge', icon: '⚡', attr: 'ausdauer', base: 8, step: 1, unit: 'Wdh.', xp: 40, jump: true },
  { id: 'mountain', title: 'Bergsteiger', icon: '⛰️', attr: 'ausdauer', base: 30, step: 5, unit: 'Wdh.', xp: 30 },
  // Fixed: part of every day, never drawn at random or swapped.
  { id: 'steps', title: 'Schritte', icon: '👣', attr: 'ausdauer', base: 7000, step: 500, unit: 'Schritte', xp: 30, noLevelScale: true, fixed: true },
  { id: 'stairs', title: 'Treppen steigen', icon: '🪜', attr: 'ausdauer', base: 6, step: 1, unit: 'Stockwerke', xp: 30, requires: ['stairs'] },
  { id: 'stretch', title: 'Dehnen', icon: '🧘', attr: 'beweglichkeit', base: 8, step: 1, unit: 'Min.', xp: 25 },
  { id: 'mobility', title: 'Mobilisation', icon: '🌀', attr: 'beweglichkeit', base: 10, step: 1, unit: 'Min.', xp: 30 },
  { id: 'hips', title: 'Hüftöffner', icon: '🦋', attr: 'beweglichkeit', base: 5, step: 1, unit: 'Min.', xp: 20 },
  // With equipment
  { id: 'pullups', title: 'Klimmzüge', icon: '🧗', attr: 'staerke', base: 4, step: 1, unit: 'Wdh.', xp: 40, requires: ['bar'] },
  { id: 'curls', title: 'Bizepsbeugen', icon: '🏋️', attr: 'staerke', base: 12, step: 1, unit: 'pro Arm', xp: 30, requires: ['dumbbells'] },
  { id: 'press', title: 'Schulterdrücken', icon: '🙌', attr: 'staerke', base: 12, step: 1, unit: 'Wdh.', xp: 30, requires: ['dumbbells', 'kettlebell'] },
  { id: 'rows', title: 'Rudern mit Band', icon: '🎗️', attr: 'staerke', base: 15, step: 1, unit: 'Wdh.', xp: 25, requires: ['band'] },
  { id: 'swings', title: 'Kugelhantel-Schwünge', icon: '🔔', attr: 'ausdauer', base: 20, step: 1, unit: 'Wdh.', xp: 35, requires: ['kettlebell'] },
  { id: 'rope', title: 'Seilspringen', icon: '🪢', attr: 'ausdauer', base: 3, step: 1, unit: 'Min.', xp: 30, requires: ['rope'], jump: true },
  { id: 'bike', title: 'Radfahren', icon: '🚴', attr: 'ausdauer', base: 20, step: 5, unit: 'Min.', xp: 35, requires: ['bike'] },
  { id: 'swim', title: 'Schwimmen', icon: '🏊', attr: 'ausdauer', base: 20, step: 5, unit: 'Min.', xp: 45, requires: ['pool'] },
  { id: 'gym', title: 'Gerätetraining', icon: '🏢', attr: 'staerke', base: 30, step: 5, unit: 'Min.', xp: 50, requires: ['gym'], noLevelScale: true },
  { id: 'bandstretch', title: 'Dehnen mit Band', icon: '🧘', attr: 'beweglichkeit', base: 8, step: 1, unit: 'Min.', xp: 25, requires: ['band'] },
  // Fixed like the step goal, but only while reading is switched on (Profile.reading). Proven by logging pages with a photo.
  { id: 'read', title: 'Lesen', icon: '📖', attr: 'intelligenz', base: 10, step: 1, unit: 'Seiten', xp: 30, noLevelScale: true, fixed: true },
];

/** Template id of the daily reading quest. */
export const READ_QUEST = 'read';

export const CUSTOM_QUEST_XP = 30;
export const MAX_CUSTOM_QUESTS = 12;
export const MAX_DAILY_QUESTS = 3;

export interface QuestInstance {
  id: string; // unique within the day
  templateId: string;
  title: string;
  icon: string;
  attr: QuestAttr;
  amount: number;
  unit: string;
  xp: number;
  done: boolean;
  easy?: boolean; // easier variant (title from VARIANTS); missing = normal
  extra?: boolean; // rotating optional quest ("Extra"); missing = required ("Pflicht")
  achieved?: number; // amount actually done, in the quest's unit, up to 2× amount; missing = amount when done, 0 when not
}

/** German titles of the easier variants. Amount and XP stay the same. */
export const VARIANTS: Record<string, string> = {
  pushups: 'Knie-Liegestütze',
  squats: 'Halbe Kniebeugen',
  lunges: 'Ausfallschritte mit Halt',
  jacks: 'Hampelmänner ohne Sprung',
  pullups: 'Australische Klimmzüge',
  burpees: 'Hockstrecksprünge ohne Sprung',
  mountain: 'Bergsteiger langsam',
  plank: 'Unterarmstütz auf den Knien',
  wallsit: 'Wandsitzen höher',
  situps: 'Halbe Bauchpressen',
};

export const hasVariant = (templateId: string | undefined) => !!templateId && templateId in VARIANTS;

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
  equipment?: Equipment[]; // missing in old saves: DEFAULT_EQUIPMENT
  noJumping?: boolean;
  cameraRequired?: boolean; // exercises the camera can count must be done in front of it
  easyVariants?: boolean; // hand out easier variants where there is one; missing = false
  reading?: boolean; // daily reading quest; missing = true
}

/** Reading is on unless the player switched it off. */
export const readingOn = (profile: Profile | null | undefined) => profile?.reading !== false;

export interface SeasonRecord {
  startDate: string;
  endDate: string; // inclusive
  length: number;
}

export interface GameState {
  version: 1;
  profile: Profile | null;
  days: Record<string, DayLog>;
  customQuests: QuestTemplate[];
  disabledQuests: string[];
  seasons: SeasonRecord[]; // finished seasons, oldest first
  battles: Battle[];
  health: HealthState;
  reading: ReadingState;
}

/** Reading log: books with their page entries (see reading.ts). */
export interface ReadingState {
  books: Book[];
}

export interface HealthState {
  connected: boolean;
  lastSync?: string; // ISO timestamp
  days: Record<string, HealthDay>;
}

/** Rotating optional quests per day ("Extra"). The fixed core quests and reading come on top. */
export const EXTRA_QUESTS_PER_DAY = 4;
/** A quest can be done beyond its amount up to this factor, for more XP. */
export const MAX_ACHIEVE_FACTOR = 2;
export const REROLLS_PER_DAY = 1;
export const DAY_CLEAR_BONUS = 50;

export const emptyState = (): GameState => ({
  version: 1,
  profile: null,
  days: {},
  customQuests: [],
  disabledQuests: [],
  seasons: [],
  battles: [],
  health: { connected: false, days: {} },
  reading: { books: [] },
});

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

export function formatDate(key: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return fromDateKey(key).toLocaleDateString('de-DE', opts);
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

// ---------- quest pool ----------

/** Templates that may be drawn at random: enabled built-ins plus non-daily custom quests. */
export function randomPool(
  state: Pick<GameState, 'customQuests' | 'disabledQuests'> & { profile?: Profile | null },
): QuestTemplate[] {
  const possible = QUEST_POOL.filter((q) => !q.fixed && !q.retired && !unavailableReason(q, state.profile));
  const pool = [...possible.filter((q) => !state.disabledQuests.includes(q.id)), ...state.customQuests.filter((q) => !q.daily)];
  return pool.length > 0 ? pool : possible;
}

/** Built-in exercises that are possible and switched on: what enemies may ask for. */
export const battlePool = (state: GameState) => randomPool(state).filter((q) => !q.custom);

export const dailyQuests = (state: Pick<GameState, 'customQuests'>) => state.customQuests.filter((q) => q.daily);

export function findTemplate(state: Pick<GameState, 'customQuests'>, id: string): QuestTemplate | undefined {
  return QUEST_POOL.find((q) => q.id === id) ?? state.customQuests.find((q) => q.id === id);
}

export function makeCustomQuest(input: {
  title: string;
  icon: string;
  attr: QuestAttr;
  amount: number;
  unit: string;
  daily: boolean;
}): QuestTemplate {
  return {
    id: `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    title: input.title.trim(),
    icon: input.icon,
    attr: input.attr,
    base: input.amount,
    step: 1,
    unit: input.unit.trim(),
    xp: CUSTOM_QUEST_XP,
    custom: true,
    daily: input.daily,
  };
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
  if (t.custom) return t.base;
  const raw = t.base * (t.noLevelScale ? DIFFICULTY_FACTOR[difficulty] : scaleFactor(level, difficulty));
  const rounded = Math.round(raw / t.step) * t.step;
  return Math.max(t.step, Number(rounded.toFixed(1)));
}

function instantiate(
  t: QuestTemplate,
  level: number,
  difficulty: Difficulty,
  slot: number,
  easy = false,
  extra = false,
): QuestInstance {
  const variant = easy && !t.custom ? VARIANTS[t.id] : undefined;
  return {
    id: `${t.id}-${slot}`,
    templateId: t.id,
    title: variant ?? t.title,
    icon: t.icon,
    attr: t.attr,
    amount: scaledAmount(t, level, difficulty),
    unit: t.unit,
    xp: t.xp,
    done: false,
    ...(variant ? { easy: true } : {}),
    ...(extra ? { extra: true } : {}),
  };
}

/**
 * The core quests ("Pflicht") of every day, in this order. They are always there: the
 * disabled-quests setting does not apply to them, and they cannot be swapped. Steps grow with
 * difficulty only, the others like normal quests. Reading comes after them while it is on.
 */
export const CORE_QUEST_IDS = ['steps', 'pushups', 'squats', 'plank'] as const;
const CORE_IDS = new Set<string>(CORE_QUEST_IDS);
export const isCoreQuest = (templateId: string) => CORE_IDS.has(templateId);

/** Quests that are part of every day: the core quests, then reading. Never drawn as extras, never swapped. */
export const FIXED_QUESTS: QuestTemplate[] = [
  ...CORE_QUEST_IDS.map((id) => QUEST_POOL.find((q) => q.id === id)!),
  QUEST_POOL.find((q) => q.id === READ_QUEST)!,
];

/** The fixed quests for this profile: the core quests, plus reading unless it is switched off. */
export const fixedQuests = (profile: Profile | null | undefined) =>
  FIXED_QUESTS.filter((q) => q.id !== READ_QUEST || readingOn(profile));

/** Templates that may be handed out as a rotating extra quest. */
const extraCandidate = (t: QuestTemplate) => !t.fixed && !t.retired && !CORE_IDS.has(t.id);

/**
 * A day: the fixed quests (core quests, reading) in fixed order, then EXTRA_QUESTS_PER_DAY
 * rotating extras ("Extra", flagged `extra`), then daily custom quests. Extras are drawn from
 * `pool`: one per physical attribute where the pool allows, filled up at random, all different
 * and never one of the fixed quests. Extras are optional: they give XP and attribute points but
 * are not needed to clear the day.
 */
export function generateDay(
  date: string,
  level: number,
  difficulty: Difficulty,
  pool: QuestTemplate[] = QUEST_POOL,
  daily: QuestTemplate[] = [],
  fixed: QuestTemplate[] = FIXED_QUESTS,
  easy = false,
): DayLog {
  const rand = mulberry32(hash(date));
  const pick = (list: QuestTemplate[]) => list[Math.floor(rand() * list.length)];
  const fixedIds = new Set(fixed.map((t) => t.id));
  const random = pool.filter((q) => extraCandidate(q) && !fixedIds.has(q.id));
  const extras: QuestTemplate[] = [];
  for (const attr of QUEST_ATTRS) {
    const options = random.filter((q) => q.attr === attr && !extras.includes(q));
    if (options.length > 0 && extras.length < EXTRA_QUESTS_PER_DAY) extras.push(pick(options));
  }
  while (extras.length < EXTRA_QUESTS_PER_DAY) {
    const options = random.filter((t) => !extras.includes(t));
    if (options.length === 0) break;
    extras.push(pick(options));
  }
  const slots: [QuestTemplate, boolean][] = [
    ...fixed.map((t) => [t, false] as [QuestTemplate, boolean]),
    ...extras.map((t) => [t, true] as [QuestTemplate, boolean]),
    ...daily.map((t) => [t, false] as [QuestTemplate, boolean]),
  ];
  return {
    date,
    quests: slots.map(([t, extra], i) => instantiate(t, level, difficulty, i, easy, extra)),
    rerollsUsed: 0,
  };
}

/**
 * A day made before core quests and rotating extras existed: it has no extra and does not hold
 * all core quests. All its quests count as required, as they always did. A new day with 0 extras
 * (every extra exercise switched off) still holds all core quests, so it is not legacy.
 */
export const isLegacyDay = (day: DayLog) =>
  !day.quests.some((q) => q.extra) && !CORE_QUEST_IDS.every((id) => day.quests.some((q) => q.templateId === id));

/** Required quests ("Pflicht"): everything that is not a rotating extra. Needed to clear the day. */
export const requiredQuests = (day: DayLog | undefined): QuestInstance[] => (day ? day.quests.filter((q) => !q.extra) : []);

/** Rotating optional quests ("Extra") of the day. Empty for legacy days. */
export const extraQuests = (day: DayLog | undefined): QuestInstance[] => (day ? day.quests.filter((q) => q.extra) : []);

/**
 * Whether the swap joker may replace this quest (ignoring how many jokers are left): only open
 * extras. Legacy days keep the old rule: anything but the step goal, reading and daily custom quests.
 */
export function isSwappable(day: DayLog, q: QuestInstance, customQuests: QuestTemplate[] = []): boolean {
  if (q.done) return false;
  if (!isLegacyDay(day)) return !!q.extra;
  const pinned = QUEST_POOL.some((t) => t.fixed && t.id === q.templateId) || customQuests.some((t) => t.id === q.templateId && t.daily);
  return !pinned;
}

/** Swap one extra quest for a different one of the same attribute (or any, if none left). */
export function rerollQuest(
  day: DayLog,
  questId: string,
  level: number,
  difficulty: Difficulty,
  pool: QuestTemplate[] = QUEST_POOL,
  easy = false,
  customQuests: QuestTemplate[] = [],
): DayLog {
  const idx = day.quests.findIndex((q) => q.id === questId);
  if (idx < 0 || day.rerollsUsed >= REROLLS_PER_DAY) return day;
  const current = day.quests[idx];
  if (!isSwappable(day, current, customQuests)) return day;
  const legacy = isLegacyDay(day);
  const used = new Set(day.quests.map((q) => q.templateId));
  const candidates = pool.filter((t) => !used.has(t.id) && !t.fixed && !t.retired && (legacy || !CORE_IDS.has(t.id)));
  let options = candidates.filter((t) => t.attr === current.attr);
  if (options.length === 0) options = candidates;
  if (options.length === 0) return day;
  const rand = mulberry32(hash(day.date + questId) + day.rerollsUsed + 1);
  const t = options[Math.floor(rand() * options.length)];
  const quests = [...day.quests];
  quests[idx] = { ...instantiate(t, level, difficulty, idx, easy, !!current.extra), id: `${t.id}-${idx}-r${day.rerollsUsed + 1}` };
  return { ...day, quests, rerollsUsed: day.rerollsUsed + 1 };
}

// ---------- doing more than asked ----------

/** The most a quest counts for: twice its amount. */
export const maxAchieved = (q: Pick<QuestInstance, 'amount'>) => q.amount * MAX_ACHIEVE_FACTOR;

/** Amount actually done, in the quest's unit: 0 when open, the amount when done without a value. */
export const questAchieved = (q: Pick<QuestInstance, 'done' | 'amount' | 'achieved'>) =>
  q.done ? (q.achieved ?? q.amount) : 0;

/** A done result between the amount and twice the amount (rounded to 2 decimals). */
function clampAchieved(q: Pick<QuestInstance, 'amount'>, value: number): number {
  const v = Number.isFinite(value) ? value : q.amount;
  return Number(Math.min(Math.max(v, q.amount), maxAchieved(q)).toFixed(2));
}

/** Done at twice the amount (or more): worth double XP and a bonus attribute point. */
export const isDoubled = (q: Pick<QuestInstance, 'done' | 'amount' | 'achieved'>) =>
  q.done && q.amount > 0 && questAchieved(q) >= maxAchieved(q) - 1e-9;

/** XP for one quest: its XP scaled by how much was done, from 1× (the amount) up to 2×. */
export function questXp(q: Pick<QuestInstance, 'done' | 'amount' | 'achieved' | 'xp'>): number {
  if (!q.done) return 0;
  const ratio = q.amount > 0 ? Math.min(questAchieved(q) / q.amount, MAX_ACHIEVE_FACTOR) : 1;
  return Math.max(q.xp, Math.round(q.xp * ratio));
}

/** Every required quest of the day is done at twice its amount. */
export function allDoubled(day: DayLog | undefined): boolean {
  const req = requiredQuests(day);
  return req.length > 0 && req.every(isDoubled);
}

/**
 * Mark a quest done with what was achieved (default: its amount), clamped to amount..2×amount.
 * Calling it again on a done quest with a higher value upgrades the result; it is never lowered.
 * Callers make sure the proof (camera, presence timer) succeeded first.
 */
export function completeQuest(day: DayLog, questId: string, achieved?: number): DayLog {
  const q = day.quests.find((x) => x.id === questId);
  if (!q) return day;
  const value = clampAchieved(q, achieved ?? q.amount);
  if (q.done && value <= questAchieved(q)) return day;
  return { ...day, quests: day.quests.map((x) => (x.id === questId ? { ...x, done: true, achieved: value } : x)) };
}

/** Undo a finished quest (and what was achieved). Always allowed. */
export function uncheckQuest(day: DayLog, questId: string): DayLog {
  const q = day.quests.find((x) => x.id === questId);
  if (!q || !q.done) return day;
  return {
    ...day,
    quests: day.quests.map((x) => {
      if (x.id !== questId) return x;
      const { achieved: _drop, ...rest } = x;
      return { ...rest, done: false };
    }),
  };
}

/**
 * Set what was achieved on a done quest directly (clamped to amount..2×amount), also lower.
 * For corrections such as taking back a page entry. Open quests stay unchanged.
 */
export function setAchieved(day: DayLog, questId: string, achieved: number): DayLog {
  const q = day.quests.find((x) => x.id === questId);
  if (!q || !q.done) return day;
  const value = clampAchieved(q, achieved);
  if (value === questAchieved(q)) return day;
  return { ...day, quests: day.quests.map((x) => (x.id === questId ? { ...x, achieved: value } : x)) };
}

/** Today's quests built from the state's settings (pool, daily custom quests, reading, easy variants). */
export function dayFor(state: GameState, date: string, level: number): DayLog {
  const p = state.profile;
  return generateDay(date, level, p?.difficulty ?? 2, randomPool(state), dailyQuests(state), fixedQuests(p), !!p?.easyVariants);
}

/** A fresh day from the current settings that keeps the swap jokers already used on that date. */
export function rebuildDay(state: GameState, date: string, level: number): DayLog {
  return { ...dayFor(state, date, level), rerollsUsed: state.days[date]?.rerollsUsed ?? 0 };
}

/**
 * A day with nothing ticked gets rebuilt when it is missing a fixed quest (core quest, or reading
 * once it is on) or was made before rotating extras existed.
 */
export function dayOutdated(day: DayLog | undefined, profile: Profile | null | undefined): boolean {
  if (!day || day.quests.some((q) => q.done)) return false;
  if (isLegacyDay(day)) return true;
  return fixedQuests(profile).some((t) => !day.quests.some((q) => q.templateId === t.id));
}

/**
 * Switch the reading quest on or off. Today's day follows right away: switching on adds the
 * quest unless the day is already cleared (that would take the clear away); switching off
 * removes it unless it is already done.
 */
export function setReading(state: GameState, today: string, on: boolean): GameState {
  if (!state.profile) return state;
  const next: GameState = { ...state, profile: { ...state.profile, reading: on } };
  const day = state.days[today];
  if (!day) return next;
  const has = day.quests.find((q) => q.templateId === READ_QUEST);
  if (on && !has && !isCleared(day)) {
    const t = QUEST_POOL.find((q) => q.id === READ_QUEST)!;
    const quest = instantiate(t, 1, state.profile.difficulty, day.quests.length);
    return { ...next, days: { ...next.days, [today]: { ...day, quests: [...day.quests, quest] } } };
  }
  if (!on && has && !has.done) {
    return { ...next, days: { ...next.days, [today]: { ...day, quests: day.quests.filter((q) => q !== has) } } };
  }
  return next;
}

/**
 * Add a daily custom quest to a day. A day that is already cleared stays as it is (the quest
 * starts tomorrow), because a new open required quest would take the clear away.
 */
export function addDailyQuestToDay(day: DayLog, t: QuestTemplate, difficulty: Difficulty): DayLog {
  if (!t.daily || isCleared(day)) return day;
  const quest = instantiate(t, 1, difficulty, day.quests.length);
  return { ...day, quests: [...day.quests, quest] };
}

/** Pinned quests (core quests, reading, daily custom quests) cannot be swapped. See also isSwappable. */
export const isDailyInstance = (state: Pick<GameState, 'customQuests'>, q: QuestInstance) =>
  FIXED_QUESTS.some((t) => t.id === q.templateId) ||
  !!state.customQuests.find((t) => t.id === q.templateId && t.daily);

// ---------- derived stats ----------

/** All required quests are done. Extras do not count; legacy days (no extras) need every quest. */
export const isCleared = (day: DayLog | undefined) => {
  const req = requiredQuests(day);
  return req.length > 0 && req.every((q) => q.done);
};

type DayFilter = (date: string) => boolean;
const everyDay: DayFilter = () => true;
const inRange = (start: string, end: string): DayFilter => (d) => d >= start && d <= end;

function daysWhere(state: GameState, filter: DayFilter): DayLog[] {
  return Object.values(state.days).filter((d) => filter(d.date));
}

export const dayXp = (day: DayLog) =>
  day.quests.reduce((s, q) => s + questXp(q), 0) + (isCleared(day) ? DAY_CLEAR_BONUS : 0);

export function totalXp(state: GameState, filter: DayFilter = everyDay): number {
  const quests = daysWhere(state, filter).reduce((s, d) => s + dayXp(d), 0);
  const battles = state.battles.reduce((s, b) => s + (b.defeatedOn && filter(b.defeatedOn) ? b.xp : 0), 0);
  return quests + battles;
}

export const ENEMY_ATTR_POINTS = 2;
export const BOSS_ATTR_POINTS = 5;

export function attributes(state: GameState, filter: DayFilter = everyDay): Record<Attr, number> {
  const out: Record<Attr, number> = { staerke: 0, ausdauer: 0, beweglichkeit: 0, intelligenz: 0, disziplin: 0 };
  for (const day of daysWhere(state, filter)) {
    for (const q of day.quests) if (q.done) out[q.attr] += isDoubled(q) ? 2 : 1; // +1 bonus at 2×
    if (isCleared(day)) out.disziplin += 1;
  }
  for (const b of state.battles) {
    if (b.defeatedOn && filter(b.defeatedOn)) out[b.attr] += b.boss ? BOSS_ATTR_POINTS : ENEMY_ATTR_POINTS;
  }
  return out;
}

/** Everything up to and including `date`. */
export const until = (date: string): DayFilter => (d) => d <= date;

export interface PlayerClass {
  name: string;
  line: string;
}

/**
 * An RPG class from the attribute mix: the leading attribute, or a hybrid when
 * two are close (within 20 %), or an all-rounder when all three are. Intelligenz
 * only counts when it leads on its own (scholar); hybrids are physical only.
 */
export function playerClass(a: Record<Attr, number>): PlayerClass {
  const main = (['staerke', 'ausdauer', 'beweglichkeit'] as const).map((k) => [k, a[k]] as const).sort((x, y) => y[1] - x[1]);
  const [first, second, third] = main;
  const intel = a.intelligenz ?? 0; // records from before the attribute existed
  if (first[1] < 5 && intel < 5) return { name: 'Rekrut', line: 'Jede Klasse fängt hier an. Deine ersten Quests entscheiden, wohin es geht.' };
  if (intel > first[1]) return { name: 'Gelehrter', line: 'Dein Kopf führt. Jede gelesene Seite macht dich klüger.' };
  const close = (v: number) => v >= first[1] * 0.8;
  if (close(second[1]) && close(third[1])) return { name: 'Allrounder', line: 'Kraft, Ausdauer, Beweglichkeit: bei dir ist alles im Gleichgewicht.' };
  if (close(second[1])) {
    const pair = [first[0], second[0]].sort().join('+');
    const hybrids: Record<string, PlayerClass> = {
      'ausdauer+staerke': { name: 'Gladiator', line: 'Stark und zäh. Du hältst länger durch als deine Gegner.' },
      'beweglichkeit+staerke': { name: 'Kampfkünstler', line: 'Kraft mit Kontrolle. Jede Bewegung sitzt.' },
      'ausdauer+beweglichkeit': { name: 'Waldläufer', line: 'Leichtfüßig und ausdauernd. Kein Weg ist dir zu weit.' },
    };
    return hybrids[pair];
  }
  const solo: Record<string, PlayerClass> = {
    staerke: { name: 'Krieger', line: 'Deine Stärke führt. Liegestütze und Kniebeugen sind deine Waffen.' },
    ausdauer: { name: 'Läufer', line: 'Deine Ausdauer führt. Du gehst weiter, wenn andere stehen bleiben.' },
    beweglichkeit: { name: 'Akrobat', line: 'Deine Beweglichkeit führt. Geschmeidig, schnell, schwer zu treffen.' },
  };
  return solo[first[0]];
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

export function bestStreak(state: GameState, filter: DayFilter = everyDay): number {
  const cleared = Object.keys(state.days)
    .filter((k) => filter(k) && isCleared(state.days[k]))
    .sort();
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

export function questsDone(state: GameState, filter: DayFilter = everyDay): number {
  return daysWhere(state, filter).reduce((n, d) => n + d.quests.filter((q) => q.done).length, 0);
}

/** Quests done at twice their amount. */
export function questsDoubled(state: GameState, filter: DayFilter = everyDay): number {
  return daysWhere(state, filter).reduce((n, d) => n + d.quests.filter(isDoubled).length, 0);
}

/** Days on which every required quest was done at twice its amount. */
export function daysAllDoubled(state: GameState, filter: DayFilter = everyDay): number {
  return daysWhere(state, filter).filter(allDoubled).length;
}

export interface ExerciseTotal {
  templateId: string;
  title: string;
  icon: string;
  unit: string;
  attr: QuestAttr;
  count: number;
  total: number;
}

/** Per-exercise totals of completed quests, most frequent first. */
export function exerciseTotals(state: GameState): ExerciseTotal[] {
  const map = new Map<string, ExerciseTotal>();
  for (const day of Object.values(state.days)) {
    for (const q of day.quests) {
      if (!q.done) continue;
      const e = map.get(q.templateId) ?? {
        templateId: q.templateId,
        title: q.title,
        icon: q.icon,
        unit: q.unit,
        attr: q.attr,
        count: 0,
        total: 0,
      };
      e.count += 1;
      e.total = Number((e.total + questAchieved(q)).toFixed(1));
      map.set(q.templateId, e);
    }
  }
  // Reps logged against enemies count too (not as a separate quest).
  for (const b of state.battles) {
    for (const p of b.phases) {
      if (p.kind !== 'exercise' || !p.exerciseId || p.log.length === 0) continue;
      const t = QUEST_POOL.find((q) => q.id === p.exerciseId);
      if (!t) continue;
      const e = map.get(t.id) ?? { templateId: t.id, title: t.title, icon: t.icon, unit: t.unit, attr: t.attr, count: 0, total: 0 };
      e.total = Number((e.total + p.log.reduce((s, l) => s + l.amount, 0)).toFixed(1));
      map.set(t.id, e);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

export const totalFor = (state: GameState, templateId: string) =>
  exerciseTotals(state).find((e) => e.templateId === templateId)?.total ?? 0;

/** Daily values for a chart: XP per day, or the done amount of one exercise. */
export function dailySeries(state: GameState, dates: string[], metric: 'xp' | string): number[] {
  return dates.map((d) => {
    const day = state.days[d];
    if (metric === 'xp') {
      const battleXp = state.battles.reduce((s, b) => s + (b.defeatedOn === d ? b.xp : 0), 0);
      return (day ? dayXp(day) : 0) + battleXp;
    }
    const questAmount = day ? day.quests.filter((q) => q.done && q.templateId === metric).reduce((s, q) => s + questAchieved(q), 0) : 0;
    let battleAmount = 0;
    for (const b of state.battles)
      for (const p of b.phases)
        if (p.exerciseId === metric) for (const l of p.log) if (l.date === d) battleAmount += l.amount;
    return Number((questAmount + battleAmount).toFixed(1));
  });
}

// ---------- seasons ----------

/** 1-based day of the season; may exceed seasonDays once the season is over. */
export const seasonDay = (profile: Profile, today: string) => daysBetween(profile.startDate, today) + 1;

export const seasonOver = (profile: Profile, today: string) => seasonDay(profile, today) > profile.seasonDays;

export const seasonEnd = (startDate: string, length: number) => addDays(startDate, length - 1);

export interface SeasonSummary {
  startDate: string;
  endDate: string;
  length: number;
  daysCleared: number;
  daysActive: number;
  questsDone: number;
  xp: number;
  bestStreak: number;
}

export function summarizeSeason(state: GameState, startDate: string, length: number): SeasonSummary {
  const endDate = seasonEnd(startDate, length);
  const f = inRange(startDate, endDate);
  const days = daysWhere(state, f);
  return {
    startDate,
    endDate,
    length,
    daysCleared: days.filter(isCleared).length,
    daysActive: days.filter((d) => d.quests.some((q) => q.done)).length,
    questsDone: questsDone(state, f),
    xp: totalXp(state, f),
    bestStreak: bestStreak(state, f),
  };
}

/** Archive the current season and start a new one today. Level and XP carry over. */
export function startNewSeason(state: GameState, today: string, length: number): GameState {
  if (!state.profile) return state;
  const { startDate, seasonDays } = state.profile;
  const record: SeasonRecord = { startDate, endDate: seasonEnd(startDate, seasonDays), length: seasonDays };
  return {
    ...state,
    seasons: [...state.seasons, record],
    profile: { ...state.profile, startDate: today, seasonDays: length },
  };
}

// ---------- persistence helpers ----------

export function isGameState(x: unknown): x is GameState {
  if (!x || typeof x !== 'object') return false;
  const s = x as GameState;
  return s.version === 1 && typeof s.days === 'object' && s.days !== null && 'profile' in s;
}

const builtInTitle = (id: string | undefined) => QUEST_POOL.find((q) => q.id === id)?.title;

/** Current title of a built-in exercise, or of its easier variant. */
const currentTitle = (id: string | undefined, easy: boolean | undefined) =>
  (easy && id ? VARIANTS[id] : undefined) ?? builtInTitle(id);

/** Exercise names can change between versions; saved days and fights follow the current names. */
function retitleDay(d: DayLog): DayLog {
  return {
    ...d,
    quests: d.quests.map((q) => {
      const { achieved, ...rest } = q;
      const title = currentTitle(q.templateId, q.easy) ?? q.title;
      // a broken backup must not turn XP into NaN: drop bad values, clamp the rest to 0..2x amount
      if (typeof achieved !== 'number' || !Number.isFinite(achieved)) return { ...rest, title };
      return { ...rest, title, achieved: Math.min(Math.max(achieved, 0), maxAchieved(q)) };
    }),
  };
}
function retitleBattle(b: Battle): Battle {
  return { ...b, phases: b.phases.map((p) => ({ ...p, title: (p.kind === 'exercise' && currentTitle(p.exerciseId, p.easy)) || p.title })) };
}

/** Synced days from old saves lack the newer workout fields. */
function normalizeHealthDay(h: Partial<HealthDay> | undefined): HealthDay {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return { steps: n(h?.steps), runKm: n(h?.runKm), bikeMin: n(h?.bikeMin), swimMin: n(h?.swimMin), floors: n(h?.floors), strengthMin: n(h?.strengthMin) };
}

/** Fill in fields added after the first release so old saves keep working. */
export function normalize(s: GameState): GameState {
  return {
    ...emptyState(),
    ...s,
    customQuests: Array.isArray(s.customQuests) ? s.customQuests : [],
    disabledQuests: Array.isArray(s.disabledQuests) ? s.disabledQuests : [],
    seasons: Array.isArray(s.seasons) ? s.seasons : [],
    battles: Array.isArray(s.battles) ? s.battles.map(retitleBattle) : [],
    days: Object.fromEntries(Object.entries(s.days).map(([k, d]) => [k, retitleDay(d)])),
    health:
      s.health && typeof s.health === 'object'
        ? {
            connected: !!s.health.connected,
            lastSync: s.health.lastSync,
            days: Object.fromEntries(Object.entries(s.health.days ?? {}).map(([k, h]) => [k, normalizeHealthDay(h)])),
          }
        : { connected: false, days: {} },
    reading: { books: Array.isArray(s.reading?.books) ? s.reading.books.map(normalizeBook) : [] },
  };
}

/** Books from older versions may miss newer fields. */
function normalizeBook(b: Book): Book {
  const { cover, totalPages, ...rest } = b;
  const lastPage = Number.isFinite(b.lastPage) ? b.lastPage : 0;
  const pagesOk = typeof totalPages === 'number' && Number.isInteger(totalPages) && totalPages >= 1 && totalPages >= lastPage;
  return {
    ...rest,
    lastPage,
    log: Array.isArray(b.log) ? b.log : [],
    ...(typeof cover === 'string' && cover ? { cover } : {}),
    ...(pagesOk ? { totalPages } : {}),
  };
}

// ---------- health auto-complete ----------

/**
 * Tick off today's health-proof quests (steps, runs, cycling, …) that the synced data already
 * covers, and keep what was achieved up to date as more data comes in (up to 2×, never lower).
 */
export function autoCompleteFromHealth(state: GameState, today: string): GameState {
  const h = state.health.connected ? state.health.days[today] : undefined;
  const day = state.days[today];
  if (!h || !day) return state;
  let changed = false;
  const quests = day.quests.map((q) => {
    const proof = proofFor(q, state.customQuests);
    if (proof.kind !== 'health') return q;
    const value = metricValue(h, proof.metric);
    if (!q.done && value < q.amount) return q;
    const achieved = clampAchieved(q, value);
    if (q.done && achieved <= questAchieved(q)) return q;
    changed = true;
    return { ...q, done: true, achieved };
  });
  return changed ? { ...state, days: { ...state.days, [today]: { ...day, quests } } } : state;
}

/** Quests that health data ticks off automatically (proof kind 'health'). */
export function isTrackedQuest(templateId: string, customQuests: QuestTemplate[] = []): boolean {
  const unit = customQuests.find((t) => t.id === templateId)?.unit ?? '';
  return proofFor({ templateId, unit, amount: 0 }, customQuests).kind === 'health';
}
