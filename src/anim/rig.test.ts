import { describe, expect, it } from 'vitest';
import { QUEST_POOL, VARIANTS } from '../game';
import { EXERCISE_ANIMS, NO_ANIM, hasExerciseAnim } from './exercises';
import { LIMBS, SK, dist, frameAt, limbJoints, lowestY, outline, poseAt, solve, twoBone, viewBoxFor, type VariantAnim } from './rig';

const SAMPLES = 60;
const variants = Object.values(EXERCISE_ANIMS).flatMap((d) => [
  { id: d.id, kind: 'normal', v: d.normal },
  { id: d.id, kind: 'easy', v: d.easy },
]);
const each = (fn: (v: VariantAnim, u: number) => void) => (x: { v: VariantAnim }) => {
  for (let i = 0; i < SAMPLES; i++) fn(x.v, i / SAMPLES);
};

describe('rig math', () => {
  it('two-bone solve reaches a reachable target and keeps bone lengths', () => {
    const r = twoBone([0, 0], [30, 60], 48, 46, -1);
    expect(r.miss).toBeLessThan(1e-6);
    expect(dist([0, 0], r.mid)).toBeCloseTo(48, 6);
    expect(dist(r.mid, r.end)).toBeCloseTo(46, 6);
    // knee forward (to the right of the hip-ankle line) with bend -1
    expect(r.mid[0]).toBeGreaterThan(15);
  });

  it('two-bone solve clamps an unreachable target and reports the miss', () => {
    const r = twoBone([0, 0], [0, 200], 48, 46, -1);
    expect(r.miss).toBeCloseTo(200 - 94, 1);
  });

  it('a standing figure has its feet flat on the floor', () => {
    const s = solve({ torso: -90, head: -90, root: [0, -102], nl: { a: 90, b: 90, c: 0 }, fl: { a: 90, b: 90, c: 0 }, na: { a: 90, b: 90, c: 90 }, fa: { a: 90, b: 90, c: 90 } });
    expect(s.J.nHeel[1]).toBeCloseTo(0, 6);
    expect(s.J.nBall[1]).toBeCloseTo(0, 6);
    expect(s.J.head[1]).toBeLessThan(-170);
  });
});

describe('exercise animations', () => {
  const ids = QUEST_POOL.map((q) => q.id).filter((id) => !NO_ANIM.includes(id));

  it('cover every built-in exercise except steps, reading and walking', () => {
    expect(ids.length).toBeGreaterThanOrEqual(40);
    for (const id of ids) {
      expect(hasExerciseAnim(id), id).toBe(true);
      expect(EXERCISE_ANIMS[id].normal.keys.length, id).toBeGreaterThan(1);
      expect(EXERCISE_ANIMS[id].easy.keys.length, id).toBeGreaterThan(1);
    }
    for (const id of NO_ANIM) expect(hasExerciseAnim(id)).toBe(false);
    expect(Object.keys(EXERCISE_ANIMS).sort()).toEqual([...ids].sort());
  });

  it('use the game titles for both variants', () => {
    for (const id of ids) {
      expect(EXERCISE_ANIMS[id].normal.name).toBe(QUEST_POOL.find((q) => q.id === id)!.title);
      if (VARIANTS[id]) expect(EXERCISE_ANIMS[id].easy.name).toBe(VARIANTS[id]);
    }
  });

  it.each(variants)('$id $kind: valid keyframes and cues', ({ v, id }) => {
    expect(v.dur).toBeGreaterThan(0);
    expect(v.keys[0].t).toBe(0);
    for (let i = 1; i < v.keys.length; i++) expect(v.keys[i].t, id).toBeGreaterThan(v.keys[i - 1].t);
    expect(v.keys[v.keys.length - 1].t).toBeLessThan(1);
    expect(v.cues.length).toBeGreaterThanOrEqual(1);
    expect(v.cues.length).toBeLessThanOrEqual(3);
    for (const c of v.cues) {
      expect(c.trim().length).toBeGreaterThan(5);
      expect(c).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    // an anchored joint must not be moved afterwards by an IK limb
    for (const k of v.keys) {
      if (!k.pose.anchor) continue;
      for (const l of LIMBS) if (k.pose[l].ik) expect(limbJoints(l), id).not.toContain(k.pose.anchor.j);
    }
    const s = v.still ?? 0.5;
    expect(s >= 0 && s < 1).toBe(true);
  });

  it.each(variants)('$id $kind: joints stay connected and limbs reach their targets', (x) =>
    each((v, u) => {
      const s = frameAt(v, u);
      const where = `${x.id} ${x.kind} u=${u.toFixed(3)}`;
      for (const side of ['n', 'f'] as const) {
        expect(dist(s.J[`${side}Hip`], s.J[`${side}Knee`]), where).toBeCloseTo(s.len[`${side}Thigh`], 4);
        expect(dist(s.J[`${side}Knee`], s.J[`${side}Ankle`]), where).toBeCloseTo(SK.shin, 4);
        expect(dist(s.J[`${side}Shoulder`], s.J[`${side}Elbow`]), where).toBeCloseTo(s.len[`${side}Upper`], 4);
        expect(dist(s.J[`${side}Elbow`], s.J[`${side}Wrist`]), where).toBeCloseTo(SK.fore, 4);
      }
      expect(dist(s.J.neck, s.J.head), where).toBeCloseTo(SK.headR, 4);
      for (const k of LIMBS) expect(s.ikErr[k] ?? 0, `${where} ${k} misses its target`).toBeLessThan(3);
      for (const p of Object.values(s.J)) expect(Number.isFinite(p[0]) && Number.isFinite(p[1]), where).toBe(true);
    })(x),
  );

  it.each(variants)('$id $kind: declared contacts stay on their surface', (x) =>
    each((v, u) => {
      const s = frameAt(v, u);
      for (const c of v.contacts ?? []) {
        if (c.from !== undefined && (u < c.from || u > (c.to ?? 1))) continue;
        expect(s.J[c.j][1] + (c.r ?? 0), `${x.id} ${x.kind} u=${u.toFixed(3)} ${c.j}`).toBeCloseTo(c.y, 0);
      }
    })(x),
  );

  it.each(variants.filter((x) => (x.v.floor ?? 'mat') === 'mat'))('$id $kind: nothing goes through the floor', (x) =>
    each((v, u) => {
      const s = frameAt(v, u);
      expect(lowestY(s, v.front), `${x.id} ${x.kind} u=${u.toFixed(3)}`).toBeLessThan(3.5);
    })(x),
  );

  it('frames every exercise with the floor in view', () => {
    for (const d of Object.values(EXERCISE_ANIMS)) for (const v of [d.normal, d.easy]) {
      const b = viewBoxFor(v);
      expect(b.y1).toBeGreaterThan(21.9);
      expect((b.x1 - b.x0) / (b.y1 - b.y0)).toBeCloseTo(16 / 11, 6);
      // the whole figure fits in the frame
        for (let i = 0; i < 12; i++)
          for (const o of outline(frameAt(v, i / 12), v.front))
            for (const p of o.pts) {
              expect(p[0], d.id).toBeGreaterThan(b.x0);
              expect(p[0], d.id).toBeLessThan(b.x1);
              expect(p[1], d.id).toBeGreaterThan(b.y0);
            }
    }
  });

  it('blending keeps a shared anchor in place', () => {
    const v = EXERCISE_ANIMS.pushups.normal;
    const a = v.keys[0].pose.anchor!;
    for (let i = 0; i < 20; i++) {
      const p = poseAt(v, i / 20);
      expect(p.anchor?.j).toBe(a.j);
      const s = solve(p);
      expect(dist(s.J[a.j], a.at)).toBeLessThan(1e-6);
    }
  });
});
