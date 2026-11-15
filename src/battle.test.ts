import { describe, expect, it } from 'vitest';
import {
  BOSSES,
  ENEMIES,
  battleStatus,
  bossAvailable,
  ensureBattles,
  generateBoss,
  generateEnemy,
  hpLeft,
  isComplete,
  logDamage,
  phaseProgress,
  settleBattles,
  undoDamage,
  weekStart,
} from './battle';
import { QUEST_POOL, attributes, autoCompleteFromHealth, emptyState, exerciseTotals, generateDay, totalXp, type GameState } from './game';

const profile = { name: 'A', difficulty: 2 as const, seasonDays: 66, startDate: '2026-11-01' };

describe('enemy roster', () => {
  it('only uses exercises that exist', () => {
    for (const e of [...ENEMIES, ...BOSSES]) {
      for (const m of e.moves) if (m.kind === 'exercise') expect(QUEST_POOL.some((q) => q.id === m.exerciseId)).toBe(true);
    }
    expect(BOSSES.every((b) => b.moves.length === 3)).toBe(true);
  });
});

describe('weeks and bosses', () => {
  it('finds Monday and only spawns bosses Monday to Thursday', () => {
    expect(weekStart('2026-11-15')).toBe('2026-11-09'); // Sunday
    expect(weekStart('2026-11-16')).toBe('2026-11-16'); // Monday
    expect(bossAvailable('2026-11-16')).toBe(true);
    expect(bossAvailable('2026-11-19')).toBe(true); // Thursday
    expect(bossAvailable('2026-11-20')).toBe(false); // Friday
  });

  it('gives a boss until Sunday and an enemy for one day', () => {
    const boss = generateBoss('2026-11-17', 1, 2);
    expect(boss).toMatchObject({ id: 'boss-2026-11-16', start: '2026-11-17', end: '2026-11-22', boss: true });
    const enemy = generateEnemy('2026-11-17', 1, 2);
    expect(enemy).toMatchObject({ start: '2026-11-17', end: '2026-11-17', boss: false });
  });

  it('scales exercise targets with level but steps only with difficulty', () => {
    const low = generateBoss('2026-11-16', 1, 2);
    const high = generateBoss('2026-11-16', 30, 2);
    low.phases.forEach((p, i) => {
      if (p.kind === 'exercise') expect(high.phases[i].target).toBeGreaterThan(p.target);
      else expect(high.phases[i].target).toBe(p.target);
    });
  });

  it('creates each battle only once', () => {
    const s: GameState = { ...emptyState(), profile };
    const once = ensureBattles(s, '2026-11-16', 1);
    expect(once.battles).toHaveLength(2);
    expect(ensureBattles(once, '2026-11-16', 1)).toBe(once);
    expect(ensureBattles({ ...emptyState(), profile }, '2026-11-20', 1).battles).toHaveLength(1);
  });
});

describe('fighting', () => {
  const fresh = () => generateEnemy('2026-11-16', 1, 2);

  it('logs damage only inside the battle window and undoes the last entry', () => {
    const b = fresh();
    const p = b.phases[0];
    const hit = logDamage(b, p.id, '2026-11-16', 5);
    expect(phaseProgress(hit, hit.phases[0], null)).toBe(5);
    expect(logDamage(b, p.id, '2026-11-17', 5)).toBe(b);
    expect(phaseProgress(undoDamage(hit, p.id, '2026-11-16'), b.phases[0], null)).toBe(0);
  });

  it('reads steps and runs from health data when connected', () => {
    const boss = generateBoss('2026-11-16', 1, 2);
    const health = { '2026-11-16': { steps: 30000, runKm: 3 }, '2026-11-23': { steps: 99999, runKm: 99 } };
    const stepsPhase = boss.phases.find((p) => p.kind === 'steps');
    if (stepsPhase) expect(phaseProgress(boss, stepsPhase, health)).toBe(30000);
    const runPhase = boss.phases.find((p) => p.kind === 'run');
    if (runPhase) expect(phaseProgress(boss, runPhase, health)).toBe(3);
  });

  it('awards XP and attribute points once, and takes them back on undo', () => {
    let b = fresh();
    for (const p of b.phases) b = logDamage(b, p.id, '2026-11-16', p.target);
    expect(isComplete(b, null)).toBe(true);
    expect(hpLeft(b, null)).toBe(0);
    let s: GameState = { ...emptyState(), profile, battles: [b] };
    s = settleBattles(s, '2026-11-16');
    expect(s.battles[0].defeatedOn).toBe('2026-11-16');
    expect(settleBattles(s, '2026-11-16')).toBe(s);
    expect(totalXp(s)).toBe(b.xp);
    expect(attributes(s)[b.attr]).toBe(2);
    expect(battleStatus(s.battles[0], '2026-11-20')).toBe('defeated');

    const undone = settleBattles({ ...s, battles: [undoDamage(s.battles[0], b.phases[0].id, '2026-11-16')] }, '2026-11-16');
    expect(undone.battles[0].defeatedOn).toBeUndefined();
    expect(totalXp(undone)).toBe(0);
    expect(battleStatus(undone.battles[0], '2026-11-17')).toBe('escaped');
  });

  it('counts reps against enemies in the exercise totals', () => {
    const b = generateBoss('2026-11-16', 1, 2);
    const p = b.phases.find((x) => x.kind === 'exercise')!;
    const s: GameState = { ...emptyState(), battles: [logDamage(b, p.id, '2026-11-16', 20)] };
    expect(exerciseTotals(s).find((e) => e.templateId === p.exerciseId)?.total).toBe(20);
  });
});

describe('health auto-complete', () => {
  it('ticks off step and run quests that the data covers', () => {
    const day = generateDay('2026-11-16', 1, 2, QUEST_POOL.filter((q) => ['steps', 'run', 'pushups', 'stretch'].includes(q.id)));
    const s: GameState = {
      ...emptyState(),
      days: { [day.date]: day },
      health: { connected: true, days: { '2026-11-16': { steps: 99999, runKm: 0.5 } } },
    };
    const next = autoCompleteFromHealth(s, '2026-11-16');
    const byId = Object.fromEntries(next.days['2026-11-16'].quests.map((q) => [q.templateId, q.done]));
    expect(byId).toEqual({ steps: true, run: false, pushups: false, stretch: false });
    expect(autoCompleteFromHealth({ ...s, health: { ...s.health, connected: false } }, '2026-11-16').days).toBe(s.days);
  });
});

describe('enemy waves', () => {
  it('sends up to three different enemies a day, each after the last falls', async () => {
    const { enemiesOf, currentEnemy } = await import('./battle');
    let s: GameState = ensureBattles({ ...emptyState(), profile }, '2026-11-15', 1);
    expect(enemiesOf(s.battles, '2026-11-15')).toHaveLength(1);
    for (let wave = 1; wave <= 3; wave++) {
      const e = currentEnemy(s.battles, '2026-11-15')!;
      let won = e;
      for (const p of e.phases) won = logDamage(won, p.id, '2026-11-15', p.target);
      s = settleBattles({ ...s, battles: s.battles.map((b) => (b.id === e.id ? won : b)) }, '2026-11-15');
      s = ensureBattles(s, '2026-11-15', 1);
    }
    const list = enemiesOf(s.battles, '2026-11-15');
    expect(list).toHaveLength(3);
    expect(new Set(list.map((b) => b.enemyId)).size).toBe(3);
    expect(list[1].xp).toBeLessThan(list[0].xp);
    expect(list.every((b) => b.defeatedOn)).toBe(true);
  });
});
