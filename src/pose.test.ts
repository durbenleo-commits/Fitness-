import { describe, expect, it } from 'vitest';
import { SCANNABLE, STRETCH, STRETCH_POSES, STRETCH_POSE_MS, angle, initialScan, scanAmount, step, type Point, type ScanState } from './pose';

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

// ---------- added exercises, easier variants, presence mode ----------

const both = (pts: Record<string, readonly [number, number]>) => {
  // the same point for the left and the right side: { shoulder: [x, y] } → { 11: .., 12: .. }
  const idx: Record<string, [number, number]> = { shoulder: [11, 12], elbow: [13, 14], wrist: [15, 16], hip: [23, 24], knee: [25, 26], ankle: [27, 28], nose: [0, 0] };
  const out: Record<number, readonly [number, number]> = {};
  for (const [k, p] of Object.entries(pts)) for (const i of idx[k]) out[i] = p;
  return out;
};
const times = (f: Point[], n: number) => Array<Point[]>(n).fill(f);
const cycle = (a: Point[], b: Point[], reps: number, n = 4) => [...times(a, n), ...Array.from({ length: reps }, () => [...times(b, n), ...times(a, n)]).flat()];
const runEasy = (exercise: string, frames: Point[][], easy: boolean) => {
  let s = initialScan(exercise);
  frames.forEach((f, i) => (s = step(s, f, i * 100, 1, easy)));
  return s;
};

describe('sit-ups', () => {
  const lying = pose(both({ shoulder: [0.2, 0.8], hip: [0.5, 0.8], knee: [0.65, 0.7] }));
  const up = pose(both({ shoulder: [0.5, 0.5], hip: [0.5, 0.8], knee: [0.65, 0.7] }));
  const half = pose(both({ shoulder: [0.285, 0.59], hip: [0.5, 0.8], knee: [0.65, 0.7] })); // hip angle ~102

  it('counts sitting up and lying back', () => {
    expect(run('situps', cycle(lying, up, 3)).reps).toBe(3);
  });
  it('counts half sit-ups only in easy mode', () => {
    expect(runEasy('situps', cycle(lying, half, 2, 5), false).reps).toBe(0);
    expect(runEasy('situps', cycle(lying, half, 2, 5), true).reps).toBe(2);
  });
  it('ignores bowing forward while standing', () => {
    const stand = pose(both({ shoulder: [0.5, 0.2], hip: [0.5, 0.5], knee: [0.5, 0.7] }));
    const bow = pose(both({ shoulder: [0.3, 0.6], hip: [0.5, 0.5], knee: [0.5, 0.7] })); // hip angle ~63°
    expect(run('situps', cycle(stand, bow, 2)).reps).toBe(0);
  });
});

describe('curls', () => {
  const body = { shoulder: [0.5, 0.3], hip: [0.5, 0.6], elbow: [0.5, 0.45] } as const;
  const straight = pose(both({ ...body, wrist: [0.5, 0.6] }));
  const curled = pose(both({ ...body, wrist: [0.45, 0.33] }));
  it('counts a rep when the arm straightens again', () => {
    expect(run('curls', cycle(straight, curled, 2)).reps).toBe(2);
    expect(run('curls', [...times(straight, 4), ...times(curled, 4)]).reps).toBe(0);
  });
  it('needs an upright body', () => {
    const bent = { shoulder: [0.3, 0.5], hip: [0.6, 0.55], elbow: [0.3, 0.6] } as const;
    const s = run('curls', cycle(pose(both({ ...bent, wrist: [0.3, 0.7] })), pose(both({ ...bent, wrist: [0.25, 0.52] })), 2));
    expect(s.reps).toBe(0);
  });
});

describe('shoulder press', () => {
  const head = { nose: [0.5, 0.2] } as const;
  const shoulders = { 11: [0.45, 0.3], 12: [0.55, 0.3] } as const;
  const start = pose({ ...both(head), ...shoulders, 15: [0.42, 0.35], 16: [0.58, 0.35] });
  const pressed = pose({ ...both(head), ...shoulders, 15: [0.42, 0.1], 16: [0.58, 0.1] });
  const half = pose({ ...both(head), ...shoulders, 15: [0.42, 0.25], 16: [0.58, 0.25] });
  it('counts a press when the hands come back down', () => {
    expect(run('press', cycle(start, pressed, 2, 2)).reps).toBe(2);
  });
  it('does not count half presses', () => {
    expect(run('press', cycle(start, half, 3, 2)).reps).toBe(0);
  });
});

describe('band rows', () => {
  const extended = pose(both({ shoulder: [0.4, 0.4], elbow: [0.55, 0.45], wrist: [0.7, 0.5] }));
  const pulled = pose(both({ shoulder: [0.4, 0.4], elbow: [0.3, 0.45], wrist: [0.4, 0.48] }));
  it('counts a rep on extension', () => {
    expect(run('rows', cycle(extended, pulled, 3)).reps).toBe(3);
  });
  it('needs the hands below the shoulders', () => {
    const ext = pose(both({ shoulder: [0.4, 0.6], elbow: [0.4, 0.45], wrist: [0.4, 0.3] }));
    const pull = pose(both({ shoulder: [0.4, 0.6], elbow: [0.28, 0.6], wrist: [0.38, 0.52] }));
    expect(run('rows', cycle(ext, pull, 2)).reps).toBe(0);
  });
});

describe('Australian pull-ups (easy pull-ups)', () => {
  const ext = pose(both({ shoulder: [0.4, 0.6], elbow: [0.4, 0.45], wrist: [0.4, 0.3] }));
  const pull = pose(both({ shoulder: [0.4, 0.6], elbow: [0.28, 0.6], wrist: [0.38, 0.52] }));
  it('count on the elbow angle only in easy mode', () => {
    expect(runEasy('pullups', cycle(ext, pull, 2), true).reps).toBe(2);
    expect(runEasy('pullups', cycle(ext, pull, 2), false).reps).toBe(0); // hands not above the nose
  });
});

describe('kettlebell swings', () => {
  const body = { shoulder: [0.5, 0.3], hip: [0.5, 0.55] } as const;
  const bottom = pose(both({ ...body, wrist: [0.5, 0.65] }));
  const top = pose(both({ ...body, wrist: [0.7, 0.31] }));
  const half = pose(both({ ...body, wrist: [0.6, 0.45] }));
  it('counts a swing when the bell comes back down', () => {
    expect(run('swings', cycle(bottom, top, 2, 2)).reps).toBe(2);
    expect(run('swings', cycle(bottom, half, 2, 2)).reps).toBe(0);
  });
});

describe('burpees', () => {
  const stand = pose(both({ shoulder: [0.5, 0.3], hip: [0.5, 0.55] }));
  const plank = pose(both({ shoulder: [0.3, 0.6], hip: [0.6, 0.62] }));
  it('counts standing up after a plank', () => {
    expect(run('burpees', cycle(stand, plank, 2)).reps).toBe(2);
  });
  it('does not count a crouch without the plank', () => {
    const crouch = pose(both({ shoulder: [0.45, 0.4], hip: [0.55, 0.5] }));
    expect(run('burpees', cycle(stand, crouch, 2)).reps).toBe(0);
  });
});

describe('mountain climbers', () => {
  const body = { 11: [0.3, 0.5], 12: [0.3, 0.5], 23: [0.6, 0.52], 24: [0.6, 0.52] } as const;
  const back = [0.75, 0.54] as const;
  const inn = [0.45, 0.6] as const;
  const leftIn = pose({ ...body, 25: inn, 26: back });
  const rightIn = pose({ ...body, 25: back, 26: inn });
  const bothBack = pose({ ...body, 25: back, 26: back });
  it('counts every knee drive, also when alternating fast', () => {
    const s = run('mountain', [...times(bothBack, 3), ...times(leftIn, 3), ...times(rightIn, 3), ...times(leftIn, 3), ...times(rightIn, 3), ...times(bothBack, 3)]);
    expect(s.reps).toBe(4);
  });
  it('needs a horizontal body', () => {
    const upright = { 11: [0.5, 0.2], 12: [0.5, 0.2], 23: [0.5, 0.5], 24: [0.5, 0.5] } as const;
    const s = run('mountain', cycle(pose({ ...upright, 25: [0.5, 0.75], 26: [0.5, 0.75] }), pose({ ...upright, 25: [0.6, 0.4], 26: [0.5, 0.75] }), 2));
    expect(s.reps).toBe(0);
  });
});

describe('easier variants', () => {
  it('counts knee push-ups', () => {
    const knees = { ...both({ shoulder: [0.3, 0.45], hip: [0.55, 0.53], knee: [0.7, 0.58], ankle: [0.85, 0.45] }) };
    const up = pose({ ...knees, ...both({ elbow: [0.3, 0.57], wrist: [0.3, 0.69] }) });
    const down = pose({ ...knees, ...both({ elbow: [0.2, 0.5], wrist: [0.3, 0.55] }) });
    expect(run('pushups', cycle(up, down, 2)).reps).toBe(2);
  });

  it('counts half squats only in easy mode', () => {
    const stand = pose(both({ hip: [0.5, 0.5], knee: [0.5, 0.7], ankle: [0.5, 0.9] }));
    const halfSquat = pose(both({ hip: [0.327, 0.6], knee: [0.5, 0.7], ankle: [0.5, 0.9] })); // knee ~120°
    expect(runEasy('squats', cycle(stand, halfSquat, 2, 5), false).reps).toBe(0);
    expect(runEasy('squats', cycle(stand, halfSquat, 2, 5), true).reps).toBe(2);
  });

  it('times a knee plank only in easy mode', () => {
    const kneePlank = pose(both({ shoulder: [0.3, 0.5], hip: [0.55, 0.53], knee: [0.75, 0.56], ankle: [0.85, 0.4] }));
    expect(scanAmount(runEasy('plank', times(kneePlank, 21), false))).toBe(0);
    expect(scanAmount(runEasy('plank', times(kneePlank, 21), true))).toBe(2);
  });

  it('accepts a higher wall sit in easy mode', () => {
    const high = pose(both({ hip: [0.347, 0.571], knee: [0.5, 0.7], ankle: [0.5, 0.9] })); // knee ~130°
    expect(scanAmount(runEasy('wallsit', times(high, 21), false))).toBe(0);
    expect(scanAmount(runEasy('wallsit', times(high, 21), true))).toBe(2);
  });
});

describe('presence mode', () => {
  it('only runs the timer while shoulders and hips are clearly visible', async () => {
    const { PRESENCE } = await import('./pose');
    const seen = pose(both({ shoulder: [0.5, 0.3], hip: [0.5, 0.6] }));
    const hidden = pose(both({ shoulder: [0.5, 0.3], hip: [0.5, 0.6] }), 0.2);
    let s = run(PRESENCE, [...times(seen, 21), ...times(hidden, 10)]);
    expect(scanAmount(s)).toBe(2);
    expect(s.bodyVisible).toBe(false);
    s = run(PRESENCE, [...times(seen, 21), ...times(hidden, 30), ...times(seen, 10)]);
    expect(scanAmount(s)).toBe(3); // 20 + 10 visible intervals
    expect(scanAmount(run(PRESENCE, [...times(seen, 5)]))).toBe(0);
    expect(step(initialScan(PRESENCE), undefined, 0).bodyVisible).toBe(false);
  });

  it('has setup texts for every scannable exercise and presence mode', async () => {
    const { SCANNABLE, scanSpec, PRESENCE } = await import('./pose');
    for (const id of ['situps', 'curls', 'press', 'rows', 'swings', 'burpees', 'mountain']) expect(SCANNABLE[id]).toBeDefined();
    expect(scanSpec(PRESENCE)?.kind).toBe('presence');
    expect(scanSpec('squats', true)?.cue).toBe('Halb in die Hocke, dann ganz aufrichten.');
    expect(scanSpec('curls', true)?.cue).toBe(SCANNABLE.curls.cue);
  });
});

describe('stretch routine', () => {
  // front view, standing; the person's left side (11, 13, …) has the larger x
  const stand = {
    0: [0.5, 0.15], 11: [0.55, 0.3], 12: [0.45, 0.3], 13: [0.57, 0.42], 14: [0.43, 0.42], 15: [0.58, 0.52], 16: [0.42, 0.52],
    23: [0.53, 0.55], 24: [0.47, 0.55], 25: [0.53, 0.72], 26: [0.47, 0.72], 27: [0.53, 0.9], 28: [0.47, 0.9],
  } as const;
  const P = {
    neutral: pose(stand),
    fold: pose({ ...stand, 15: [0.53, 0.8], 16: [0.47, 0.8] }),
    foldBentKnees: pose({ ...stand, 15: [0.53, 0.8], 16: [0.47, 0.8], 25: [0.62, 0.72], 26: [0.56, 0.72] }),
    bendLeft: pose({ ...stand, 11: [0.55, 0.34], 12: [0.45, 0.28], 16: [0.45, 0.05] }), // right arm up, left shoulder lower
    bendLeftWrongWay: pose({ ...stand, 11: [0.55, 0.28], 12: [0.45, 0.34], 16: [0.45, 0.05] }),
    bendLeftTooLittle: pose({ ...stand, 11: [0.55, 0.31], 12: [0.45, 0.29], 16: [0.45, 0.05] }), // ~11°
    bendRight: pose({ ...stand, 11: [0.55, 0.28], 12: [0.45, 0.34], 15: [0.55, 0.05] }),
    armsUp: pose({ ...stand, 13: [0.56, 0.12], 14: [0.44, 0.12], 15: [0.56, 0.02], 16: [0.44, 0.02] }),
    armsUpBent: pose({ ...stand, 13: [0.65, 0.2], 14: [0.35, 0.2], 15: [0.56, 0.02], 16: [0.44, 0.02] }),
    lunge: pose({ ...stand, 23: [0.5, 0.55], 25: [0.65, 0.6], 27: [0.65, 0.9], 24: [0.5, 0.55], 26: [0.4, 0.72], 28: [0.3, 0.9] }),
  };
  const ORDER = [P.fold, P.bendLeft, P.bendRight, P.armsUp, P.lunge];

  /** Feed frames 500 ms apart, continuing from `s`. */
  const feed = (s: ScanState, f: Point[], n: number) => {
    for (let i = 0; i < n; i++) s = step(s, f, (s.lastT ?? -500) + 500);
    return s;
  };
  /** Is pose `i` held in this frame, starting fresh at that pose? */
  const holds = (i: number, f: Point[]) => {
    const s = feed({ ...initialScan(STRETCH), poseIndex: i }, f, 3);
    return s.inPosition && s.holdMs === 1000;
  };

  it('names the five poses and starts at the first', () => {
    expect(STRETCH_POSES.map((p) => p.name)).toEqual(['Vorbeuge', 'Seitneigung links', 'Seitneigung rechts', 'Arme hoch', 'Ausfallschritt-Dehnung']);
    expect(initialScan(STRETCH)).toMatchObject({ poseIndex: 0, poseName: 'Vorbeuge', poseMs: 0 });
    expect(SCANNABLE[STRETCH].kind).toBe('hold');
    expect(STRETCH_POSE_MS).toBe(30_000);
  });

  it('recognises each pose, and only that pose', () => {
    ORDER.forEach((frame, i) => {
      ORDER.forEach((_, j) => expect(holds(j, frame)).toBe(i === j));
      expect(holds(i, P.neutral)).toBe(false);
    });
  });

  it('rejects sloppy versions', () => {
    expect(holds(0, P.foldBentKnees)).toBe(false);
    expect(holds(1, P.bendLeftWrongWay)).toBe(false);
    expect(holds(1, P.bendLeftTooLittle)).toBe(false);
    expect(holds(2, P.bendLeftWrongWay)).toBe(false); // the right arm is up, not the left
    expect(holds(3, P.armsUpBent)).toBe(false);
  });

  it('needs the body clearly visible', () => {
    const hidden = pose({ ...stand, 15: [0.53, 0.8], 16: [0.47, 0.8] }, 0.2);
    const s = feed(initialScan(STRETCH), hidden, 10);
    expect(s).toMatchObject({ bodyVisible: false, inPosition: false, holdMs: 0 });
    expect(step(initialScan(STRETCH), undefined, 0).bodyVisible).toBe(false);
  });

  it('only counts time in the current pose and moves on after 30 s, in a loop', () => {
    let s = feed(initialScan(STRETCH), P.bendLeft, 20); // wrong pose: no time
    expect(s).toMatchObject({ holdMs: 0, poseIndex: 0, bodyVisible: true, inPosition: false });
    s = feed(s, P.fold, 30); // 15 s
    expect(s).toMatchObject({ poseIndex: 0, poseName: 'Vorbeuge', poseMs: 15_000 });
    s = feed(s, P.neutral, 10); // a break keeps the time so far
    expect(s.poseMs).toBe(15_000);
    s = feed(s, P.fold, 30); // 30 s reached
    expect(s).toMatchObject({ poseIndex: 1, poseName: 'Seitneigung links', poseMs: 0 });
    expect(scanAmount(s)).toBe(30);
    for (let i = 1; i < ORDER.length; i++) {
      s = feed(s, ORDER[i], 60);
      expect(s.poseIndex).toBe((i + 1) % ORDER.length);
    }
    expect(s).toMatchObject({ poseIndex: 0, poseName: 'Vorbeuge', poseMs: 0 });
    expect(scanAmount(s)).toBe(150); // total held seconds over all five poses
  });
});
