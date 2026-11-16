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
    expect(a.quests).toHaveLength(5); // steps, reading, three random
    expect(new Set(a.quests.map((q) => q.templateId)).size).toBe(5);
    for (const attr of ['staerke', 'ausdauer', 'beweglichkeit', 'intelligenz']) {
      expect(a.quests.some((q) => q.attr === attr)).toBe(true);
    }
  });

  it('makes quests harder at higher levels', () => {
    const low = generateDay('2026-11-15', 1, 2);
    const high = generateDay('2026-11-15', 20, 2);
    low.quests.forEach((q, i) => {
      // steps and reading never grow with level
      if (q.templateId === 'steps' || q.templateId === 'read') expect(high.quests[i].amount).toBe(q.amount);
      else expect(high.quests[i].amount).toBeGreaterThan(q.amount);
    });
  });

  it('allows one reroll per day and never duplicates a quest', () => {
    const day = generateDay('2026-11-15', 1, 2);
    expect(rerollQuest(day, day.quests[0].id, 1, 2)).toBe(day); // the step goal stays
    expect(rerollQuest(day, day.quests[1].id, 1, 2)).toBe(day); // reading stays
    const once = rerollQuest(day, day.quests[2].id, 1, 2);
    expect(once.rerollsUsed).toBe(1);
    expect(once.quests[2].templateId).not.toBe(day.quests[2].templateId);
    expect(new Set(once.quests.map((q) => q.templateId)).size).toBe(5);
    expect(rerollQuest(once, once.quests[3].id, 1, 2)).toBe(once);
  });
});

describe('daily step goal', () => {
  it('is part of every day, cannot be swapped, and walking is gone', () => {
    for (const d of ['2026-11-15', '2026-11-16', '2026-11-17']) {
      const day = generateDay(d, 1, 2);
      expect(day.quests[0].templateId).toBe('steps');
      expect(day.quests[0].amount).toBe(7000);
      expect(day.quests.some((q) => q.templateId === 'walk')).toBe(false);
      expect(day.quests).toHaveLength(5);
    }
    expect(generateDay('2026-11-15', 1, 1).quests[0].amount).toBe(4000);
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

describe('classes', () => {
  it('picks a class from the attribute mix', async () => {
    const { playerClass } = await import('./game');
    expect(playerClass({ staerke: 2, ausdauer: 1, beweglichkeit: 0, intelligenz: 0, disziplin: 0 }).name).toBe('Rekrut');
    expect(playerClass({ staerke: 20, ausdauer: 5, beweglichkeit: 3, intelligenz: 0, disziplin: 4 }).name).toBe('Krieger');
    expect(playerClass({ staerke: 20, ausdauer: 18, beweglichkeit: 3, intelligenz: 0, disziplin: 4 }).name).toBe('Gladiator');
    expect(playerClass({ staerke: 10, ausdauer: 10, beweglichkeit: 9, intelligenz: 0, disziplin: 4 }).name).toBe('Allrounder');
  });
});
