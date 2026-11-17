import { describe, expect, it } from 'vitest';
import { ensureBattles, generateBoss, generateEnemy, phaseProgress, type Battle } from './battle';
import {
  QUEST_POOL,
  VARIANTS,
  autoCompleteFromHealth,
  completeQuest,
  emptyState,
  generateDay,
  isTrackedQuest,
  makeCustomQuest,
  normalize,
  rerollQuest,
  uncheckQuest,
  type GameState,
  type QuestInstance,
} from './game';
import { SCANNABLE } from './pose';
import { BUILT_IN_PROOF, healthProgress, metricValue, phaseProof, proofFor, scanTarget, scanToAmount } from './proof';

const profile = { name: 'A', difficulty: 2 as const, seasonDays: 66, startDate: '2026-11-01' };
const q = (templateId: string, amount: number, unit = 'Min.') => ({ templateId, amount, unit });

describe('proof per quest', () => {
  it('maps every built-in exercise, and every camera exercise is scannable', () => {
    for (const t of QUEST_POOL) {
      expect(BUILT_IN_PROOF[t.id]).toBeDefined();
      const p = proofFor({ templateId: t.id, unit: t.unit, amount: t.base });
      if (p.kind === 'camera') expect(SCANNABLE[p.scanId]).toBeDefined();
    }
  });

  it('uses health data for steps, runs, cycling, swimming, stairs and gym', () => {
    expect(proofFor(q('steps', 7000, 'Schritte'))).toEqual({ kind: 'health', metric: 'steps' });
    expect(proofFor(q('run', 2, 'km'))).toEqual({ kind: 'health', metric: 'runKm' });
    expect(proofFor(q('bike', 20))).toEqual({ kind: 'health', metric: 'bikeMin' });
    expect(proofFor(q('swim', 20))).toEqual({ kind: 'health', metric: 'swimMin' });
    expect(proofFor(q('stairs', 6, 'Stockwerke'))).toEqual({ kind: 'health', metric: 'floors' });
    expect(proofFor(q('gym', 30))).toEqual({ kind: 'health', metric: 'strengthMin' });
  });

  it('uses the camera counter for reps and holds', () => {
    for (const id of ['pushups', 'squats', 'lunges', 'jacks', 'pullups', 'plank', 'wallsit', 'situps', 'curls', 'press', 'rows', 'swings', 'burpees', 'mountain']) {
      expect(proofFor(q(id, 10, 'Wdh.'))).toEqual({ kind: 'camera', scanId: id });
    }
  });

  it('checks stretching with the pose routine, in seconds', () => {
    expect(proofFor(q('stretch', 8))).toEqual({ kind: 'camera', scanId: 'stretch', seconds: 480 });
    expect(proofFor(q('mobility', 10))).toEqual({ kind: 'camera', scanId: 'stretch', seconds: 600 });
    expect(proofFor(q('hips', 5))).toEqual({ kind: 'camera', scanId: 'stretch', seconds: 300 });
    expect(proofFor(q('bandstretch', 8))).toEqual({ kind: 'camera', scanId: 'stretch', seconds: 480 });
  });

  it('proves reading with a page photo', () => {
    expect(proofFor(q('read', 10, 'Seiten'))).toEqual({ kind: 'photo' });
  });

  it('times rope skipping and the retired walk in seconds', () => {
    expect(proofFor(q('rope', 3))).toEqual({ kind: 'presence', seconds: 180 });
    expect(proofFor(q('walk', 20))).toEqual({ kind: 'presence', seconds: 1200 });
  });

  it('judges custom quests by their unit', () => {
    const make = (unit: string, amount: number) => makeCustomQuest({ title: 'X', icon: '', attr: 'ausdauer', amount, unit, daily: false });
    const cases: [string, number, unknown][] = [
      ['Schritte', 3000, { kind: 'health', metric: 'steps' }],
      ['Min.', 10, { kind: 'presence', seconds: 600 }],
      ['Sek.', 45, { kind: 'presence', seconds: 45 }],
      ['Wdh.', 20, { kind: 'presence', seconds: 60 }],
      ['Sätze', 3, { kind: 'presence', seconds: 180 }],
      ['km', 2, { kind: 'health', metric: 'runKm' }],
    ];
    for (const [unit, amount, want] of cases) {
      const t = make(unit, amount);
      expect(proofFor({ templateId: t.id, unit: t.unit, amount }, [t])).toEqual(want);
    }
    // a custom quest named like a built-in id still counts as custom
    const clash = { ...make('Wdh.', 10), id: 'pushups' };
    expect(proofFor({ templateId: 'pushups', unit: 'Wdh.', amount: 10 }, [clash])).toEqual({ kind: 'presence', seconds: 30 });
    // a deleted custom quest falls back to its unit
    expect(proofFor({ templateId: 'custom-gone', unit: 'Min.', amount: 2 })).toEqual({ kind: 'presence', seconds: 120 });
  });

  it('doubles the camera target for lunges pro Bein, curls stay as they are', () => {
    const lunges = proofFor(q('lunges', 10, 'pro Bein'));
    expect(lunges).toEqual({ kind: 'camera', scanId: 'lunges', reps: 20, perUnit: 2 });
    expect(scanTarget(lunges as never, 10)).toBe(20);
    expect(scanToAmount(lunges as never, 20)).toBe(10);
    expect(scanToAmount(lunges as never, 7)).toBe(3.5);
    expect(phaseProof({ kind: 'exercise', exerciseId: 'lunges', unit: 'pro Bein', target: 12 }, 5)).toMatchObject({ reps: 10, perUnit: 2 });
    const curls = proofFor(q('curls', 12, 'pro Arm'));
    expect(curls).toEqual({ kind: 'camera', scanId: 'curls' });
    expect(scanTarget(curls as never, 12)).toBe(12);
    expect(scanToAmount(curls as never, 12)).toBe(12);
  });

  it('gives arena moves a proof too', () => {
    expect(phaseProof({ kind: 'steps', unit: 'Schritte', target: 6000 })).toEqual({ kind: 'health', metric: 'steps' });
    expect(phaseProof({ kind: 'run', unit: 'km', target: 2 })).toEqual({ kind: 'health', metric: 'runKm' });
    expect(phaseProof({ kind: 'exercise', exerciseId: 'squats', unit: 'Wdh.', target: 30 })).toEqual({ kind: 'camera', scanId: 'squats' });
    expect(phaseProof({ kind: 'exercise', exerciseId: 'stretch', unit: 'Min.', target: 10 }, 4)).toEqual({ kind: 'camera', scanId: 'stretch', seconds: 240 });
  });

  it('reports the health value already reached', () => {
    const days = { '2026-11-16': { steps: 5000, runKm: 1, bikeMin: 12 } };
    expect(healthProgress(q('bike', 20), days, '2026-11-16')).toBe(12);
    expect(healthProgress(q('swim', 20), days, '2026-11-16')).toBe(0); // missing field
    expect(healthProgress(q('swim', 20), days, '2026-11-17')).toBe(0); // missing day
    expect(healthProgress(q('pushups', 20, 'Wdh.'), days, '2026-11-16')).toBeNull();
    expect(metricValue(undefined, 'steps')).toBe(0);
    expect(isTrackedQuest('gym')).toBe(true);
    expect(isTrackedQuest('pushups')).toBe(false);
  });
});

describe('health auto-complete for every health quest', () => {
  const quest = (templateId: string, amount: number, unit: string): QuestInstance => ({
    id: `${templateId}-0`,
    templateId,
    title: templateId,
    icon: '',
    attr: 'ausdauer',
    amount,
    unit,
    xp: 30,
    done: false,
  });

  it('ticks off cycling, swimming, stairs, gym and custom step quests', () => {
    const custom = makeCustomQuest({ title: 'Abendrunde', icon: '', attr: 'ausdauer', amount: 3000, unit: 'Schritte', daily: true });
    const customMin = makeCustomQuest({ title: 'Yoga', icon: '', attr: 'beweglichkeit', amount: 1, unit: 'Min.', daily: true });
    const quests = [
      quest('bike', 20, 'Min.'),
      quest('swim', 20, 'Min.'),
      quest('stairs', 6, 'Stockwerke'),
      quest('gym', 30, 'Min.'),
      quest('run', 2, 'km'),
      quest('stretch', 1, 'Min.'),
      { ...quest(custom.id, 3000, 'Schritte') },
      { ...quest(customMin.id, 1, 'Min.') },
    ];
    const s: GameState = {
      ...emptyState(),
      customQuests: [custom, customMin],
      days: { '2026-11-16': { date: '2026-11-16', quests, rerollsUsed: 0 } },
      health: { connected: true, days: { '2026-11-16': { steps: 3500, runKm: 1.5, bikeMin: 25, swimMin: 19, floors: 6, strengthMin: 30 } } },
    };
    const done = Object.fromEntries(autoCompleteFromHealth(s, '2026-11-16').days['2026-11-16'].quests.map((x) => [x.templateId, x.done]));
    expect(done).toEqual({ bike: true, swim: false, stairs: true, gym: true, run: false, stretch: false, [custom.id]: true, [customMin.id]: false });
  });

  it('reads cycling minutes for health-backed arena moves', () => {
    let b: Battle = generateEnemy('2026-11-16', 1, 2);
    b = { ...b, phases: [{ id: 'p0', kind: 'exercise', exerciseId: 'bike', title: 'Radfahren', icon: '', unit: 'Min.', target: 20, log: [] }] };
    expect(phaseProgress(b, b.phases[0], { '2026-11-16': { steps: 0, runKm: 0, bikeMin: 21 } })).toBe(21);
    expect(phaseProgress(b, b.phases[0], null)).toBe(0);
  });
});

describe('completing quests', () => {
  it('completes and unchecks one quest, leaving the rest', () => {
    const day = generateDay('2026-11-16', 1, 2);
    const id = day.quests[1].id;
    const done = completeQuest(day, id);
    expect(done.quests.map((x) => x.done)).toEqual([false, true, false, false, false, false, false, false, false]);
    expect(completeQuest(done, id)).toBe(done);
    expect(completeQuest(day, 'nope')).toBe(day);
    const undone = uncheckQuest(done, id);
    expect(undone.quests.every((x) => !x.done)).toBe(true);
    expect(uncheckQuest(undone, id)).toBe(undone);
    expect(day.quests[1].done).toBe(false); // pure
  });
});

describe('easier variants', () => {
  const pool = QUEST_POOL.filter((t) => ['steps', 'pushups', 'plank', 'stretch', 'run'].includes(t.id));

  it('hands out variant titles with the same amount and XP', () => {
    const normal = generateDay('2026-11-16', 5, 2, pool);
    const easy = generateDay('2026-11-16', 5, 2, pool, [], undefined, true);
    expect(easy.quests.map((x) => x.templateId)).toEqual(normal.quests.map((x) => x.templateId));
    easy.quests.forEach((x, i) => {
      expect(x.amount).toBe(normal.quests[i].amount);
      expect(x.xp).toBe(normal.quests[i].xp);
      if (VARIANTS[x.templateId]) expect(x).toMatchObject({ title: VARIANTS[x.templateId], easy: true });
      else expect(x.easy).toBeUndefined();
    });
    expect(easy.quests.some((x) => x.easy)).toBe(true);
    expect(normal.quests.some((x) => x.easy)).toBe(false);
  });

  it('keeps the variant on reroll', () => {
    const p = QUEST_POOL.filter((t) => ['steps', 'pushups', 'squats', 'stretch', 'jacks'].includes(t.id));
    const day = generateDay('2026-11-16', 1, 2, p, [], undefined, true);
    const strength = day.quests.find((x) => x.attr === 'staerke')!;
    const next = rerollQuest(day, strength.id, 1, 2, p, true);
    const swapped = next.quests.find((x) => x.attr === 'staerke' && x.templateId !== strength.templateId)!;
    expect(swapped).toMatchObject({ title: VARIANTS[swapped.templateId], easy: true });
  });

  it('gives enemies and bosses variant moves when the profile asks for it', () => {
    const s = ensureBattles({ ...emptyState(), profile: { ...profile, easyVariants: true } }, '2026-11-16', 1);
    const phases = s.battles.flatMap((b) => b.phases).filter((p) => p.kind === 'exercise' && VARIANTS[p.exerciseId!]);
    expect(phases.length).toBeGreaterThan(0);
    for (const p of phases) expect(p).toMatchObject({ title: VARIANTS[p.exerciseId!], easy: true });
    const normal = generateBoss('2026-11-16', 1, 2);
    const easy = generateBoss('2026-11-16', 1, 2, QUEST_POOL, true);
    expect(easy.phases.map((p) => p.target)).toEqual(normal.phases.map((p) => p.target));
    expect(normal.phases.some((p) => p.easy)).toBe(false);
  });

  it('keeps variant titles when loading a save, and fixes normal ones', () => {
    const day = generateDay('2026-11-16', 1, 2, pool, [], undefined, true);
    const plain = generateDay('2026-11-17', 1, 2, pool);
    plain.quests = plain.quests.map((x) => ({ ...x, title: 'Alter Name' }));
    const boss = generateBoss('2026-11-16', 1, 2, QUEST_POOL, true);
    const loaded = normalize({ ...emptyState(), days: { [day.date]: day, [plain.date]: plain }, battles: [boss] });
    expect(loaded.days[day.date].quests.map((x) => x.title)).toEqual(day.quests.map((x) => x.title));
    expect(loaded.days[plain.date].quests.map((x) => x.title)).toEqual(generateDay('2026-11-17', 1, 2, pool).quests.map((x) => x.title));
    expect(loaded.battles[0].phases.map((p) => p.title)).toEqual(boss.phases.map((p) => p.title));
  });

  it('fills the new health fields for old saves', () => {
    const old = { ...emptyState(), health: { connected: true, days: { '2026-11-16': { steps: 100, runKm: 1 } } } } as GameState;
    expect(normalize(old).health.days['2026-11-16']).toEqual({ steps: 100, runKm: 1, bikeMin: 0, swimMin: 0, floors: 0, strengthMin: 0 });
  });
});
