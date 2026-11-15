import { describe, expect, it } from 'vitest';
import {
  addDays,
  bestStreak,
  currentStreak,
  emptyState,
  generateDay,
  levelFromXp,
  rerollQuest,
  totalXp,
  DAY_CLEAR_BONUS,
  type GameState,
} from './game';

const doneDay = (date: string) => {
  const d = generateDay(date, 1, 2);
  d.quests.forEach((q) => (q.done = true));
  return d;
};

describe('levels', () => {
  it('starts at level 1 and levels up at 100 XP', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toEqual({ level: 2, intoLevel: 0, needed: 125 });
    expect(levelFromXp(225).level).toBe(3);
  });
});

describe('dates', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('quest generation', () => {
  it('is deterministic and covers every attribute', () => {
    const a = generateDay('2026-11-15', 1, 2);
    const b = generateDay('2026-11-15', 1, 2);
    expect(a).toEqual(b);
    expect(a.quests).toHaveLength(4);
    expect(new Set(a.quests.map((q) => q.templateId)).size).toBe(4);
    for (const attr of ['staerke', 'ausdauer', 'beweglichkeit']) {
      expect(a.quests.some((q) => q.attr === attr)).toBe(true);
    }
  });

  it('makes quests harder at higher levels', () => {
    const low = generateDay('2026-11-15', 1, 2);
    const high = generateDay('2026-11-15', 20, 2);
    low.quests.forEach((q, i) => expect(high.quests[i].amount).toBeGreaterThan(q.amount));
  });

  it('allows one reroll per day and never duplicates a quest', () => {
    const day = generateDay('2026-11-15', 1, 2);
    const once = rerollQuest(day, day.quests[0].id, 1, 2);
    expect(once.rerollsUsed).toBe(1);
    expect(once.quests[0].templateId).not.toBe(day.quests[0].templateId);
    expect(new Set(once.quests.map((q) => q.templateId)).size).toBe(4);
    expect(rerollQuest(once, once.quests[1].id, 1, 2)).toBe(once);
  });
});

describe('progress', () => {
  it('adds a bonus for a fully cleared day', () => {
    const state: GameState = { ...emptyState(), days: { '2026-11-15': doneDay('2026-11-15') } };
    const questXp = state.days['2026-11-15'].quests.reduce((s, q) => s + q.xp, 0);
    expect(totalXp(state)).toBe(questXp + DAY_CLEAR_BONUS);
  });

  it('keeps the streak alive while today is still open', () => {
    const state: GameState = {
      ...emptyState(),
      days: {
        '2026-11-13': doneDay('2026-11-13'),
        '2026-11-14': doneDay('2026-11-14'),
        '2026-11-15': generateDay('2026-11-15', 1, 2),
      },
    };
    expect(currentStreak(state, '2026-11-15')).toBe(2);
    expect(currentStreak(state, '2026-11-16')).toBe(0);
  });

  it('finds the best streak across gaps', () => {
    const days: GameState['days'] = {};
    for (const d of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06']) days[d] = doneDay(d);
    expect(bestStreak({ ...emptyState(), days })).toBe(3);
  });
});
