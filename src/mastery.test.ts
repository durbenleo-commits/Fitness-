import { describe, expect, it } from 'vitest';
import { ensureBattles } from './battle';
import {
  GOAL_EXTRAS,
  QUEST_POOL,
  acknowledgeUnlocks,
  dayFor,
  emptyState,
  extraQuests,
  goalSteps,
  isCoreQuest,
  makeCustomQuest,
  newlyUnlocked,
  normalize,
  randomPool,
  reachedGoal,
  rerollQuest,
  setTrainingGoal,
  type DayLog,
  type GameState,
  type Profile,
  type QuestInstance,
} from './game';
import {
  ALL_MASTERED,
  GATED_IDS,
  PREREQUISITES,
  isUnlocked,
  masteryOf,
  masteryPoints,
  tierFor,
  trainingSteps,
  unlockedGatedIds,
  unmetRequirements,
} from './mastery';

const profile: Profile = { name: 'A', difficulty: 2, seasonDays: 66, startDate: '2026-11-01', equipment: ['outdoor', 'stairs', 'bar'] };
const dates = Array.from({ length: 60 }, (_, i) => `2026-${i < 30 ? '11' : '12'}-${String((i % 30) + 1).padStart(2, '0')}`);

/** Days in the past with `n` done quests of each given exercise (easy optional). */
function history(spec: Record<string, number>, easy = false): Record<string, DayLog> {
  const days: Record<string, DayLog> = {};
  const max = Math.max(0, ...Object.values(spec));
  for (let i = 0; i < max; i++) {
    const date = `2025-0${1 + Math.floor(i / 28)}-${String((i % 28) + 1).padStart(2, '0')}`;
    const quests: QuestInstance[] = Object.entries(spec)
      .filter(([, n]) => i < n)
      .map(([id], j) => ({ id: `${id}-${j}`, templateId: id, title: id, icon: '', attr: 'staerke', amount: 10, unit: 'Wdh.', xp: 30, done: true, ...(easy ? { easy: true } : {}) }));
    days[date] = { date, quests, rerollsUsed: 0 };
  }
  return days;
}
const state = (extra: Partial<GameState> = {}): GameState => ({ ...emptyState(), profile, ...extra });
const lockedAt = (s: GameState) => new Set(GATED_IDS.filter((id) => !isUnlocked(masteryPoints(s.days), id)));

describe('mastery points and tiers', () => {
  it('counts done quests, the easy variant as half, open ones not at all', () => {
    const days = history({ pushups: 4, squats: 2 });
    days['2025-01-01'].quests.push({ ...days['2025-01-01'].quests[0], id: 'x', done: false });
    const easy = history({ lunges: 3 }, true);
    const pts = masteryPoints({ ...days, '2026-01-01': { ...easy['2025-01-01'], date: '2026-01-01' }, '2026-01-02': { ...easy['2025-01-02'], date: '2026-01-02' } });
    expect(pts.pushups).toBe(4);
    expect(pts.squats).toBe(2);
    expect(pts.lunges).toBe(1);
  });

  it('tiers at 3, 10 and 25 points', () => {
    expect([0, 2.5, 3, 9.5, 10, 24, 25, 100].map(tierFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(masteryOf({ pushups: 7 }, 'pushups')).toEqual({ points: 7, tier: 1, next: 10 });
    expect(masteryOf({}, 'pushups')).toEqual({ points: 0, tier: 0, next: 3 });
    expect(masteryOf({ pushups: 30 }, 'pushups').next).toBeNull();
  });

  it('counts past progress retroactively (old saves)', () => {
    const old = { ...state({ days: history({ pushups: 10 }) }) } as Partial<GameState>;
    delete old.seenUnlocks;
    const loaded = normalize(old as GameState);
    expect(randomPool(loaded).map((t) => t.id)).toContain('dips');
  });
});

describe('unlock rules', () => {
  it('every prerequisite is a real exercise, and core quests are never gated', () => {
    for (const [id, reqs] of Object.entries(PREREQUISITES)) {
      expect(QUEST_POOL.some((t) => t.id === id)).toBe(true);
      expect(isCoreQuest(id)).toBe(false);
      for (const r of reqs) expect(QUEST_POOL.some((t) => t.id === r.id)).toBe(true);
    }
  });

  it('free exercises are open from the start, gated ones need their tiers', () => {
    for (const id of ['calves', 'bridge', 'superman', 'legraises', 'lunges', 'pushups']) expect(isUnlocked({}, id)).toBe(true);
    expect(isUnlocked({}, 'dips')).toBe(false);
    expect(isUnlocked({ pushups: 9.5 }, 'dips')).toBe(false);
    expect(isUnlocked({ pushups: 10 }, 'dips')).toBe(true);
    expect(isUnlocked({ plank: 3 }, 'sideplank')).toBe(true);
  });

  it('needs all prerequisites when there are several', () => {
    expect(isUnlocked({ pike: 25 }, 'handstand')).toBe(false);
    expect(isUnlocked({ plank: 25 }, 'handstand')).toBe(false);
    expect(isUnlocked({ pike: 25, plank: 25 }, 'handstand')).toBe(true);
    expect(unmetRequirements({ hollow: 25, dips: 3 }, 'lsit')).toEqual([{ id: 'dips', tier: 2 }]);
    expect(unlockedGatedIds(ALL_MASTERED)).toEqual(GATED_IDS);
  });
});

describe('gate in extras, joker and arena', () => {
  it('a fresh profile never gets a locked extra; custom quests are never gated', () => {
    const custom = makeCustomQuest({ title: 'Seil', icon: 'x', attr: 'ausdauer', amount: 5, unit: 'Min.', daily: false });
    const s = state({ customQuests: [custom] });
    const locked = lockedAt(s);
    expect(locked.size).toBe(GATED_IDS.length);
    for (const date of dates) for (const q of extraQuests(dayFor(s, date, 5))) expect(locked.has(q.templateId)).toBe(false);
    expect(randomPool(s).some((t) => t.id === custom.id)).toBe(true);
  });

  it('mastered prerequisites let the exercise come up', () => {
    const s = state({ days: history({ pushups: 10 }) });
    const seen = new Set(dates.flatMap((d) => extraQuests(dayFor(s, d, 1)).map((q) => q.templateId)));
    expect(seen.has('dips') || seen.has('diamond')).toBe(true);
    expect(seen.has('pike')).toBe(false);
  });

  it('the swap joker only swaps to unlocked exercises', () => {
    const s = state();
    const locked = lockedAt(s);
    for (const date of dates.slice(0, 20)) {
      const day = dayFor(s, date, 1);
      for (const q of extraQuests(day)) {
        const swapped = rerollQuest(day, q.id, 1, 2, randomPool(s));
        expect(locked.has(swapped.quests[day.quests.indexOf(q)].templateId)).toBe(false);
      }
    }
  });

  it('arena enemies and bosses ask for no locked exercise', () => {
    const s = state();
    const locked = lockedAt(s);
    for (const date of dates) {
      for (const b of ensureBattles(s, date, 10).battles) for (const p of b.phases) if (p.exerciseId) expect(locked.has(p.exerciseId)).toBe(false);
    }
  });
});

describe('training goal', () => {
  it('can only be set on a locked exercise, and cleared', () => {
    const s = state();
    expect(setTrainingGoal(s, 'pike').profile?.trainingGoal).toBe('pike');
    expect(setTrainingGoal(s, 'calves')).toBe(s); // not gated
    expect(setTrainingGoal(state({ days: history({ pushups: 10 }) }), 'dips').profile?.trainingGoal).toBeUndefined();
    expect(setTrainingGoal(setTrainingGoal(s, 'pike'), null).profile?.trainingGoal).toBeUndefined();
  });

  it('steps go to the deepest unlockable exercise and skip core quests', () => {
    // pistol <- splitsquat (locked) <- lunges: train lunges
    expect(trainingSteps({}, 'pistol', isCoreQuest)).toEqual(['lunges']);
    // handstand <- pike <- diamond <- pushups (core) and plank (core): nothing to add yet
    expect(trainingSteps({}, 'handstand', isCoreQuest)).toEqual([]);
    // with pushups mastered, diamond is the next step
    expect(trainingSteps({ pushups: 10 }, 'handstand', isCoreQuest)).toEqual(['diamond']);
    // lsit: hollow (locked, needs legraises) and dips (needs pushups, core)
    expect(trainingSteps({}, 'lsit', isCoreQuest)).toEqual(['legraises']);
    expect(trainingSteps({ legraises: 10, pushups: 10 }, 'lsit', isCoreQuest)).toEqual(['hollow', 'dips']);
    expect(trainingSteps(ALL_MASTERED, 'lsit')).toEqual([]);
  });

  it('puts its steps into every new day, deterministically', () => {
    const s = setTrainingGoal(state({ days: history({ legraises: 10, pushups: 10 }) }), 'lsit');
    expect(goalSteps(s).map((t) => t.id)).toEqual(['hollow', 'dips']);
    for (const date of dates) {
      const day = dayFor(s, date, 3);
      const ids = extraQuests(day).map((q) => q.templateId);
      expect(ids).toContain('hollow');
      expect(ids).toContain('dips');
      expect(ids.filter((id) => ['hollow', 'dips'].includes(id)).length).toBeLessThanOrEqual(GOAL_EXTRAS);
      expect(new Set(ids).size).toBe(ids.length);
      expect(dayFor(s, date, 3)).toEqual(day);
    }
    // without a goal, hollow is not in every day
    const free = { ...s, profile: profile };
    expect(dates.every((d) => extraQuests(dayFor(free, d, 3)).some((q) => q.templateId === 'hollow'))).toBe(false);
  });

  it('respects equipment and switched-off exercises', () => {
    const s = setTrainingGoal(state({ days: history({ pullups: 3, legraises: 10 }) }), 'kneeraises');
    expect(goalSteps(s).map((t) => t.id)).toEqual(['pullups']);
    expect(goalSteps({ ...s, profile: { ...s.profile!, equipment: [] } })).toEqual([]);
    expect(goalSteps({ ...s, disabledQuests: ['pullups'] })).toEqual([]);
  });

  it('is cleared once reached and the note is closed', () => {
    const s = setTrainingGoal(state({ days: history({ pushups: 9 }) }), 'dips');
    expect(reachedGoal(s)).toBeNull();
    const after = { ...s, days: { ...s.days, ...history({ pushups: 10 }) } };
    expect(reachedGoal(after)?.id).toBe('dips');
    const closed = acknowledgeUnlocks(after);
    expect(closed.profile?.trainingGoal).toBeUndefined();
    expect(reachedGoal(closed)).toBeNull();
    expect(newlyUnlocked(closed)).toEqual([]);
  });
});

describe('saves and the unlock note', () => {
  it('old saves load: seen unlocks default to what is unlocked now, no note', () => {
    const old = { ...state({ days: history({ pushups: 12, plank: 4 }), seenUnlockLevel: 4 } as Partial<GameState>) } as Partial<GameState>;
    delete old.seenUnlocks;
    const n = normalize(old as GameState);
    expect(n.seenUnlocks.sort()).toEqual(['diamond', 'dips', 'sideplank']);
    expect(newlyUnlocked(n)).toEqual([]);
    expect(n.seenUnlockLevel).toBe(4); // kept, unused
    expect(normalize(emptyState()).seenUnlocks).toEqual([]);
  });

  it('drops an unknown goal from a broken save', () => {
    const n = normalize(state({ profile: { ...profile, trainingGoal: 'nope' } }));
    expect(n.profile?.trainingGoal).toBeUndefined();
    expect(normalize(state({ profile: { ...profile, trainingGoal: 'pike' } })).profile?.trainingGoal).toBe('pike');
  });

  it('shows a new unlock once', () => {
    const s = normalize(state({ days: history({ pushups: 9 }) }));
    expect(newlyUnlocked(s)).toEqual([]);
    const more = { ...s, days: { ...s.days, ...history({ pushups: 10 }) } };
    expect(newlyUnlocked(more).map((t) => t.id).sort()).toEqual(['diamond', 'dips']);
    const seen = acknowledgeUnlocks(more);
    expect(newlyUnlocked(seen)).toEqual([]);
    expect(newlyUnlocked(normalize(JSON.parse(JSON.stringify(seen))))).toEqual([]);
  });

  it('leaves out unlocks the equipment does not allow', () => {
    const s = state({ days: history({ pullups: 3 }), profile: { ...profile, equipment: [] } });
    expect(newlyUnlocked(s).map((t) => t.id)).not.toContain('chinups');
  });
});
