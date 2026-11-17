import { describe, expect, it } from 'vitest';
import { PRESENCE, SCANNABLE, STRETCH, STRETCH_POSES, STRETCH_POSE_MS, angle, bodyView, facing, initialScan, missingParts, scanAmount, scanSpec, step, viewNeed, type Point, type ScanState } from './pose';

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

// ---------- head-on view (phone in front of the head), missing body parts ----------

/**
 * Landmarks from 3D body points via a simple pinhole camera: `x` cm to the side, `h` cm above the
 * floor, `d` cm away from a phone whose lens is `cam` cm above the floor and looks straight ahead
 * (focal length = image height). Left-side points (11, 13, …) get +x, right-side points -x.
 */
type Body3D = Partial<Record<'nose' | 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle', readonly [x: number, h: number, d: number]>>;
function project(body: Body3D, cam: number, vis: Partial<Record<keyof Body3D, number>> = {}): Point[] {
  const idx = { nose: [0], shoulder: [11, 12], elbow: [13, 14], wrist: [15, 16], hip: [23, 24], knee: [25, 26], ankle: [27, 28] } as const;
  const lm: Point[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  for (const [k, p] of Object.entries(body) as [keyof Body3D, readonly [number, number, number]][]) {
    const [x, h, d] = p;
    idx[k].forEach((i, n) => {
      const sx = n === 0 ? x : -x;
      lm[i] = { x: 0.5 + sx / d, y: 0.5 - (h - cam) / d, visibility: vis[k] ?? 1 };
    });
  }
  return lm;
}

describe('view detection', () => {
  it('tells side view from head-on', () => {
    expect(bodyView(pose({ ...plankBody, ...armsStraight }))).toBe('side');
    const front = project({ nose: [0, 25, 130], shoulder: [18, 30, 150], elbow: [15, 5, 150], hip: [13, 23, 200] }, 10);
    expect(bodyView(front)).toBe('front');
    // nose outside the shoulders: side
    expect(bodyView(project({ nose: [40, 25, 130], shoulder: [18, 30, 150] }, 10))).toBe('side');
    // standing facing the camera: the torso is long compared to the shoulders
    expect(bodyView(project({ shoulder: [18, 145, 250], hip: [13, 95, 250] }, 100))).toBe('side');
  });
});

describe('plank head-on', () => {
  // forearm plank, phone 10 cm above the floor in front of the head; feet hidden behind the body
  const hidden = { knee: 0.1, ankle: 0.1, hip: 0.4 };
  const plank = { nose: [0, 25, 130], shoulder: [18, 30, 150], elbow: [15, 5, 150], wrist: [8, 5, 120], hip: [13, 23, 200], knee: [10, 15, 245], ankle: [10, 10, 290] } as const;
  const kneePlank = { ...plank, hip: [13, 15, 198], knee: [10, 3, 240], ankle: [10, 10, 270] } as const;

  it('times a forearm plank without seeing the feet', () => {
    const f = project(plank, 10, hidden);
    const s = runEasy('plank', times(f, 21), false);
    expect(scanAmount(s)).toBe(2);
    expect(s).toMatchObject({ view: 'front', bodyVisible: true, inPosition: true });
    expect(s.missing).toBeUndefined();
  });

  it('also works with the phone higher up', () => {
    expect(scanAmount(runEasy('plank', times(project(plank, 50, hidden), 21), false))).toBe(2);
  });

  it('times a knee plank in easy mode', () => {
    const s = runEasy('plank', times(project(kneePlank, 10, hidden), 21), true);
    expect(scanAmount(s)).toBe(2);
    expect(s.view).toBe('front');
  });

  it('does not count standing or sitting facing the camera', () => {
    const standing = { nose: [0, 165, 250], shoulder: [18, 145, 250], elbow: [20, 115, 250], wrist: [20, 85, 250], hip: [13, 95, 250] } as const;
    const sitting = { nose: [0, 130, 245], shoulder: [18, 110, 250], elbow: [20, 85, 245], wrist: [15, 75, 215], hip: [13, 50, 260] } as const;
    for (const body of [standing, sitting]) {
      for (const cam of [10, 60, 100]) {
        for (const easy of [false, true]) {
          const s = runEasy('plank', times(project(body, cam), 21), easy);
          expect(scanAmount(s)).toBe(0);
        }
      }
    }
  });

  it('does not count lying on the belly propped on the forearms (hips on the floor)', () => {
    const sphinx = project({ ...plank, shoulder: [18, 25, 150], hip: [13, 8, 195] }, 10, hidden);
    for (const easy of [false, true]) {
      const s = runEasy('plank', times(sphinx, 21), easy);
      expect(s).toMatchObject({ view: 'front', bodyVisible: true, inPosition: false, holdMs: 0 });
    }
  });

  it('lists the hidden parts and does not ask for the feet head-on', () => {
    const s = runEasy('plank', times(project(plank, 10, { ...hidden, hip: 0.1 }), 5), false);
    expect(s).toMatchObject({ bodyVisible: false, inPosition: false, view: 'front', missing: ['Hüfte'] });
    const noElbows = runEasy('plank', times(project(plank, 10, { ...hidden, elbow: 0.2 }), 5), false);
    expect(noElbows.missing).toEqual(['Ellbogen']);
  });

  it('keeps the side view as before and asks for the feet there', () => {
    const noFeet = pose({ ...plankBody, ...armsStraight, 27: [0.9, 0.55], 28: [0.9, 0.55] });
    noFeet[27] = { ...noFeet[27], visibility: 0.1 };
    noFeet[28] = { ...noFeet[28], visibility: 0.1 };
    const s = run('plank', times(noFeet, 5));
    expect(s).toMatchObject({ bodyVisible: false, view: 'side', missing: ['Füße'] });
  });
});

describe('push-ups head-on', () => {
  const cam = 10;
  const up = { nose: [0, 52, 130], shoulder: [18, 58, 150], elbow: [20, 30, 150], wrist: [22, 3, 150], hip: [13, 40, 198] } as const;
  const down = { nose: [0, 12, 125], shoulder: [18, 15, 145], elbow: [32, 18, 160], wrist: [22, 3, 150], hip: [13, 12, 195] } as const;
  const vis = { hip: 0.4 };

  it('counts full reps from the shoulder-to-hand distance', () => {
    const s = run('pushups', cycle(project(up, cam, vis), project(down, cam, vis), 2));
    expect(s.reps).toBe(2);
    expect(s.view).toBe('front');
    // the third one never came back up
    expect(run('pushups', [...cycle(project(up, cam, vis), project(down, cam, vis), 2), ...times(project(down, cam, vis), 4)]).reps).toBe(2);
  });

  it('counts knee push-ups', () => {
    const kneeUp = { ...up, hip: [13, 30, 198] } as const;
    const kneeDown = { ...down, hip: [13, 8, 195] } as const;
    expect(runEasy('pushups', cycle(project(kneeUp, cam, vis), project(kneeDown, cam, vis), 2), true).reps).toBe(2);
  });

  it('ignores jitter and half reps', () => {
    const half = { ...up, shoulder: [18, 42, 148], elbow: [26, 26, 152], nose: [0, 38, 128] } as const; // ~1.07 shoulder widths
    const jitter = Array.from({ length: 40 }, (_, i) => project({ ...up, shoulder: [18, 58 + (i % 2 ? 4 : -4), 150] }, cam, vis));
    expect(run('pushups', jitter).reps).toBe(0);
    expect(run('pushups', cycle(project(up, cam, vis), project(half, cam, vis), 3)).reps).toBe(0);
  });

  it('needs the hands on the floor', () => {
    const handsUp = { ...down, wrist: [10, 25, 130] } as const; // hands lifted above the elbows
    expect(run('pushups', cycle(project(up, cam, vis), project(handsUp, cam, vis), 2)).reps).toBe(0);
  });

  it('does not count arm bends while standing facing the camera', () => {
    const body = { nose: [0, 165, 250], shoulder: [18, 145, 250], hip: [13, 95, 250] } as const;
    const armsDown = project({ ...body, elbow: [20, 115, 250], wrist: [20, 85, 250] }, 100);
    const curled = project({ ...body, elbow: [20, 115, 250], wrist: [18, 140, 230] }, 100);
    const handsAtShoulders = project({ ...body, elbow: [30, 125, 250], wrist: [24, 138, 250] }, 100);
    expect(run('pushups', cycle(armsDown, curled, 3)).reps).toBe(0);
    expect(run('pushups', cycle(armsDown, handsAtShoulders, 3)).reps).toBe(0);
  });

  it('lists the hidden parts', () => {
    const s = run('pushups', times(project(up, cam, { hip: 0.4, wrist: 0.2 }), 3));
    expect(s).toMatchObject({ bodyVisible: false, view: 'front', missing: ['Handgelenke'] });
  });
});

describe('missing body parts', () => {
  it('names the hidden parts in German, head to feet', () => {
    const lm = pose({}, 1);
    lm[0] = { ...lm[0], visibility: 0.2 };
    lm[24] = { ...lm[24], visibility: 0.2 };
    lm[27] = { ...lm[27], visibility: 0 };
    expect(missingParts(lm, [27, 24, 11, 0])).toEqual(['Kopf', 'Hüfte', 'Füße']);
    expect(missingParts(lm, [11, 13, 15, 25])).toEqual([]);
  });

  it('is set for every exercise while the body is not visible, and cleared once it is', () => {
    for (const id of [...Object.keys(SCANNABLE), PRESENCE]) {
      const s = step(initialScan(id), undefined, 0);
      expect(s.bodyVisible, id).toBe(false);
      expect(s.missing?.length, id).toBeGreaterThan(0);
    }
    expect(step(initialScan('squats'), undefined, 0).missing).toEqual(['Hüfte', 'Knie', 'Füße']);
    expect(step(initialScan('wallsit'), undefined, 0).missing).toEqual(['Hüfte', 'Knie', 'Füße']);
    expect(step(initialScan(PRESENCE), undefined, 0).missing).toEqual(['Schultern', 'Hüfte']);
    expect(step(initialScan(STRETCH), undefined, 0).missing).toEqual(['Handgelenke', 'Hüfte', 'Knie', 'Füße']);
    expect(step(initialScan('pushups'), undefined, 0).missing).toEqual(['Schultern', 'Ellbogen', 'Handgelenke', 'Hüfte']);
    let s = step(initialScan('squats'), undefined, 0);
    s = step(s, pose(both({ hip: [0.5, 0.5], knee: [0.5, 0.7], ankle: [0.5, 0.9] })), 100);
    expect(s.bodyVisible).toBe(true);
    expect(s.missing).toBeUndefined();
  });
});

describe('setup texts', () => {
  it('allow the phone beside or in front of the head for push-ups and planks', async () => {
    const { scanSpec } = await import('./pose');
    for (const id of ['pushups', 'plank']) {
      for (const easy of [false, true]) expect(scanSpec(id, easy)?.setup).toContain('seitlich oder vor deinen Kopf');
    }
  });
});

// ---------- every exercise from the side and from the front ----------

/**
 * A small 3D scene: body points in cm, `[lat, fwd, h]` = to the person's left, forward (where the
 * person faces), height above the floor; pairs are [left, right]. `shoot` takes a picture with a
 * pinhole camera (focal length = image height) at `h` cm height, `dist` cm from the body's origin,
 * at `yaw` degrees around the person: 0 = in front (the person faces the phone), 90 = at the
 * person's left, -90 = at the right. All landmarks are visible unless `vis` says otherwise.
 */
type V3 = readonly [lat: number, fwd: number, h: number];
type Part = 'nose' | 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle';
type Skel = Record<Part, readonly [V3, V3]>;
interface Cam { yaw: number; h: number; dist: number; vis?: Partial<Record<Part, number>> }
const PARTS = { nose: [0, 0], shoulder: [11, 12], elbow: [13, 14], wrist: [15, 16], hip: [23, 24], knee: [25, 26], ankle: [27, 28] } as const;
function shoot(sk: Skel, c: Cam): Point[] {
  const lm: Point[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  const [sin, cos] = [Math.sin((c.yaw * Math.PI) / 180), Math.cos((c.yaw * Math.PI) / 180)];
  for (const part of Object.keys(PARTS) as Part[]) {
    PARTS[part].forEach((i, n) => {
      const [lat, fwd, h] = sk[part][n];
      const d = c.dist - (lat * sin + fwd * cos);
      lm[i] = { x: 0.5 + (lat * cos - fwd * sin) / d, y: 0.5 - (h - c.h) / d, visibility: c.vis?.[part] ?? 1 };
    });
  }
  return lm;
}
const sym = (lat: number, fwd: number, h: number): readonly [V3, V3] => [[lat, fwd, h], [-lat, fwd, h]];
const rad = (deg: number) => (deg * Math.PI) / 180;
/** Head, shoulders and hanging arms on top of a hip midpoint, leaning forward by `lean` degrees. */
function upper([, f, h]: V3, lean: number) {
  const [sf, sh] = [f + 50 * Math.sin(rad(lean)), h + 50 * Math.cos(rad(lean))];
  const nose: V3 = [0, sf + 10 * Math.cos(rad(lean)) + 18 * Math.sin(rad(lean)), sh + 18 * Math.cos(rad(lean)) - 10 * Math.sin(rad(lean))];
  return { nose: [nose, nose] as const, shoulder: sym(18, sf, sh), elbow: sym(20, sf, sh - 30), wrist: sym(20, sf + 3, sh - 57) };
}
const STAND: Skel = { ...upper([0, 0, 95], 0), hip: sym(12, 0, 95), knee: sym(12, 2, 51), ankle: sym(12, 0, 8) };
/** Shoulders and arms `k` times as wide (other body proportions). */
const widen = (sk: Skel, k: number): Skel => {
  const w = (p: readonly [V3, V3]) => p.map(([a, b, c]) => [a * k, b, c] as V3) as unknown as readonly [V3, V3];
  return { ...sk, shoulder: w(sk.shoulder), elbow: w(sk.elbow), wrist: w(sk.wrist) };
};
/** Squat: t = 0 standing … 1 deep (thigh 100° from upright, knee angle ≈ 180° − 135° t), arms forward. */
function squat(t: number): Skel {
  const [th, ph] = [rad(100 * t), rad(35 * t)];
  const knee: V3 = [12 + 4 * t, 42 * Math.sin(ph), 8 + 42 * Math.cos(ph)];
  const hip: V3 = [12, knee[1] - 44 * Math.sin(th), knee[2] + 44 * Math.cos(th)];
  const u = upper([0, hip[1], hip[2]], 45 * t);
  const [, sf, sh] = u.shoulder[0];
  const arms = t > 0.05 ? { elbow: sym(18, sf + 30, sh - 3), wrist: sym(17, sf + 57, sh - 5) } : {};
  return { ...u, ...arms, hip: sym(12, hip[1], hip[2]), knee: sym(knee[0], knee[1], knee[2]), ankle: sym(12, 0, 8) };
}
/** Wall sit with this knee angle: shins upright, thighs back toward the wall, torso upright. */
function wallsit(kneeDeg: number): Skel {
  const th = rad(180 - kneeDeg);
  const hip: V3 = [12, -44 * Math.sin(th), 50 + 44 * Math.cos(th)];
  return { ...upper([0, hip[1], hip[2]], 0), hip: sym(12, hip[1], hip[2]), knee: sym(12, 0, 50), ankle: sym(12, 0, 8) };
}
/** Knee of a two-link leg (thigh 44, shin 42) between hip and ankle, bending forward. */
function kneeBetween(hip: V3, ankle: V3): V3 {
  const [dx, dz] = [ankle[1] - hip[1], ankle[2] - hip[2]];
  const d = Math.min(Math.hypot(dx, dz), 85.99);
  const a = (44 * 44 - 42 * 42 + d * d) / (2 * d);
  const off = Math.sqrt(Math.max(0, 44 * 44 - a * a));
  const [ux, uz] = [dx / Math.hypot(dx, dz), dz / Math.hypot(dx, dz)];
  const [px, pz] = -uz >= 0 ? [-uz, ux] : [uz, -ux];
  return [hip[0], hip[1] + a * ux + off * px, hip[2] + a * uz + off * pz];
}
/** Lunge, left leg forward: t = 0 standing tall in the split stance … 1 rear knee near the floor. */
function lunge(t: number, stride = 90): Skel {
  const [la, ra]: V3[] = [[12, stride / 2, 8], [-12, -stride / 2, 8]];
  const top = 6 + Math.sqrt(86 * 86 - (stride / 2) ** 2);
  const hipH = top - t * (top - 52);
  const [lh, rh]: V3[] = [[12, -5, hipH], [-12, -5, hipH]];
  return { ...upper([0, -5, hipH], 0), hip: [lh, rh], knee: [kneeBetween(lh, la), kneeBetween(rh, ra)], ankle: [la, ra] };
}
/** Walking step: one foot `lift` cm up and forward, its knee bent. */
const step3d = (lift: number): Skel => ({ ...STAND, knee: [[12, 2, 51], [-12, 12 + lift / 2, 52 + lift / 2]], ankle: [[12, 0, 8], [-12, 10, 8 + lift]] });
/** Biceps curl: forearm raised `deg` from hanging (140 = curled), on both arms or one. */
function curl(deg: number, which: 'both' | 'left' | 'right' = 'both'): Skel {
  const wrist = (lat: number, on: boolean): V3 => [lat, 3 + 27 * Math.sin(rad(on ? deg : 0)), 115 - 27 * Math.cos(rad(on ? deg : 0))];
  return { ...STAND, wrist: [wrist(20, which !== 'right'), wrist(-20, which !== 'left')] };
}
/** Pull-up on a bar at 230 cm, hands at ±grip: t = 0 hanging, 1 chin over the bar. Elbows bend sideways (wide) or forward (narrow). */
function pullup(t: number, grip = 35): Skel {
  const sh0 = 230 - Math.sqrt(57 * 57 - (grip - 18) ** 2);
  const sh = sh0 + t * (222 - sh0);
  // elbow off the shoulder–hand line (upper arm 30, forearm 27): sideways for a wide grip, forward for a narrow one
  const reach = Math.hypot(grip - 18, 230 - sh);
  const along = (30 * 30 - 27 * 27 + reach * reach) / (2 * reach);
  const out = Math.sqrt(Math.max(0, 30 * 30 - along * along));
  const [mx, mz] = [18 + ((grip - 18) * along) / reach, sh + ((230 - sh) * along) / reach];
  const elbow: V3 = grip > 25 ? [mx + out, 3, mz - out * 0.3] : [mx, 3 + out, mz - out * 0.3];
  return { nose: sym(0, 10, sh + 18), shoulder: sym(18, 0, sh), elbow: sym(...elbow), wrist: sym(grip, 0, 230), hip: sym(12, 0, sh - 50), knee: sym(12, 5, sh - 94), ankle: sym(12, 0, sh - 136) };
}
/** Overhead press: start (hands just below the shoulders), top (arms straight up), half (hands at the forehead). */
const press = (p: 'start' | 'top' | 'half'): Skel => ({
  ...STAND,
  elbow: p === 'start' ? sym(32, 6, 118) : p === 'top' ? sym(22, 0, 175) : sym(36, 4, 145),
  wrist: p === 'start' ? sym(27, 10, 138) : p === 'top' ? sym(22, 0, 202) : sym(26, 6, 165),
});
/** Kettlebell swing: bottom (hinged, bell between the legs), top (arms forward at shoulder height), half (45° lower). */
function swing(p: 'bottom' | 'top' | 'half'): Skel {
  if (p === 'bottom') return { ...upper([0, -20, 85], 55), elbow: sym(8, 12, 80), wrist: sym(4, -12, 60), hip: sym(12, -20, 85), knee: sym(13, 8, 48), ankle: sym(16, 0, 8) };
  const r = rad(p === 'top' ? 0 : 45);
  return { ...STAND, ankle: sym(16, 0, 8), elbow: sym(10, 30 * Math.cos(r), 145 - 30 * Math.sin(r)), wrist: sym(5, 57 * Math.cos(r), 145 - 57 * Math.sin(r)) };
}
/** Push-up position, head toward +fwd; `drive` pulls one knee toward the chest (mountain climbers). */
function prone(drive: 'none' | 'left' | 'right' = 'none'): Skel {
  const leg = (lat: number, on: boolean) => (on ? { knee: [lat, -15, 30] as V3, ankle: [lat, -50, 15] as V3 } : { knee: [lat, -94, 28] as V3, ankle: [lat, -136, 10] as V3 });
  const [l, r] = [leg(12, drive === 'left'), leg(-12, drive === 'right')];
  return { nose: sym(0, 15, 52), shoulder: sym(18, 0, 55), elbow: sym(20, 0, 28), wrist: sym(18, 0, 3), hip: sym(12, -50, 45), knee: [l.knee, r.knee], ankle: [l.ankle, r.ankle] };
}
/** Bottom of a burpee before the kick back: deep squat, hands on the floor in front. */
const crouch = (): Skel => ({ ...squat(0.95), elbow: sym(20, 40, 35), wrist: sym(18, 45, 3) });
/** Bent over with straight legs, hands near the feet. */
const toeTouch = (): Skel => ({ ...STAND, ...upper([0, -18, 95], 100), elbow: sym(20, 30, 60), wrist: sym(14, 15, 30), hip: sym(12, -18, 95) });
/** Sit-up lying on the back, head toward +fwd: t = 0 lying, 1 sitting up. */
function situp(t: number): Skel {
  const a = rad(80 * t);
  const [sf, sh] = [50 * Math.cos(a), 12 + 50 * Math.sin(a)];
  return {
    nose: sym(0, sf + 18 * Math.cos(a) - 6 * Math.sin(a), sh + 18 * Math.sin(a) + 6 * Math.cos(a)), shoulder: sym(18, sf, sh), elbow: sym(18, sf - 15, sh + 15),
    wrist: sym(10, sf + 5, sh + 22), hip: sym(12, 0, 12), knee: sym(12, -32, 45), ankle: sym(12, -60, 8),
  };
}
/** Band row standing: arms forward, or elbows back with the hands at the belly. */
const row = (p: 'ext' | 'pull'): Skel => (p === 'ext' ? { ...STAND, elbow: sym(19, 28, 133), wrist: sym(17, 55, 125) } : { ...STAND, elbow: sym(22, -22, 115), wrist: sym(18, 4, 110) });
/** Jumping jack, open: arms over the head, feet wide. */
const jackOpen: Skel = { ...STAND, elbow: sym(40, 0, 170), wrist: sym(50, 0, 195), knee: sym(25, 0, 51), ankle: sym(38, 0, 8) };
const armsUp: Skel = { ...STAND, elbow: sym(16, 0, 175), wrist: sym(14, 0, 202) };
/** Lunge stretch: left knee bent about 90° in front, right leg straight back. */
function lungeStretch(): Skel {
  const back = -Math.sqrt(86 * 86 - 52 * 52);
  return { ...upper([0, 0, 60], 0), hip: sym(12, 0, 60), knee: [[12, 50, 50], [-12, back * 0.51, 60 - 52 * 0.51]], ankle: [[12, 50, 8], [-12, back, 8]] };
}

const FRONT = [0, 20];
const SIDE = [90, -90];
/** Phone on the floor, at hip height, at chest height; far enough to see the whole body. */
const CAMS = [{ h: 10, dist: 320 }, { h: 80, dist: 260 }, { h: 130, dist: 320 }];
/** Frames at 100 ms: `rest` for 4 frames, then `reps` times a smooth move to `f(1)` and back (about 2.5 s each). */
function reps(f: (t: number) => Skel, n: number): Skel[] {
  const there = Array.from({ length: 9 }, (_, i) => f(i / 8));
  return [...times3(f(0), 4), ...Array.from({ length: n }, () => [...there, f(1), f(1), ...there.slice(0, -1).reverse(), f(0), f(0)]).flat()];
}
const times3 = (sk: Skel, n: number) => Array<Skel>(n).fill(sk);
const alternate = (a: Skel, b: Skel, n: number) => [...times3(a, 5), ...Array.from({ length: n }, () => [...times3(b, 5), ...times3(a, 5)]).flat()];
/** Run an exercise on the frames, as seen from each yaw and camera; returns the final states. */
function film(exercise: string, frames: Skel[], yaws: number[], easy = false, cams: Omit<Cam, 'yaw'>[] = CAMS) {
  return yaws.flatMap((yaw) =>
    cams.map((cam) => {
      let s = initialScan(exercise);
      frames.forEach((f, i) => (s = step(s, shoot(f, { yaw, ...cam }), i * 100, 1, easy)));
      return { s, at: `${exercise} yaw ${yaw}, phone ${cam.h} cm` };
    }),
  );
}
const expectReps = (runs: ReturnType<typeof film>, n: number) => runs.forEach(({ s, at }) => expect(s.reps, at).toBe(n));
const expectView = (runs: ReturnType<typeof film>, view: 'front' | 'side') => runs.forEach(({ s, at }) => expect(s.view, at).toBe(view));
/** A standing person waving the arms, walking on the spot and stepping: must never count. */
const fidgeting = [...alternate(STAND, armsUp, 2), ...alternate(STAND, step3d(15), 2), ...alternate(STAND, step3d(30), 2), ...alternate(STAND, curl(90), 2), ...alternate(STAND, jackOpen, 2)];

describe('camera view (facing)', () => {
  it('tells front from side for upright and lying bodies', () => {
    for (const cam of CAMS) {
      for (const yaw of [0, 20, 35]) expect(facing(shoot(STAND, { yaw, ...cam })), `yaw ${yaw}`).toBe('front');
      for (const yaw of [75, 90, -90]) expect(facing(shoot(STAND, { yaw, ...cam })), `yaw ${yaw}`).toBe('side');
      expect(facing(shoot(STAND, { yaw: 55, ...cam }))).toBeUndefined(); // oblique
      // lying: head toward the phone is front, from the side is side; slightly turned is not "front" yet
      expect(facing(shoot(prone(), { yaw: 0, ...cam }), 1, true)).toBe('front');
      expect(facing(shoot(prone(), { yaw: 90, ...cam }), 1, true)).toBe('side');
      expect(facing(shoot(prone(), { yaw: 40, ...cam }), 1, true)).toBeUndefined();
      expect(facing(shoot(situp(0), { yaw: 180, ...cam }), 1, true)).toBe('front'); // phone at the feet
    }
    expect(facing(shoot(STAND, { yaw: 0, ...CAMS[1], vis: { hip: 0.1 } }))).toBeUndefined();
    expect(facing([])).toBeUndefined();
  });
});

describe('needed views and setup texts', () => {
  it('declares a view for every exercise', () => {
    for (const id of Object.keys(SCANNABLE)) expect(['side', 'front', 'any'], id).toContain(viewNeed(id));
    expect(['situps', 'rows', 'mountain'].map((id) => viewNeed(id))).toEqual(['side', 'side', 'side']);
    expect(viewNeed('jacks')).toBe('front');
    expect(viewNeed('pullups')).toBe('any');
    expect(viewNeed('pullups', true)).toBe('side'); // Australian pull-ups
    expect(scanSpec('pullups', true)?.view).toBe('side');
    expect(viewNeed(PRESENCE)).toBe('any');
    expect(viewNeed('unknown')).toBe('any');
  });

  it('tells where to put the phone, with a distance, and says when only one view works', () => {
    for (const id of [...Object.keys(SCANNABLE), PRESENCE]) {
      for (const easy of [false, true]) {
        const spec = scanSpec(id, easy)!;
        expect(spec.setup, id).toMatch(/\d(,\d)?(–\d(,\d)?)? m (entfernt|vor dich)/);
        if (spec.view === 'side') expect(spec.setup, id).toMatch(/Nur von der Seite/);
        if (spec.view === 'front') expect(spec.setup, id).toMatch(/Nur von vorne/);
        if (spec.view === 'any' && id !== STRETCH && id !== PRESENCE) expect(spec.setup, id).toMatch(/seitlich oder vor|vor dich oder seitlich/);
      }
    }
  });
});

describe('squats and lunges from the front (hip drop)', () => {
  it('count squats head-on and turned up to 40°, with the phone low or at chest height', () => {
    const runs = film('squats', reps(squat, 3), [0, 20, 40]);
    expectReps(runs, 3);
    expectView(runs, 'front');
  });

  it('still count from the side on the knee angle', () => {
    const runs = film('squats', reps(squat, 3), [60, ...SIDE]);
    expectReps(runs, 3);
    expectView(runs.slice(CAMS.length), 'side');
  });

  it('count half squats only in easy mode (phone not above the hips)', () => {
    const half = (t: number) => squat(0.55 * t);
    expectReps(film('squats', reps(half, 2), FRONT, false), 0);
    expectReps(film('squats', reps(half, 2), FRONT, true, CAMS.slice(0, 2)), 2);
  });

  it('learn the player’s own proportions: broad and narrow shoulders', () => {
    for (const k of [0.85, 1.2]) {
      expectReps(film('squats', reps((t) => widen(squat(t), k), 3), FRONT), 3);
      expectReps(film('squats', fidgeting.map((f) => widen(f, k)), FRONT), 0);
    }
  });

  it('ignore standing still, walking on the spot, waving and bending over', () => {
    for (const id of ['squats', 'lunges']) {
      expectReps(film(id, fidgeting, FRONT), 0);
      expectReps(film(id, fidgeting, FRONT, true), 0);
      expectReps(film(id, alternate(STAND, toeTouch(), 3), FRONT), 0);
    }
    // jitter while standing
    const jitter = Array.from({ length: 60 }, (_, i) => ({ ...STAND, hip: sym(12, 0, 95 + (i % 2 ? 3 : -3)) }));
    expectReps(film('squats', jitter, FRONT), 0);
  });

  it('count lunges head-on, also when standing up in the split stance', () => {
    expectReps(film('lunges', alternate(STAND, lunge(1), 3), [...FRONT, 40]), 3);
    const runs = film('lunges', reps(lunge, 3), FRONT);
    expectReps(runs, 3);
    expectView(runs, 'front');
    expectReps(film('lunges', alternate(STAND, lunge(1), 3), SIDE), 3); // side view as before
  });

  it('list the parts needed head-on', () => {
    const s = film('squats', times3(STAND, 3), [0], false, [{ ...CAMS[1], vis: { ankle: 0.2 } }])[0].s;
    expect(s).toMatchObject({ bodyVisible: false, view: 'front', missing: ['Füße'] });
  });
});

describe('wall sit from the front', () => {
  const hold = (k: number, yaws: number[], easy = false, cams = CAMS) => film('wallsit', times3(wallsit(k), 21), yaws, easy, cams).map(({ s, at }) => ({ amount: scanAmount(s), s, at }));
  it('times thighs about level, head-on and from the side', () => {
    for (const { amount, s, at } of hold(95, [0, 20, 40])) {
      expect(amount, at).toBe(2);
      expect(s.view, at).toBe('front');
    }
    for (const { amount, at } of hold(95, SIDE)) expect(amount, at).toBe(2);
  });
  it('rejects standing and a high sit, accepts the high sit in easy mode', () => {
    for (const easy of [false, true]) for (const { amount, at } of hold(180, FRONT, easy)) expect(amount, at).toBe(0);
    for (const { amount, at } of hold(135, FRONT)) expect(amount, at).toBe(0);
    for (const { amount, at } of hold(120, FRONT, true)) expect(amount, at).toBe(2);
    for (const { amount, at } of hold(130, FRONT, true, CAMS.slice(0, 2))) expect(amount, at).toBe(2);
    for (const { amount, at } of film('wallsit', fidgeting, FRONT).map(({ s, at }) => ({ amount: scanAmount(s), at }))) expect(amount, at).toBe(0);
  });
});

describe('curls from the front', () => {
  it('count curls head-on and from the side', () => {
    const front = film('curls', reps((t) => curl(140 * t), 3), [0, 20, 40], false, CAMS.slice(0, 2));
    expectReps(front, 3);
    expectView(front, 'front');
    expectReps(film('curls', reps((t) => curl(140 * t), 3), SIDE), 3);
  });
  it('count one arm when alternating, both arms at once as one rep', () => {
    const alt = [...alternate(curl(0), curl(140, 'left'), 1), ...alternate(curl(0), curl(140, 'right'), 1), ...alternate(curl(0), curl(140, 'left'), 1)];
    expectReps(film('curls', alt, FRONT), 2);
    expectReps(film('curls', alternate(curl(0), curl(140), 2), FRONT), 2);
  });
  it('ignore half curls, presses and waving', () => {
    expectReps(film('curls', alternate(curl(0), curl(90), 3), FRONT), 0);
    expectReps(film('curls', alternate(press('start'), press('top'), 3), [...FRONT, ...SIDE]), 0);
    expectReps(film('curls', [...alternate(STAND, armsUp, 2), ...alternate(STAND, jackOpen, 2)], [...FRONT, ...SIDE]), 0);
  });
});

describe('pull-ups from the front and the side', () => {
  it('count chin over the bar, wide grip and chin-ups, from both views', () => {
    for (const grip of [35, 16]) expectReps(film('pullups', reps((t) => pullup(t, grip), 3), [...FRONT, 40, ...SIDE]), 3);
  });
  it('ignore half pull-ups and arm movements while standing', () => {
    expectReps(film('pullups', reps((t) => pullup(0.6 * t), 3), [...FRONT, ...SIDE]), 0);
    expectReps(film('pullups', [...alternate(armsUp, curl(150), 3), ...alternate(armsUp, press('half'), 3), ...fidgeting], [...FRONT, ...SIDE]), 0);
  });
});

describe('press and swings work from both views', () => {
  it('count presses, not presses to the forehead (also with a low phone from the side)', () => {
    expectReps(film('press', alternate(press('start'), press('top'), 3), [...FRONT, 40, ...SIDE]), 3);
    expectReps(film('press', alternate(press('start'), press('half'), 3), [...FRONT, 40, ...SIDE]), 0);
  });
  it('count swings to shoulder height, not half swings', () => {
    expectReps(film('swings', alternate(swing('bottom'), swing('top'), 3), [...FRONT, 40, ...SIDE]), 3);
    expectReps(film('swings', alternate(swing('bottom'), swing('half'), 3), [...FRONT, ...SIDE]), 0);
  });
});

describe('burpees from the front', () => {
  const burpee = [...times3(STAND, 4), ...Array.from({ length: 3 }, () => [...times3(crouch(), 3), ...times3(prone(), 4), ...times3(crouch(), 3), ...times3(STAND, 4)]).flat()];
  it('count head-on and from the side', () => {
    const front = film('burpees', burpee, [0, 20, 40]);
    expectReps(front, 3);
    expectView(front, 'front');
    expectReps(film('burpees', burpee, SIDE), 3);
  });
  it('ignore bending over with straight legs, crouching and squatting, in both views', () => {
    for (const low of [toeTouch(), crouch(), squat(1)]) expectReps(film('burpees', alternate(STAND, low, 3), [...FRONT, ...SIDE]), 0);
    expectReps(film('burpees', fidgeting, [...FRONT, ...SIDE]), 0);
  });
});

describe('wrong view', () => {
  it('asks to face the camera for jumping jacks seen from the side', () => {
    for (const { s, at } of film('jacks', alternate(STAND, jackOpen, 3), SIDE)) {
      expect(s, at).toMatchObject({ reps: 0, bodyVisible: true, view: 'side', wrongView: 'front' });
      expect(s.missing, at).toBeUndefined();
    }
    for (const { s, at } of film('jacks', alternate(STAND, jackOpen, 3), [0, 20, 40])) {
      expect(s.reps, at).toBe(3);
      expect(s.wrongView, at).toBeUndefined();
    }
  });

  it('asks to turn sideways for sit-ups, rows, mountain climbers and Australian pull-ups seen head-on', () => {
    const cases: [string, Skel[], boolean, number[]][] = [
      ['situps', alternate(situp(0), situp(1), 3), false, [0, 180]],
      ['rows', alternate(row('ext'), row('pull'), 3), false, [0, 20, 40]],
      ['mountain', alternate(prone('left'), prone('right'), 3), false, [0]],
      ['pullups', alternate(prone(), prone(), 3), true, [0]],
    ];
    for (const [id, frames, easy, yaws] of cases) {
      for (const { s, at } of film(id, frames, yaws, easy)) expect(s, at).toMatchObject({ reps: 0, bodyVisible: true, view: 'front', wrongView: 'side' });
    }
    // from the side they count, and no hint is shown
    for (const [id, frames, n] of [['situps', alternate(situp(0), situp(1), 3), 3], ['rows', alternate(row('ext'), row('pull'), 3), 3], ['mountain', alternate(prone('left'), prone('right'), 3), 6]] as const) {
      for (const { s, at } of film(id, [...frames], SIDE, false, CAMS.slice(1))) {
        expect(s.reps, at).toBe(n);
        expect(s.wrongView, at).toBeUndefined();
      }
    }
  });

  it('is cleared as soon as the view is right, and the count goes on', () => {
    const cam = { yaw: 90, ...CAMS[1] };
    let s = initialScan('jacks');
    s = step(s, shoot(STAND, cam), 0);
    expect(s.wrongView).toBe('front');
    let t = 100;
    for (const f of alternate(STAND, jackOpen, 2)) s = step(s, shoot(f, { ...cam, yaw: 0 }), (t += 100));
    expect(s).toMatchObject({ reps: 2, view: 'front' });
    expect(s.wrongView).toBeUndefined();
  });

  it('tells which way to turn in the stretch routine', () => {
    const at = (poseIndex: number, sk: Skel, yaw: number) => step({ ...initialScan(STRETCH), poseIndex }, shoot(sk, { yaw, ...CAMS[1] }), 0);
    // lunge stretch (index 4) head-on: not held, turn sideways; from the side or at an angle: held
    expect(at(4, lungeStretch(), 0)).toMatchObject({ inPosition: false, wrongView: 'side' });
    expect(at(4, lungeStretch(), 90)).toMatchObject({ inPosition: true });
    expect(at(4, lungeStretch(), 90).wrongView).toBeUndefined();
    expect(at(4, lungeStretch(), 45).inPosition).toBe(true);
    // side bend from the side: face the camera; arms up from the side is no side bend
    expect(at(1, armsUp, 90)).toMatchObject({ inPosition: false, wrongView: 'front' });
    expect(at(2, armsUp, -90)).toMatchObject({ inPosition: false, wrongView: 'front' });
    expect(at(2, armsUp, 35).inPosition).toBe(false);
    // forward fold and arms up work from every side
    for (const yaw of [0, 45, 90]) {
      expect(at(0, toeTouch(), yaw).inPosition, `fold ${yaw}`).toBe(true);
      expect(at(3, armsUp, yaw).inPosition, `arms up ${yaw}`).toBe(true);
    }
  });
});

describe('view and missing parts are reported for every exercise', () => {
  it('sets the view whenever the body is seen, and clears missing', () => {
    for (const id of Object.keys(SCANNABLE)) {
      for (const yaw of [0, 90]) {
        const s = step(initialScan(id), shoot(STAND, { yaw, ...CAMS[1] }), 0);
        expect(s.view, `${id} ${yaw}`).toBeDefined();
        if (s.bodyVisible) expect(s.missing, id).toBeUndefined();
      }
    }
  });
});
