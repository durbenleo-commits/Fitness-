import { describe, expect, it } from 'vitest';
import { ensureBattles, generateBoss, generateEnemy } from './battle';
import {
  AUSDAUER_BONUS_FROM,
  CORE_QUEST_IDS,
  EASY_XP_FACTOR,
  QUEST_POOL,
  VARIANTS,
  applyAusdauerBonus,
  applyAusdauerBonusToDay,
  attributes,
  battlePool,
  canSwitchVariant,
  completeQuest,
  dayFor,
  dayXp,
  easyXp,
  emptyState,
  generateDay,
  makeCustomQuest,
  normalize,
  questXp,
  randomPool,
  setQuestVariant,
  templateXp,
  type DayLog,
  type GameState,
  type Profile,
  type QuestInstance,
} from './game';
import { BUILT_IN_PROOF, proofFor, questTarget, scanToAchieved } from './proof';

const profile: Profile = { name: 'A', difficulty: 2, seasonDays: 66, startDate: '2026-11-01' };
const TODAY = '2026-11-17';

const NEW_IDS = [
  'dips',
  'pike',
  'diamond',
  'bridge',
  'legraises',
  'hollow',
  'sideplank',
  'superman',
  'splitsquat',
  'pistol',
  'jumpsquats',
  'handstand',
  'chinups',
  'kneeraises',
  'lsit',
  'calves',
];

const tpl = (id: string) => QUEST_POOL.find((t) => t.id === id)!;

describe('calisthenics exercises', () => {
  it('are all in the pool with the planned values', () => {
    for (const id of NEW_IDS) expect(tpl(id), id).toBeDefined();
    expect(tpl('dips')).toMatchObject({ title: 'Dips', attr: 'staerke', base: 10, step: 1, unit: 'Wdh.', xp: 35 });
    expect(tpl('hollow')).toMatchObject({ unit: 'Sek.', step: 5, base: 20, xp: 30 });
    expect(tpl('sideplank')).toMatchObject({ attr: 'ausdauer', unit: 'Sek.', base: 30 });
    expect(tpl('splitsquat')).toMatchObject({ unit: 'pro Bein', base: 8, xp: 40 });
    expect(tpl('pistol')).toMatchObject({ unit: 'pro Bein', base: 3, xp: 50 });
    expect(tpl('jumpsquats')).toMatchObject({ attr: 'ausdauer', jump: true });
    expect(tpl('chinups').requires).toEqual(['bar']);
    expect(tpl('kneeraises').requires).toEqual(['bar']);
    for (const id of NEW_IDS.filter((x) => !['chinups', 'kneeraises'].includes(x))) expect(tpl(id).requires, id).toBeUndefined();
    for (const id of NEW_IDS.filter((x) => x !== 'jumpsquats')) expect(tpl(id).jump, id).toBeFalsy();
  });

  it('are extras only, never core or fixed', () => {
    for (const id of NEW_IDS) {
      expect(CORE_QUEST_IDS as readonly string[]).not.toContain(id);
      expect(tpl(id).fixed).toBeFalsy();
      expect(tpl(id).retired).toBeFalsy();
    }
    const pool = QUEST_POOL.filter((t) => t.fixed || NEW_IDS.includes(t.id));
    for (let i = 0; i < 20; i++) {
      const day = generateDay(`2026-12-${String(i + 1).padStart(2, '0')}`, 1, 2, pool);
      for (const q of day.quests) if (NEW_IDS.includes(q.templateId)) expect(q.extra).toBe(true);
    }
  });

  it('follow the equipment and jump settings', () => {
    const ids = (p: Profile) => randomPool({ customQuests: [], disabledQuests: [], profile: p }, 99).map((t) => t.id);
    const plain = ids({ ...profile, equipment: [] });
    expect(plain).toContain('dips');
    expect(plain).toContain('jumpsquats');
    expect(plain).not.toContain('chinups');
    expect(plain).not.toContain('kneeraises');
    expect(ids({ ...profile, equipment: ['bar'] })).toEqual(expect.arrayContaining(['chinups', 'kneeraises']));
    expect(ids({ ...profile, equipment: ['gym'] })).toEqual(expect.arrayContaining(['chinups', 'kneeraises']));
    expect(ids({ ...profile, equipment: [], noJumping: true })).not.toContain('jumpsquats');
  });

  it('can be switched off', () => {
    const pool = randomPool({ customQuests: [], disabledQuests: ['dips', 'pistol'], profile }, 99);
    expect(pool.map((t) => t.id)).not.toContain('dips');
    expect(pool.map((t) => t.id)).not.toContain('pistol');
  });

  it('are proven by the camera; split squats and pistols count both legs', () => {
    for (const id of NEW_IDS) {
      expect(BUILT_IN_PROOF[id]).toEqual({ kind: 'camera' });
      const t = tpl(id);
      const p = proofFor({ templateId: id, unit: t.unit, amount: t.base });
      expect(p.kind).toBe('camera');
      if (p.kind === 'camera') expect(p.scanId).toBe(id);
    }
    expect(proofFor({ templateId: 'splitsquat', unit: 'pro Bein', amount: 8 })).toEqual({ kind: 'camera', scanId: 'splitsquat', reps: 16, perUnit: 2 });
    expect(proofFor({ templateId: 'pistol', unit: 'pro Bein', amount: 3 })).toEqual({ kind: 'camera', scanId: 'pistol', reps: 6, perUnit: 2 });
    expect(questTarget({ templateId: 'pistol', unit: 'pro Bein', amount: 3 })).toBe(6);
    expect(scanToAchieved({ templateId: 'pistol', unit: 'pro Bein', amount: 3 }, 12)).toBe(6);
    expect(proofFor({ templateId: 'dips', unit: 'Wdh.', amount: 10 })).toEqual({ kind: 'camera', scanId: 'dips' });
  });

  it('show up in enemies and bosses when the pool only has them', () => {
    const pool = QUEST_POOL.filter((t) => NEW_IDS.includes(t.id) && !t.requires);
    const enemy = generateEnemy(TODAY, 3, 2, pool);
    const boss = generateBoss(TODAY, 3, 2, pool);
    for (const p of [...enemy.phases, ...boss.phases]) {
      if (p.kind === 'exercise') expect(NEW_IDS).toContain(p.exerciseId);
      expect(p.target).toBeGreaterThan(0);
    }
    const easy = generateEnemy(TODAY, 3, 2, pool, 1, [], true);
    for (const p of easy.phases) if (p.kind === 'exercise') expect(p).toMatchObject({ title: VARIANTS[p.exerciseId!], easy: true });
  });

  it('are in the arena pool unless they need missing gear', () => {
    const ids = battlePool({ ...emptyState(), profile: { ...profile, equipment: [] } }, 99).map((t) => t.id);
    expect(ids).toContain('handstand');
    expect(ids).not.toContain('chinups');
    const s = ensureBattles({ ...emptyState(), profile }, TODAY, 1);
    expect(s.battles.length).toBeGreaterThan(0);
  });
});

describe('an easier variant for every exercise', () => {
  it('exists for everything but steps, reading and the retired walk', () => {
    for (const t of QUEST_POOL) {
      if (['steps', 'read', 'walk'].includes(t.id)) expect(VARIANTS[t.id], t.id).toBeUndefined();
      else expect(VARIANTS[t.id], t.id).toBeTruthy();
    }
    expect(VARIANTS.run).toBe('Laufen und Gehen im Wechsel');
    expect(VARIANTS.calves).toBe('Wadenheben mit Halt an der Wand');
  });

  it('keeps the proof of the normal exercise', () => {
    for (const id of ['run', 'stairs', 'bike', 'swim', 'gym', 'rope', 'stretch', 'dips']) {
      const t = tpl(id);
      const q = generateDay(TODAY, 1, 2, [t], [], [], true).quests.find((x) => x.templateId === id);
      if (q) expect(q.easy).toBe(true);
      expect(proofFor({ templateId: id, unit: t.unit, amount: t.base }).kind).toBe(BUILT_IN_PROOF[id].kind);
    }
  });
});

describe('easy variants give less XP', () => {
  it('uses EASY_XP_FACTOR, rounded', () => {
    expect(EASY_XP_FACTOR).toBe(0.7);
    expect(easyXp(30)).toBe(21);
    expect(easyXp(45)).toBe(31); // 45 × 0.7 is 31.499… in floating point
    expect(easyXp(25)).toBe(18);
    expect(templateXp({ xp: 30 })).toBe(30);
    expect(templateXp({ xp: 30 }, true)).toBe(21);
  });

  it('applies to new easy days, also when doing more', () => {
    const day = dayFor({ ...emptyState(), profile: { ...profile, easyVariants: true } }, TODAY, 1);
    const push = day.quests.find((q) => q.templateId === 'pushups')!;
    const steps = day.quests.find((q) => q.templateId === 'steps')!;
    expect(push).toMatchObject({ easy: true, xp: 21 });
    expect(steps.xp).toBe(30);
    const done = completeQuest(day, push.id, push.amount * 2);
    expect(questXp(done.quests.find((q) => q.id === push.id)!)).toBe(42);
  });

  it('keeps the stored XP of easy quests from old saves', () => {
    const old: QuestInstance = { id: 'pushups-1', templateId: 'pushups', title: 'Knie-Liegestütze', icon: '', attr: 'staerke', amount: 12, unit: 'Wdh.', xp: 30, done: true, easy: true };
    const state: GameState = { ...emptyState(), days: { '2026-11-01': { date: '2026-11-01', quests: [old], rerollsUsed: 0 } } };
    const loaded = normalize(JSON.parse(JSON.stringify(state)));
    expect(loaded.days['2026-11-01'].quests[0].xp).toBe(30);
    expect(dayXp(loaded.days['2026-11-01'])).toBe(dayXp(state.days['2026-11-01']));
  });
});

describe('switching one quest between normal and easy', () => {
  const day = (): DayLog => generateDay(TODAY, 2, 2, QUEST_POOL.filter((t) => t.fixed || t.id === 'dips')) // dips from level 2;
  const find = (d: DayLog, id: string) => d.quests.find((q) => q.templateId === id)!;

  it('switches an open quest to easy and back', () => {
    const d = day();
    const push = find(d, 'pushups');
    const easy = setQuestVariant(d, push.id, true);
    expect(find(easy, 'pushups')).toMatchObject({ title: 'Knie-Liegestütze', easy: true, xp: 21, amount: push.amount });
    const back = setQuestVariant(easy, push.id, false);
    expect(find(back, 'pushups')).toEqual(push);
    expect(find(d, 'pushups')).toEqual(push); // pure
    const dips = find(d, 'dips');
    expect(find(setQuestVariant(d, dips.id, true), 'dips')).toMatchObject({ title: 'Dips mit Füßen nah', xp: 25, easy: true });
  });

  it('does nothing when the quest is already that way', () => {
    const d = day();
    expect(setQuestVariant(d, find(d, 'pushups').id, false)).toBe(d);
  });

  it('leaves done quests, started quests and quests without a variant alone', () => {
    const d = day();
    const push = find(d, 'pushups');
    const done = completeQuest(d, push.id);
    expect(setQuestVariant(done, push.id, true)).toBe(done);
    const started: DayLog = { ...d, quests: d.quests.map((q) => (q.id === push.id ? { ...q, achieved: 3 } : q)) };
    expect(setQuestVariant(started, push.id, true)).toBe(started);
    expect(canSwitchVariant(find(started, 'pushups'))).toBe(false);
    const steps = find(d, 'steps');
    expect(canSwitchVariant(steps)).toBe(false);
    expect(setQuestVariant(d, steps.id, true)).toBe(d);
    expect(setQuestVariant(d, 'nope', true)).toBe(d);
  });

  it('leaves custom quests alone', () => {
    const c = { ...makeCustomQuest({ title: 'Eigenes', icon: '', attr: 'staerke', amount: 5, unit: 'Wdh.', daily: true }), id: 'pushups' };
    const d = day();
    expect(canSwitchVariant(find(d, 'pushups'), [c])).toBe(false);
    expect(setQuestVariant(d, find(d, 'pushups').id, true, [c])).toBe(d);
  });
});

describe('Ausdauer-Bonus', () => {
  /** A state with `points` Ausdauer from past days and today's day holding a run quest. */
  function withAusdauer(points: number): GameState {
    const days: Record<string, DayLog> = {};
    for (let i = 0; i < points; i++) {
      const date = `2026-10-${String(i + 1).padStart(2, '0')}`;
      days[date] = { date, rerollsUsed: 0, quests: [{ id: 'plank-1', templateId: 'plank', title: 'Unterarmstütz', icon: '', attr: 'ausdauer', amount: 40, unit: 'Sek.', xp: 30, done: true }] };
    }
    const today = generateDay(TODAY, 1, 2, QUEST_POOL.filter((t) => t.fixed || t.id === 'run'));
    days[TODAY] = today;
    return { ...emptyState(), profile, days };
  }
  const run = (s: GameState) => s.days[TODAY].quests.find((q) => q.templateId === 'run')!;

  it('starts at 25 Ausdauer', () => {
    expect(AUSDAUER_BONUS_FROM).toBe(25);
    const below = withAusdauer(24);
    expect(attributes(below).ausdauer).toBe(24);
    expect(applyAusdauerBonus(below, TODAY)).toBe(below);
    const at = applyAusdauerBonus(withAusdauer(25), TODAY);
    expect(run(at)).toMatchObject({ xp: 56, bonus: true }); // 45 × 1.25
  });

  it('only applies to run quests', () => {
    const s = applyAusdauerBonus(withAusdauer(30), TODAY);
    for (const q of s.days[TODAY].quests) if (q.templateId !== 'run') expect(q.bonus).toBeUndefined();
  });

  it('never applies twice, also not after saving and loading', () => {
    const once = applyAusdauerBonus(withAusdauer(25), TODAY);
    expect(applyAusdauerBonus(once, TODAY)).toBe(once);
    const loaded = normalize(JSON.parse(JSON.stringify(once)));
    expect(run(applyAusdauerBonus(loaded, TODAY)).xp).toBe(56);
    const d = once.days[TODAY];
    expect(applyAusdauerBonusToDay(d, 99)).toBe(d);
  });

  it('leaves done quests and other days alone', () => {
    const s = withAusdauer(25);
    const r = run(s);
    const done: GameState = { ...s, days: { ...s.days, [TODAY]: completeQuest(s.days[TODAY], r.id) } };
    expect(applyAusdauerBonus(done, TODAY)).toBe(done);
    expect(applyAusdauerBonus(s, '2026-12-24')).toBe(s);
  });

  it('works with the easy variant and survives switching', () => {
    const s = withAusdauer(25);
    const easyDay = setQuestVariant(s.days[TODAY], run(s).id, true);
    const easy = applyAusdauerBonus({ ...s, days: { ...s.days, [TODAY]: easyDay } }, TODAY);
    expect(run(easy)).toMatchObject({ easy: true, bonus: true, xp: 39 }); // round(31 × 1.25)
    const normal = setQuestVariant(easy.days[TODAY], run(easy).id, false);
    expect(normal.quests.find((q) => q.templateId === 'run')).toMatchObject({ bonus: true, xp: 56 });
    const again = setQuestVariant(normal, run(easy).id, true);
    expect(again.quests.find((q) => q.templateId === 'run')!.xp).toBe(39);
    expect(templateXp({ xp: 45 }, true, true)).toBe(39);
  });

  it('skips custom quests that reuse the id', () => {
    const s = withAusdauer(25);
    const c = { ...makeCustomQuest({ title: 'Lauf', icon: '', attr: 'ausdauer', amount: 2, unit: 'km', daily: false }), id: 'run' };
    const custom = { ...s, customQuests: [c] };
    expect(applyAusdauerBonus(custom, TODAY)).toBe(custom);
  });
});
