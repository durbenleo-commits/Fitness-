import { describe, expect, it } from 'vitest';
import { achievementStatus } from './achievements';
import {
  CORE_QUEST_IDS,
  addDailyQuestToDay,
  DAY_CLEAR_BONUS,
  QUEST_POOL,
  VARIANTS,
  allDoubled,
  attributes,
  autoCompleteFromHealth,
  completeQuest,
  currentStreak,
  dayFor,
  dayOutdated,
  dayXp,
  emptyState,
  exerciseTotals,
  extraQuests,
  generateDay,
  fixedQuests,
  isCleared,
  isLegacyDay,
  isSwappable,
  makeCustomQuest,
  normalize,
  questAchieved,
  questXp,
  randomPool,
  rebuildDay,
  requiredQuests,
  rerollQuest,
  setAchieved,
  uncheckQuest,
  type DayLog,
  type GameState,
  type Profile,
  type QuestInstance,
} from './game';
import { questMaxTarget, questTarget, scanToAchieved } from './proof';

const TODAY = '2026-11-17';
const profile: Profile = { name: 'A', difficulty: 2, seasonDays: 66, startDate: '2026-11-01' };
const dates = Array.from({ length: 28 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
const byTemplate = (day: DayLog, id: string) => day.quests.find((q) => q.templateId === id)!;
const doneAll = (day: DayLog, which: (q: QuestInstance) => boolean = () => true): DayLog => ({
  ...day,
  quests: day.quests.map((q) => (which(q) ? { ...q, done: true } : q)),
});

/** A day as saved before extras existed: steps, reading, three random, no flags. */
function legacyDay(date: string): DayLog {
  const ids = ['steps', 'read', 'pushups', 'run', 'stretch'];
  return {
    date,
    rerollsUsed: 0,
    quests: ids.map((id, i) => {
      const t = QUEST_POOL.find((q) => q.id === id)!;
      return { id: `${id}-${i}`, templateId: id, title: t.title, icon: t.icon, attr: t.attr, amount: t.base, unit: t.unit, xp: t.xp, done: false };
    }),
  };
}

describe('day structure: Pflicht and Extra', () => {
  it('has the four core quests in fixed order, reading, then four flagged extras', () => {
    for (const d of dates) {
      const day = dayFor({ ...emptyState(), profile }, d, 1);
      const ids = day.quests.map((q) => q.templateId);
      expect(ids.slice(0, 5)).toEqual([...CORE_QUEST_IDS, 'read']);
      expect(day.quests).toHaveLength(9);
      expect(new Set(ids).size).toBe(9);
      expect(requiredQuests(day).map((q) => q.templateId)).toEqual([...CORE_QUEST_IDS, 'read']);
      const extras = extraQuests(day);
      expect(extras).toHaveLength(4);
      expect(day.quests.slice(5).every((q) => q.extra === true)).toBe(true);
      for (const q of extras) expect([...CORE_QUEST_IDS, 'read', 'walk']).not.toContain(q.templateId);
      // variety: every physical attribute among the extras
      for (const attr of ['staerke', 'ausdauer', 'beweglichkeit']) expect(extras.some((q) => q.attr === attr)).toBe(true);
    }
  });

  it('leaves reading out when it is off, the extras stay the same', () => {
    const on = dayFor({ ...emptyState(), profile }, TODAY, 1);
    const off = dayFor({ ...emptyState(), profile: { ...profile, reading: false } }, TODAY, 1);
    expect(off.quests.map((q) => q.templateId).slice(0, 4)).toEqual([...CORE_QUEST_IDS]);
    expect(off.quests).toHaveLength(8);
    expect(extraQuests(off).map((q) => q.templateId)).toEqual(extraQuests(on).map((q) => q.templateId));
  });

  it('scales core quests: steps by difficulty only, the others by level too', () => {
    const low = generateDay(TODAY, 1, 2);
    const high = generateDay(TODAY, 20, 2);
    expect(byTemplate(low, 'steps').amount).toBe(7000);
    expect(byTemplate(high, 'steps').amount).toBe(7000);
    expect(byTemplate(generateDay(TODAY, 1, 1), 'steps').amount).toBe(4000);
    for (const id of ['pushups', 'squats', 'plank']) {
      expect(byTemplate(high, id).amount).toBeGreaterThan(byTemplate(low, id).amount);
      expect(byTemplate(generateDay(TODAY, 1, 3), id).amount).toBeGreaterThan(byTemplate(low, id).amount);
    }
    expect(byTemplate(low, 'pushups').amount).toBe(12);
  });

  it('extras respect equipment, no jumping and disabled quests; core quests ignore them', () => {
    const p: Profile = { ...profile, equipment: [], noJumping: true };
    const state: GameState = { ...emptyState(), profile: p, disabledQuests: ['pushups', 'squats', 'plank', 'situps'] };
    const allowed = new Set(randomPool(state).map((q) => q.id));
    for (const d of dates) {
      const day = dayFor(state, d, 1);
      expect(day.quests.map((q) => q.templateId).slice(0, 4)).toEqual([...CORE_QUEST_IDS]);
      for (const q of extraQuests(day)) {
        expect(allowed.has(q.templateId)).toBe(true);
        const t = QUEST_POOL.find((x) => x.id === q.templateId)!;
        expect(t.jump).toBeFalsy();
        expect(t.requires).toBeUndefined();
        expect(q.templateId).not.toBe('situps');
      }
    }
  });

  it('hands out easier variants for the core quests', () => {
    const day = dayFor({ ...emptyState(), profile: { ...profile, easyVariants: true } }, TODAY, 1);
    expect(byTemplate(day, 'pushups')).toMatchObject({ title: 'Knie-Liegestütze', easy: true });
    expect(byTemplate(day, 'squats')).toMatchObject({ title: 'Halbe Kniebeugen', easy: true });
    expect(byTemplate(day, 'plank')).toMatchObject({ title: 'Unterarmstütz auf den Knien', easy: true });
    expect(byTemplate(day, 'steps').easy).toBeUndefined();
    const normal = dayFor({ ...emptyState(), profile }, TODAY, 1);
    expect(byTemplate(day, 'pushups').amount).toBe(byTemplate(normal, 'pushups').amount);
    expect(VARIANTS.pushups).toBe('Knie-Liegestütze');
  });

  it('puts daily custom quests on top as required quests', () => {
    const c = makeCustomQuest({ title: 'Wasser', icon: '', attr: 'ausdauer', amount: 3, unit: 'Min.', daily: true });
    const day = dayFor({ ...emptyState(), profile, customQuests: [c] }, TODAY, 1);
    expect(day.quests).toHaveLength(10);
    expect(requiredQuests(day).map((q) => q.templateId)).toContain(c.id);
    expect(isCleared(doneAll(day, (q) => !q.extra && q.templateId !== c.id))).toBe(false);
  });
});

describe('clearing the day', () => {
  it('needs the required quests only, extras are optional', () => {
    const day = generateDay(TODAY, 1, 2);
    const required = doneAll(day, (q) => !q.extra);
    expect(isCleared(required)).toBe(true);
    expect(isCleared(doneAll(day, (q) => !!q.extra))).toBe(false);
    expect(isCleared(doneAll(day, (q) => q.templateId !== 'plank'))).toBe(false);
    // extras still give XP, but no extra clear bonus
    const all = doneAll(day);
    const extraXp = extraQuests(day).reduce((s, q) => s + q.xp, 0);
    expect(dayXp(all)).toBe(dayXp(required) + extraXp);
    expect(dayXp(required)).toBe(requiredQuests(day).reduce((s, q) => s + q.xp, 0) + DAY_CLEAR_BONUS);
    // Disziplin and the streak follow the required quests
    const s: GameState = { ...emptyState(), days: { [TODAY]: required } };
    expect(attributes(s).disziplin).toBe(1);
    expect(currentStreak(s, TODAY)).toBe(1);
  });

  it('keeps old days working: every quest counts as required', () => {
    const old = legacyDay(TODAY);
    expect(isLegacyDay(old)).toBe(true);
    expect(requiredQuests(old)).toHaveLength(5);
    expect(extraQuests(old)).toHaveLength(0);
    expect(isCleared(doneAll(old, (q) => q.templateId !== 'stretch'))).toBe(false);
    expect(isCleared(doneAll(old))).toBe(true);
    const loaded = normalize({ ...emptyState(), days: { [TODAY]: doneAll(old) } });
    expect(isCleared(loaded.days[TODAY])).toBe(true);
    expect(dayXp(loaded.days[TODAY])).toBe(old.quests.reduce((s, q) => s + q.xp, 0) + DAY_CLEAR_BONUS);
  });
});

describe('rebuilding today', () => {
  it('rebuilds untouched old days and days missing a core quest, keeping the used joker', () => {
    const old = { ...legacyDay(TODAY), rerollsUsed: 1 };
    expect(dayOutdated(old, profile)).toBe(true);
    expect(dayOutdated(completeQuest(old, old.quests[2].id), profile)).toBe(false);
    const fresh = dayFor({ ...emptyState(), profile }, TODAY, 1);
    expect(dayOutdated(fresh, profile)).toBe(false);
    const noPlank = { ...fresh, quests: fresh.quests.filter((q) => q.templateId !== 'plank') };
    expect(dayOutdated(noPlank, profile)).toBe(true);
    const state: GameState = { ...emptyState(), profile, days: { [TODAY]: old } };
    const rebuilt = rebuildDay(state, TODAY, 1);
    expect(rebuilt.rerollsUsed).toBe(1);
    expect(extraQuests(rebuilt)).toHaveLength(4);
    expect(dayOutdated(rebuilt, profile)).toBe(false);
  });
});

describe('swap joker', () => {
  it('only swaps open extras, for another extra that is not a core quest', () => {
    const day = dayFor({ ...emptyState(), profile }, TODAY, 1);
    for (const q of requiredQuests(day)) {
      expect(isSwappable(day, q)).toBe(false);
      expect(rerollQuest(day, q.id, 1, 2)).toBe(day);
    }
    const extra = extraQuests(day)[0];
    expect(isSwappable(day, extra)).toBe(true);
    const done = completeQuest(day, extra.id);
    expect(isSwappable(done, done.quests.find((q) => q.id === extra.id)!)).toBe(false);
    const swapped = rerollQuest(day, extra.id, 1, 2, randomPool({ ...emptyState(), profile }));
    const idx = day.quests.indexOf(extra);
    expect(swapped.quests[idx].extra).toBe(true);
    expect(swapped.quests[idx].templateId).not.toBe(extra.templateId);
    expect(CORE_QUEST_IDS as readonly string[]).not.toContain(swapped.quests[idx].templateId);
    expect(new Set(swapped.quests.map((q) => q.templateId)).size).toBe(9);
  });

  it('keeps the old rule on old days', () => {
    const old = legacyDay(TODAY);
    expect(isSwappable(old, old.quests[0])).toBe(false); // steps
    expect(isSwappable(old, old.quests[1])).toBe(false); // reading
    expect(isSwappable(old, old.quests[2])).toBe(true); // pushups was random back then
    expect(rerollQuest(old, old.quests[3].id, 1, 2).rerollsUsed).toBe(1);
  });
});

describe('doing up to double', () => {
  const day = generateDay(TODAY, 1, 2);
  const push = byTemplate(day, 'pushups'); // 12 Wdh., 30 XP

  it('scales XP from 1× to a 2× cap', () => {
    expect(questXp(push)).toBe(0);
    const at = (n?: number) => completeQuest(day, push.id, n).quests.find((q) => q.id === push.id)!;
    expect(at()).toMatchObject({ done: true, achieved: 12 });
    expect(questXp(at())).toBe(30);
    expect(questXp(at(18))).toBe(45);
    expect(questXp(at(24))).toBe(60);
    expect(at(100).achieved).toBe(24); // capped at 2×
    expect(questXp(at(100))).toBe(60);
    expect(at(5).achieved).toBe(12); // never below the amount once done
    // missing value on a done quest counts as the amount
    expect(questXp({ ...push, done: true })).toBe(30);
    expect(questAchieved({ ...push, done: true })).toBe(12);
    expect(questAchieved(push)).toBe(0);
  });

  it('upgrades a done quest but never lowers it, and unchecking resets it', () => {
    const once = completeQuest(day, push.id, 15);
    const more = completeQuest(once, push.id, 20);
    expect(more.quests.find((q) => q.id === push.id)!.achieved).toBe(20);
    expect(completeQuest(more, push.id, 16)).toBe(more);
    expect(completeQuest(more, push.id)).toBe(more);
    const undone = uncheckQuest(more, push.id);
    const q = undone.quests.find((x) => x.id === push.id)!;
    expect(q.done).toBe(false);
    expect(q.achieved).toBeUndefined();
    // setAchieved may lower (corrections), but stays within amount..2×
    expect(setAchieved(more, push.id, 13).quests.find((x) => x.id === push.id)!.achieved).toBe(13);
    expect(setAchieved(more, push.id, 1).quests.find((x) => x.id === push.id)!.achieved).toBe(12);
    expect(setAchieved(day, push.id, 20)).toBe(day); // open quests stay open
  });

  it('gives a bonus attribute point at 2× and sums XP and totals by what was done', () => {
    const normal = completeQuest(day, push.id);
    const double = completeQuest(day, push.id, 24);
    const st = (d: DayLog): GameState => ({ ...emptyState(), days: { [d.date]: d } });
    expect(attributes(st(normal)).staerke).toBe(1);
    expect(attributes(st(double)).staerke).toBe(2);
    expect(attributes(st(completeQuest(day, push.id, 23))).staerke).toBe(1);
    expect(dayXp(double) - dayXp(normal)).toBe(30);
    expect(exerciseTotals(st(double)).find((e) => e.templateId === 'pushups')!.total).toBe(24);
  });

  it('tracks health values as achieved, only upwards', () => {
    const base: GameState = {
      ...emptyState(),
      days: { [TODAY]: day },
      health: { connected: true, days: { [TODAY]: { steps: 5000, runKm: 0 } } },
    };
    const steps = (s: GameState) => byTemplate(s.days[TODAY], 'steps');
    expect(autoCompleteFromHealth(base, TODAY)).toBe(base); // below the goal
    const sync = (s: GameState, n: number) => autoCompleteFromHealth({ ...s, health: { ...s.health, days: { [TODAY]: { steps: n, runKm: 0 } } } }, TODAY);
    const a = sync(base, 8000);
    expect(steps(a)).toMatchObject({ done: true, achieved: 8000 });
    const b = sync(a, 11000);
    expect(steps(b).achieved).toBe(11000);
    const c = sync(b, 30000);
    expect(steps(c).achieved).toBe(14000);
    expect(questXp(steps(c))).toBe(60);
    expect(sync(c, 9000).days).toBe(c.days); // never lower
    expect(sync(c, 30000).days).toBe(c.days); // nothing new: days unchanged
    expect(autoCompleteFromHealth(c, TODAY)).toBe(c);
  });
});

describe('scanner targets for up to double', () => {
  it('doubles camera, presence and stretch targets and converts back', () => {
    const push = { templateId: 'pushups', unit: 'Wdh.', amount: 12 };
    expect(questTarget(push)).toBe(12);
    expect(questMaxTarget(push)).toBe(24);
    expect(scanToAchieved(push, 20)).toBe(20);
    const lunges = { templateId: 'lunges', unit: 'pro Bein', amount: 10 };
    expect(questTarget(lunges)).toBe(20);
    expect(questMaxTarget(lunges)).toBe(40);
    expect(scanToAchieved(lunges, 30)).toBe(15);
    const stretch = { templateId: 'stretch', unit: 'Min.', amount: 8 };
    expect(questTarget(stretch)).toBe(480);
    expect(questMaxTarget(stretch)).toBe(960);
    expect(scanToAchieved(stretch, 720)).toBe(12);
    const rope = { templateId: 'rope', unit: 'Min.', amount: 3 };
    expect(questMaxTarget(rope)).toBe(360);
    expect(scanToAchieved(rope, 270)).toBe(4.5);
    const plank = { templateId: 'plank', unit: 'Sek.', amount: 40 };
    expect(questMaxTarget(plank)).toBe(80);
    expect(scanToAchieved(plank, 60)).toBe(60);
    const custom = makeCustomQuest({ title: 'X', icon: '', attr: 'staerke', amount: 20, unit: 'Wdh.', daily: false });
    const cq = { templateId: custom.id, unit: 'Wdh.', amount: 20 };
    expect(questTarget(cq, [custom])).toBe(60); // 3 s per rep
    expect(scanToAchieved(cq, 90, [custom])).toBe(30);
    expect(questMaxTarget({ templateId: 'steps', unit: 'Schritte', amount: 7000 })).toBe(14000);
    expect(questMaxTarget({ templateId: 'read', unit: 'Seiten', amount: 10 })).toBe(20);
    expect(scanToAchieved(push, 0)).toBe(0);
  });
});

describe('double achievements', () => {
  it('unlocks Doppelt hält besser, Übererfüller and Alles gegeben', () => {
    const status = (s: GameState) => Object.fromEntries(achievementStatus(s, TODAY).map((a) => [a.achievement.id, a]));
    const day = generateDay(TODAY, 1, 2);
    let d = completeQuest(day, byTemplate(day, 'pushups').id, 24);
    let s: GameState = { ...emptyState(), days: { [TODAY]: d } };
    expect(status(s)['double-1']).toMatchObject({ unlocked: true });
    expect(status(s)['double-1'].achievement).toMatchObject({ title: 'Doppelt hält besser', tier: 'bronze' });
    expect(status(s)['double-25']).toMatchObject({ unlocked: false, value: 1 });
    expect(status(s)['double-25'].achievement).toMatchObject({ title: 'Übererfüller', tier: 'silver' });
    expect(status(s)['double-day']).toMatchObject({ unlocked: false });
    for (const q of requiredQuests(d)) d = completeQuest(d, q.id, q.amount * 2);
    expect(allDoubled(d)).toBe(true);
    expect(allDoubled(completeQuest(day, byTemplate(day, 'pushups').id, 24))).toBe(false);
    s = { ...emptyState(), days: { [TODAY]: d } };
    expect(status(s)['double-day']).toMatchObject({ unlocked: true });
    expect(status(s)['double-day'].achievement).toMatchObject({ title: 'Alles gegeben', tier: 'gold' });
    // 25 doubled quests over several days
    const days: GameState['days'] = {};
    for (const date of dates.slice(0, 5)) {
      let x = generateDay(date, 1, 2);
      for (const q of x.quests) x = completeQuest(x, q.id, q.amount * 2);
      days[date] = x;
    }
    expect(status({ ...emptyState(), days })['double-25']).toMatchObject({ unlocked: true });
  });
});

describe('new day without extras', () => {
  const day = generateDay('2026-03-01', 1, 2, [], [], fixedQuests(null));
  it('has no extras but is not legacy', () => {
    expect(extraQuests(day)).toHaveLength(0);
    expect(isLegacyDay(day)).toBe(false);
  });
  it('never swaps core quests, even with a non-daily custom quest', () => {
    const custom = makeCustomQuest({ title: 'Test', icon: 'dumbbell', attr: 'staerke', unit: 'reps', amount: 10, daily: false });
    for (const q of day.quests) {
      expect(isSwappable(day, q, [custom])).toBe(false);
      expect(rerollQuest(day, q.id, 1, 2, QUEST_POOL, false, [custom])).toBe(day);
    }
  });
  it('is not outdated, and is cleared by the core quests alone', () => {
    expect(dayOutdated(day, null)).toBe(false);
    const done = { ...day, quests: day.quests.map((q) => ({ ...q, done: true })) };
    expect(isCleared(done)).toBe(true);
  });
  it('a day with old-style quests is still legacy', () => {
    const old = { ...day, quests: day.quests.filter((q) => q.templateId === 'steps') };
    expect(isLegacyDay(old)).toBe(true);
  });
});

describe('normalize achieved', () => {
  it('drops broken values and clamps the rest', () => {
    const base = generateDay('2026-03-01', 1, 2);
    const q = base.quests;
    const bad = { ...base, quests: [
      { ...q[0], done: true, achieved: Number.NaN },
      { ...q[1], done: true, achieved: 'x' as unknown as number },
      { ...q[2], done: true, achieved: q[2].amount * 10 },
      { ...q[3], done: true, achieved: -5 },
    ] };
    const out = normalize({ ...emptyState(), days: { [bad.date]: bad } }).days[bad.date].quests;
    expect('achieved' in out[0]).toBe(false);
    expect('achieved' in out[1]).toBe(false);
    expect(out[2].achieved).toBe(q[2].amount * 2);
    expect(out[3].achieved).toBe(0);
    for (const x of out) expect(Number.isFinite(questXp(x))).toBe(true);
  });
});

describe('addDailyQuestToDay', () => {
  const t = makeCustomQuest({ title: 'Daily', icon: 'dumbbell', attr: 'staerke', unit: 'reps', amount: 10, daily: true });
  const day = generateDay('2026-03-01', 1, 2);
  it('adds to an open day', () => {
    expect(addDailyQuestToDay(day, t, 2).quests).toHaveLength(day.quests.length + 1);
  });
  it('keeps a cleared day cleared', () => {
    const done = { ...day, quests: day.quests.map((q) => ({ ...q, done: true })) };
    const out = addDailyQuestToDay(done, t, 2);
    expect(out).toBe(done);
    expect(isCleared(out)).toBe(true);
  });
});
