import { describe, expect, it } from 'vitest';
import { generateBoss, generateEnemy, ensureBattles, BOSSES } from './battle';
import { QUEST_POOL, emptyState, hasEquipment, randomPool, unavailableReason, type GameState, type Profile } from './game';

const base: Profile = { name: 'A', difficulty: 2, seasonDays: 66, startDate: '2026-11-01' };
const ids = (p: Profile) => randomPool({ customQuests: [], disabledQuests: [], profile: p }).map((q) => q.id);

describe('equipment', () => {
  it('keeps old saves on bodyweight plus outdoor and stairs', () => {
    const pool = ids(base);
    expect(pool).toEqual(expect.arrayContaining(['run', 'stairs', 'pushups']));
    expect(pool).not.toContain('walk'); // replaced by the daily step goal
    expect(pool).not.toContain('steps'); // fixed, never random
    expect(pool).not.toContain('pullups');
    expect(pool).not.toContain('swim');
  });

  it('adds exercises for the gear you have', () => {
    const pool = ids({ ...base, equipment: ['bar', 'dumbbells'] });
    expect(pool).toEqual(expect.arrayContaining(['pullups', 'curls', 'press']));
    expect(pool).not.toContain('run');
    expect(pool).not.toContain('stairs');
  });

  it('treats a gym as having all the small gear', () => {
    const p = { ...base, equipment: ['gym' as const] };
    expect(hasEquipment(p, 'kettlebell')).toBe(true);
    expect(hasEquipment(p, 'pool')).toBe(false);
    expect(ids(p)).toEqual(expect.arrayContaining(['gym', 'swings', 'run']));
  });

  it('leaves out jumping exercises on request and says why', () => {
    const p = { ...base, noJumping: true, equipment: ['rope' as const] };
    expect(ids(p)).not.toContain('jacks');
    expect(ids(p)).not.toContain('rope');
    expect(unavailableReason(QUEST_POOL.find((q) => q.id === 'burpees')!, p)).toBe('Sprungübung');
    expect(unavailableReason(QUEST_POOL.find((q) => q.id === 'swim')!, base)).toBe('Braucht Schwimmbad');
  });
});

describe('enemies adapt to what is possible', () => {
  const pool = randomPool({ customQuests: [], disabledQuests: [], profile: { ...base, equipment: [], noJumping: true } });
  const allowed = new Set(pool.map((q) => q.id));

  it('never asks for impossible exercises', () => {
    for (let d = 1; d <= 28; d++) {
      const date = `2026-11-${String(d).padStart(2, '0')}`;
      for (const b of [generateEnemy(date, 5, 2, pool), generateBoss(date, 5, 2, pool)]) {
        for (const p of b.phases) {
          if (p.kind === 'exercise') expect(allowed.has(p.exerciseId!)).toBe(true);
          expect(p.kind).not.toBe('run'); // no outdoor, no treadmill
          expect(p.target).toBeGreaterThan(0);
        }
      }
    }
    expect(BOSSES.length).toBeGreaterThan(0);
  });

  it('uses the profile when creating battles', () => {
    const s: GameState = { ...emptyState(), profile: { ...base, equipment: [], noJumping: true } };
    const next = ensureBattles(s, '2026-11-16', 1);
    for (const b of next.battles) for (const p of b.phases) if (p.kind === 'exercise') expect(allowed.has(p.exerciseId!)).toBe(true);
  });
});
