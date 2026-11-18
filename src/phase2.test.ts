import { ALL_MASTERED } from './mastery';
import { describe, expect, it } from 'vitest';
import { achievementStatus } from './achievements';
import {
  QUEST_POOL,
  dailySeries,
  emptyState,
  exerciseTotals,
  generateDay,
  makeCustomQuest,
  normalize,
  randomPool,
  rerollQuest,
  seasonOver,
  startNewSeason,
  summarizeSeason,
  type GameState,
} from './game';

const custom = (daily: boolean) =>
  makeCustomQuest({ title: 'Klimmzüge', icon: '🧗', attr: 'staerke', amount: 5, unit: 'Wdh.', daily });

const doneDay = (date: string) => {
  const d = generateDay(date, 1, 2);
  d.quests.forEach((q) => (q.done = true));
  return d;
};

describe('custom and disabled quests', () => {
  it('appends daily custom quests with their exact amount', () => {
    const c = custom(true);
    const day = generateDay('2026-11-15', 30, 3, QUEST_POOL, [c]);
    expect(day.quests).toHaveLength(10); // four core, reading, four extras, one daily custom
    expect(day.quests[9]).toMatchObject({ templateId: c.id, amount: 5, xp: 30 });
    expect(day.quests[9].extra).toBeUndefined(); // daily custom quests are required
  });

  it('keeps daily quests out of the random pool and leaves out disabled ones', () => {
    const state = { customQuests: [custom(true), custom(false)], disabledQuests: ['run', 'pushups'] };
    const pool = randomPool(state, 99, ALL_MASTERED);
    expect(pool.some((q) => q.id === 'run' || q.id === 'pushups')).toBe(false);
    expect(pool.filter((q) => q.custom)).toHaveLength(1);
  });

  it('still fills a day when whole attributes are disabled', () => {
    const disabled = QUEST_POOL.filter((q) => q.attr === 'beweglichkeit').map((q) => q.id);
    const pool = randomPool({ customQuests: [], disabledQuests: disabled }, 99, ALL_MASTERED);
    const day = generateDay('2026-11-15', 1, 2, pool);
    expect(day.quests).toHaveLength(9);
    expect(day.quests.filter((q) => q.extra)).toHaveLength(4);
    expect(day.quests.some((q) => q.attr === 'beweglichkeit')).toBe(false);
  });

  it('falls back to all possible exercises when everything is disabled', () => {
    const pool = randomPool({ customQuests: [], disabledQuests: QUEST_POOL.map((q) => q.id) }, 99, ALL_MASTERED);
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.some((q) => q.id === 'pullups')).toBe(false);
  });

  it('rerolls within the given pool only', () => {
    const pool = QUEST_POOL.filter((q) => q.id !== 'hips');
    const day = generateDay('2026-11-15', 1, 2, pool);
    const flex = day.quests.find((q) => q.attr === 'beweglichkeit')!;
    const next = rerollQuest(day, flex.id, 1, 2, pool);
    expect(next.quests.some((q) => q.templateId === 'hips')).toBe(false);
  });
});

describe('history', () => {
  it('sums amounts per exercise and per day', () => {
    const d1 = doneDay('2026-11-14');
    const d2 = doneDay('2026-11-15');
    const state: GameState = { ...emptyState(), days: { [d1.date]: d1, [d2.date]: d2 } };
    const id = d1.quests[0].templateId;
    const both = d2.quests.find((q) => q.templateId === id);
    const totals = exerciseTotals(state).find((e) => e.templateId === id)!;
    expect(totals.total).toBe(d1.quests[0].amount + (both?.amount ?? 0));
    expect(dailySeries(state, ['2026-11-13', '2026-11-14'], id)).toEqual([0, d1.quests[0].amount]);
  });
});

describe('seasons', () => {
  it('summarizes only days inside the season and archives it on restart', () => {
    const state: GameState = {
      ...emptyState(),
      profile: { name: 'A', difficulty: 2, seasonDays: 3, startDate: '2026-11-01' },
      days: { '2026-11-01': doneDay('2026-11-01'), '2026-11-02': doneDay('2026-11-02'), '2026-11-05': doneDay('2026-11-05') },
    };
    const s = summarizeSeason(state, '2026-11-01', 3);
    expect(s).toMatchObject({ endDate: '2026-11-03', daysCleared: 2, bestStreak: 2, questsDone: 18 });
    expect(seasonOver(state.profile!, '2026-11-03')).toBe(false);
    expect(seasonOver(state.profile!, '2026-11-04')).toBe(true);

    const next = startNewSeason(state, '2026-11-06', 30);
    expect(next.seasons).toEqual([{ startDate: '2026-11-01', endDate: '2026-11-03', length: 3 }]);
    expect(next.profile).toMatchObject({ startDate: '2026-11-06', seasonDays: 30 });
    expect(next.days).toBe(state.days);
  });
});

describe('achievements and saves', () => {
  it('unlocks first quest and first clear', () => {
    const d = doneDay('2026-11-15');
    const list = achievementStatus({ ...emptyState(), days: { [d.date]: d } }, '2026-11-15');
    const byId = Object.fromEntries(list.map((a) => [a.achievement.id, a]));
    expect(byId['first-quest'].unlocked).toBe(true);
    expect(byId['first-clear'].unlocked).toBe(true);
    expect(byId['streak-3']).toMatchObject({ unlocked: false, value: 1 });
  });

  it('upgrades a Phase 1 save', () => {
    const old = { version: 1, profile: null, days: {} } as unknown as GameState;
    expect(normalize(old)).toEqual(emptyState());
  });
});
