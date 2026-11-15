import { describe, expect, it } from 'vitest';
import { angle, initialScan, scanAmount, step, type Point } from './pose';

/** 33 landmarks, all visible, with some overrides. */
function pose(over: Record<number, readonly [number, number]>, visibility = 1): Point[] {
  const lm: Point[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility }));
  for (const [i, [x, y]] of Object.entries(over)) lm[Number(i)] = { x, y, visibility };
  return lm;
}

// side view, body horizontal; both sides identical
const plankBody = { 11: [0.3, 0.5], 12: [0.3, 0.5], 23: [0.6, 0.52], 24: [0.6, 0.52], 25: [0.75, 0.54], 26: [0.75, 0.54], 27: [0.9, 0.55], 28: [0.9, 0.55] } as const;
const armsStraight = { 13: [0.3, 0.62], 14: [0.3, 0.62], 15: [0.3, 0.74], 16: [0.3, 0.74] } as const;
const armsBent = { 13: [0.2, 0.55], 14: [0.2, 0.55], 15: [0.3, 0.6], 16: [0.3, 0.6] } as const;

function run(exercise: string, frames: Point[][], dtMs = 100) {
  let s = initialScan(exercise);
  frames.forEach((f, i) => (s = step(s, f, i * dtMs)));
  return s;
}

describe('geometry', () => {
  it('measures angles', () => {
    expect(angle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(180);
    expect(angle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(90);
  });
});

describe('push-ups', () => {
  const up = pose({ ...plankBody, ...armsStraight });
  const down = pose({ ...plankBody, ...armsBent });

  it('counts full reps only', () => {
    const s = run('pushups', [up, up, down, down, up, up, down, down, up, up, down, down]);
    expect(s.reps).toBe(2); // the third one never came back up
  });

  it('ignores arm bends while standing', () => {
    const standing = { 11: [0.5, 0.3], 12: [0.5, 0.3], 23: [0.5, 0.6], 24: [0.5, 0.6] } as const;
    const s = run('pushups', [pose({ ...standing, ...armsStraight }), pose({ ...standing, ...armsBent }), pose({ ...standing, ...armsStraight })]);
    expect(s.reps).toBe(0);
  });

  it('does not count when the body is not clearly visible', () => {
    const s = run('pushups', [pose({ ...plankBody, ...armsStraight }, 0.2), pose({ ...plankBody, ...armsBent }, 0.2), pose({ ...plankBody, ...armsStraight }, 0.2)]);
    expect(s.reps).toBe(0);
    expect(s.bodyVisible).toBe(false);
  });
});

describe('squats', () => {
  const stand = pose({ 23: [0.5, 0.5], 24: [0.5, 0.5], 25: [0.5, 0.7], 26: [0.5, 0.7], 27: [0.5, 0.9], 28: [0.5, 0.9] });
  const deep = pose({ 23: [0.3, 0.7], 24: [0.3, 0.7], 25: [0.5, 0.7], 26: [0.5, 0.7], 27: [0.5, 0.9], 28: [0.5, 0.9] });
  it('counts down-and-up cycles', () => {
    const rep = [deep, deep, deep, deep, stand, stand, stand, stand];
    expect(run('squats', [stand, stand, ...rep, ...rep]).reps).toBe(2);
  });
});

describe('jumping jacks', () => {
  const closed = pose({ 11: [0.45, 0.3], 12: [0.55, 0.3], 15: [0.44, 0.5], 16: [0.56, 0.5], 27: [0.48, 0.9], 28: [0.52, 0.9] });
  const open = pose({ 11: [0.45, 0.3], 12: [0.55, 0.3], 15: [0.35, 0.1], 16: [0.65, 0.1], 27: [0.35, 0.9], 28: [0.65, 0.9] });
  it('counts open-close cycles', () => {
    expect(run('jacks', [closed, open, closed, open, closed, open]).reps).toBe(2);
  });
});

describe('holds', () => {
  it('only times the plank while the body is straight', () => {
    const good = pose({ ...plankBody, ...armsStraight });
    const sagging = pose({ ...plankBody, 23: [0.6, 0.7], 24: [0.6, 0.7] });
    const s = run('plank', [...Array(21).fill(good), ...Array(10).fill(sagging)]);
    expect(scanAmount(s)).toBe(2); // 20 good intervals of 100 ms
  });
});
