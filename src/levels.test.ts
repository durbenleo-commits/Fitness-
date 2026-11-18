import { describe, expect, it } from 'vitest';
import { generateBoss, generateEnemy, ensureBattles } from './battle';
import {
  EXERCISE_MIN_LEVEL,
  EXTRA_QUESTS_PER_DAY,
  QUEST_POOL,
  dayFor,
  emptyState,
  extraQuests,
  generateDay,
  isCoreQuest,
  makeCustomQuest,
  newlyUnlocked,
  normalize,
  randomPool,
  rerollQuest,
  type DayLog,
  type GameState,
  type Profile,
} from './game';

const profile: Profile = { name: 'A', difficulty: 2, seasonDays: 66, startDate: '2026-11-01', equipment: ['outdoor', 'stairs', 'bar'] };
const state = (extra: Partial<GameState> = {}): GameState => ({ ...emptyState(), profile, ...extra });
const dates = Array.from({ length: 60 }, (_, i) => `2026-${i < 30 ? '11' : '12'}-${String((i % 30) + 1).padStart(2, '0')}`);
const minLevel = (id: string) => QUEST_POOL.find((t) => t.id === id)?.minLevel ?? 1;
const locked = (level: number) => new Set(QUEST_POOL.filter((t) => (t.minLevel ?? 1) > level).map((t) => t.id));

describe('exercise level gate', () => {
  it('reads the levels from EXERCISE_MIN_LEVEL and never gates core quests', () => {
    expect(minLevel('pistol')).toBe(10);
    expect(minLevel('handstand')).toBe(12);
    expect(minLevel('dips')).toBe(2);
    expect(minLevel('calves')).toBe(1);
    expect(minLevel('lunges')).toBe(1);
    for (const id of Object.keys(EXERCISE_MIN_LEVEL)) expect(QUEST_POOL.some((t) => t.id === id)).toBe(true);
    for (const t of QUEST_POOL) if (isCoreQuest(t.id) || t.fixed) expect(t.minLevel).toBeUndefined();
  });

  it('pool at level 1 leaves out locked exercises, level 10 has pistol but not handstand', () => {
    const at1 = randomPool(state(), 1).map((t) => t.id);
    for (const id of ['sideplank', 'dips', 'hollow', 'pike', 'chinups', 'pistol', 'handstand', 'lsit']) expect(at1).not.toContain(id);
    for (const id of ['calves', 'bridge', 'superman', 'legraises', 'lunges']) expect(at1).toContain(id);
    const at10 = randomPool(state(), 10).map((t) => t.id);
    for (const id of ['sideplank', 'dips', 'pike', 'chinups', 'kneeraises', 'lsit', 'pistol']) expect(at10).toContain(id);
    expect(at10).not.toContain('handstand');
  });

  it('never hands out a locked extra, but custom quests are not gated', () => {
    const custom = { ...makeCustomQuest({ title: 'Seil', icon: 'x', attr: 'ausdauer', amount: 5, unit: 'Min.', daily: false }), minLevel: 50 };
    const s = state({ customQuests: [custom] });
    for (const date of dates) {
      const day = dayFor(s, date, 1);
      for (const q of extraQuests(day)) expect(locked(1).has(q.templateId)).toBe(false);
    }
    // a custom quest shows up even at level 1 (gate is for built-ins only)
    expect(randomPool(s, 1).some((t) => t.id === custom.id)).toBe(true);
    // generateDay itself also respects the gate, even with the full pool
    for (const date of dates) for (const q of extraQuests(generateDay(date, 1, 2))) expect(locked(1).has(q.templateId)).toBe(false);
    // at level 12 the higher exercises do come up over time
    const seen = new Set(dates.flatMap((d) => extraQuests(dayFor(s, d, 12)).map((q) => q.templateId)));
    expect([...seen].some((id) => minLevel(id) >= 5)).toBe(true);
  });

  it('the swap joker respects the gate', () => {
    for (const date of dates) {
      const day = generateDay(date, 1, 2, randomPool(state(), 1));
      for (const q of extraQuests(day)) {
        // even if a too-wide pool is passed, rerollQuest leaves locked ones out
        const swapped = rerollQuest(day, q.id, 1, 2, QUEST_POOL);
        const now = swapped.quests[day.quests.indexOf(q)];
        expect(swapped).not.toBe(day);
        expect(locked(1).has(now.templateId)).toBe(false);
      }
    }
  });

  it('arena enemies and bosses ask for no locked exercise', () => {
    const gatedOnly = QUEST_POOL.filter((t) => t.minLevel || isCoreQuest(t.id) || t.id === 'run');
    for (const date of dates) {
      for (const b of [generateEnemy(date, 1, 2, gatedOnly), generateBoss(date, 1, 2, gatedOnly), generateEnemy(date, 1, 2, QUEST_POOL)]) {
        for (const p of b.phases) if (p.exerciseId) expect(locked(1).has(p.exerciseId)).toBe(false);
      }
      const s = ensureBattles(state(), date, 1);
      for (const b of s.battles) for (const p of b.phases) if (p.exerciseId) expect(locked(1).has(p.exerciseId)).toBe(false);
    }
    // with a high level the same pool lets locked-at-1 exercises in
    const high = dates.flatMap((d) => generateEnemy(d, 12, 2, gatedOnly).phases.map((p) => p.exerciseId ?? ''));
    expect(high.some((id) => minLevel(id) > 1)).toBe(true);
  });

  it('keeps old saved days that already hold a locked exercise', () => {
    const base = generateDay('2026-11-10', 1, 2);
    const i = base.quests.findIndex((q) => q.extra);
    const old: DayLog = { ...base, quests: base.quests.map((q, j) => (j === i ? { ...q, templateId: 'pistol', id: `pistol-${j}`, title: 'Pistol Squats' } : q)) };
    const loaded = normalize({ ...state(), days: { '2026-11-10': old } });
    expect(loaded.days['2026-11-10'].quests[i].templateId).toBe('pistol');
    expect(loaded.days['2026-11-10'].quests).toHaveLength(old.quests.length);
  });

  it('too few unlocked exercises: fewer extras, no duplicates, no crash', () => {
    // only gated exercises switched on at level 1: pool falls back to all possible unlocked ones
    const allButLocked = QUEST_POOL.filter((t) => !t.minLevel).map((t) => t.id);
    const s = state({ disabledQuests: allButLocked });
    const pool = randomPool(s, 1);
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((t) => !t.minLevel)).toBe(true);
    // a pool with only 2 unlocked candidates gives 2 extras, each once
    const tiny = QUEST_POOL.filter((t) => t.fixed || ['calves', 'bridge', 'pistol', 'handstand'].includes(t.id));
    const day = generateDay('2026-11-12', 1, 2, tiny);
    const ids = extraQuests(day).map((q) => q.templateId);
    expect(ids.sort()).toEqual(['bridge', 'calves']);
    expect(ids.length).toBeLessThan(EXTRA_QUESTS_PER_DAY);
    // and the joker has nothing left to swap to: day unchanged
    const q = extraQuests(day)[0];
    expect(rerollQuest(day, q.id, 1, 2, tiny)).toBe(day);
  });
});

describe('unlock note', () => {
  it('lists what a level-up unlocks (possible with the equipment)', () => {
    expect(newlyUnlocked(1, 2, profile).map((t) => t.id).sort()).toEqual(['dips', 'sideplank']);
    expect(newlyUnlocked(4, 5, profile).map((t) => t.id).sort()).toEqual(['chinups', 'pike', 'splitsquat']);
    expect(newlyUnlocked(4, 5, { ...profile, equipment: [] }).map((t) => t.id).sort()).toEqual(['pike', 'splitsquat']);
    expect(newlyUnlocked(10, 10, profile)).toEqual([]);
  });

  it('normalize: new saves start at 1, old saves count the current level as seen', () => {
    expect(normalize(emptyState()).seenUnlockLevel).toBe(1);
    const old = { ...emptyState(), profile } as Partial<GameState>;
    delete old.seenUnlockLevel;
    // enough XP for a few levels: 10 cleared days
    const days: Record<string, DayLog> = {};
    for (const d of dates.slice(0, 10)) {
      const day = generateDay(d, 1, 2);
      days[d] = { ...day, quests: day.quests.map((q) => ({ ...q, done: true })) };
    }
    const n = normalize({ ...old, days } as GameState);
    expect(n.seenUnlockLevel).toBeGreaterThan(1);
    expect(normalize({ ...n, seenUnlockLevel: 3 }).seenUnlockLevel).toBe(3);
  });
});
