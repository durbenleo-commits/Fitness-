import { useEffect, useId, useRef, useState } from 'react';
import { EXERCISE_ANIMS } from '../anim/exercises';
import {
  FAR_OFFSET,
  SK,
  add,
  angleOf,
  rad,
  cutFade,
  frameAt,
  outline,
  rot,
  sub,
  viewBoxFor,
  type Box,
  type ExerciseAnimDef,
  type JointName,
  type Prop,
  type Solved,
  type Vec,
  type VariantAnim,
} from '../anim/rig';
import './exercise-guide.css';

// Clay-style SVG puppet for the exercise animations. The rig math lives in anim/rig.ts; this file only draws.
// The SVG is built once per exercise and then updated in place every frame (no React render per frame).

const NS = 'http://www.w3.org/2000/svg';
const OUT = '#1b1535';
const LIGHT = ((): Vec => {
  const l = Math.hypot(0.42, 1);
  return [0.42 / l, 1 / l];
})();

function capsule(L: number, r0: number, r1: number, bulge = 1.1) {
  const mt = -((r0 + r1) / 2) * bulge;
  const mb = ((r0 + r1) / 2) * (bulge * 0.96);
  return `M0 ${-r0}Q${L / 2} ${mt} ${L} ${-r1}A${r1} ${r1} 0 0 1 ${L} ${r1}Q${L / 2} ${mb} 0 ${r0}A${r0} ${r0} 0 0 1 0 ${-r0}Z`;
}
const TORSO = 'M-14 1C-15-9-8-14 2-14C20-14 40-15 57-14C67-13 72-6 71 1C70 10 64 16 54 17C40 18 24 14 10 13C0 13-13 10-14 1Z';
const TORSO_FRONT = 'M-12-16C-16-6-16 6-12 16C0 18 18 18 32 19C46 21 56 24 64 18C70 12 70-12 64-18C56-24 46-21 32-19C18-18 0-18-12-16Z';
const HEAD = 'M-16 0C-16-10-9-16 1-16C11-16 17-9 17 0C17 10 11 16 1 16C-9 16-16 10-16 0Z';
const SHOE = 'M-9 0C-10-6-6-9.5-1-9.5L4-9C9-6.5 15-5 20-3.5C25-2 27 2 26.5 5L26 8L-7 8C-10 7.5-10 4-9 0Z';
const SHOE_FRONT = 'M-8 1C-8-4-5-6.5 0-6.5L5-6.5C9.5-6.5 12-3 12 2L12 8L-7 8C-9 7-9 4-8 1Z';
const HAND = 'M-4-5C3-6.5 10-6 14-4C18-2 18.5 3 15 5.5L13 6L-3 6C-7 5-8-3-4-5Z';

type Side = 'near' | 'far';
const COLORS: Record<Side, Record<string, string>> = {
  near: { skin: '#f2b38c', shirt: '#ff6b5b', shorts: '#4f49c9', shoe: '#ffd23f', sole: '#fff7e6', sock: '#f4f1e8', hair: '#3a2723' },
  far: { skin: '#c88a6a', shirt: '#c94b43', shorts: '#38339a', shoe: '#c9a22c', sole: '#cfc6b4', sock: '#b9b5c8', hair: '#3a2723' },
};

interface Detail {
  d?: string;
  useShape?: boolean;
  color?: string;
  fill?: string;
  clip?: string;
  stroke?: string;
  sw?: number;
  opacity?: number;
}
interface PartSpec {
  color: string;
  shape: (len: number) => string;
  center: (len: number) => Vec;
  radius: number;
  details?: Detail[];
}

function partSpecs(front: boolean): Record<string, PartSpec> {
  return {
    thigh: { color: 'skin', shape: (L) => capsule(L, 11.5, 8.6), center: (L) => [L / 2, 0], radius: 12, details: [{ useShape: true, color: 'shorts', clip: 'thighshorts' }, { d: 'M24-12.5L24 12.5', stroke: OUT, sw: 1.6, opacity: 0.45 }] },
    shin: { color: 'skin', shape: () => capsule(SK.shin, 8.6, 6.3, 1.16), center: () => [23, 0], radius: 9, details: [{ useShape: true, color: 'sock', clip: 'sock' }] },
    foot: front
      ? { color: 'shoe', shape: () => SHOE_FRONT, center: () => [2, 0], radius: 8, details: [{ d: 'M-8.5 4.2H12L12 8L-7 8C-8.8 7.6-9 6-8.5 4.2Z', color: 'sole' }, { d: 'M-2-4.5L5-4.5M-2-1.5L5-1.5', stroke: '#fff7e6', sw: 1.6 }] }
      : { color: 'shoe', shape: () => SHOE, center: () => [8, 0], radius: 9, details: [{ d: 'M-9.2 4.2H26.8L26 8L-7 8C-9.5 7.8-9.8 6-9.2 4.2Z', color: 'sole' }, { d: 'M5-7.5L7.5-3.5M10-6L12.5-2.5M15-4.6L17-1.6', stroke: '#fff7e6', sw: 1.7 }, { d: 'M-6-1C0-1.5 8 0 16 2.5', stroke: '#ff6b5b', sw: 2 }] },
    upper: { color: 'skin', shape: (L) => capsule(L, 8.8, 6.9), center: (L) => [L / 2, 0], radius: 10, details: [{ useShape: true, color: 'shirt', clip: 'sleeve' }] },
    fore: { color: 'skin', shape: () => capsule(SK.fore, 6.9, 5.4), center: () => [17, 0], radius: 8 },
    hand: { color: 'skin', shape: () => HAND, center: () => [6, 0], radius: 7, details: [{ d: 'M2-4C5-5.5 8.5-4.5 9-2', stroke: '#b9775a', sw: 1.4 }, { d: 'M10.5 1.5L15.5 1.8M9.5 4L14.5 4.4', stroke: '#b9775a', sw: 1.1, opacity: 0.8 }] },
    neck: { color: 'skin', shape: () => capsule(16, 6.8, 6.8, 1), center: () => [8, 0], radius: 7 },
    torso: front
      ? { color: 'shirt', shape: () => TORSO_FRONT, center: () => [28, 0], radius: 20, details: [{ useShape: true, color: 'shorts', clip: 'shorts' }, { d: 'M16-17.5L16 17.5', stroke: OUT, sw: 1.8, opacity: 0.5 }, { d: 'M62-9Q57 0 62 9', stroke: '#fff', sw: 2, opacity: 0.3 }] }
      : { color: 'shirt', shape: () => TORSO, center: () => [28, 1], radius: 17, details: [{ useShape: true, color: 'shorts', clip: 'shorts' }, { d: 'M16-14.5C17-4 17 6 16 13.5', stroke: OUT, sw: 1.8, opacity: 0.5 }, { d: 'M62-11C66-4 66 6 61 13', stroke: '#fff', sw: 2, opacity: 0.22 }] },
    head: front
      ? {
          color: 'skin',
          shape: () => HEAD,
          center: () => [0, 0],
          radius: 17,
          details: [
            { useShape: true, color: 'hair', clip: 'hairfront' },
            { d: 'M-1.5-6.5C-1.5-8.6 2-8.6 2-6.5C2-4.4-1.5-4.4-1.5-6.5Z', fill: OUT },
            { d: 'M-1.5 6.5C-1.5 4.4 2 4.4 2 6.5C2 8.6-1.5 8.6-1.5 6.5Z', fill: OUT },
            { d: 'M-8-4Q-11 0-8 4', stroke: OUT, sw: 1.6 },
            { d: 'M-5.5-11.5C-5.5-13 -3.5-13-3.5-11.5C-3.5-10-5.5-10-5.5-11.5ZM-5.5 11.5C-5.5 10 -3.5 10-3.5 11.5C-3.5 13-5.5 13-5.5 11.5Z', fill: '#ff8f7d', opacity: 0.6 },
          ],
        }
      : {
          color: 'skin',
          shape: () => HEAD,
          center: () => [0, 0],
          radius: 17,
          details: [
            { useShape: true, color: 'hair', clip: 'hair' },
            { d: 'M-4-3.5C-4-7 1-7.5 1.5-4C2-0.5-3.5 0.5-4-3.5Z', fill: '#e39a73', stroke: OUT, sw: 1.4 },
            { d: 'M4.5 9.2C4.5 7 8.5 7 8.5 9.2C8.5 11.6 4.5 11.6 4.5 9.2Z', fill: OUT },
            { d: 'M6.6 8.4L7.4 8.4', stroke: '#fff', sw: 1.2 },
            { d: 'M10.5 6.5Q12 9.5 11 12.3', stroke: OUT, sw: 1.6 },
            { d: 'M-5 9.5Q-3.5 13.5 0 13.5', stroke: OUT, sw: 1.6 },
            { d: 'M-1 7.5C-1 5.6 2.6 5.6 2.6 7.5C2.6 9.4-1 9.4-1 7.5Z', fill: '#ff8f7d', opacity: 0.55 },
          ],
        },
  };
}

type Attrs = Record<string, string | number>;
function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
}
const f2 = (n: number) => (Math.round(n * 100) / 100).toString();
const pt = (p: Vec) => `${f2(p[0])} ${f2(p[1])}`;

interface Layer {
  g: SVGGElement;
  out: SVGGElement;
  fill: SVGGElement;
}
type Updater = (origin: Vec, angle: number, len: number) => void;

/** Builds and updates the whole scene for one exercise. */
class Puppet {
  private defs: SVGDefsElement;
  private back: SVGGElement;
  private propsBack: SVGGElement;
  private propsMid: SVGGElement;
  private propsFront: SVGGElement;
  private figure: SVGGElement;
  private shadows: SVGGElement;
  private U: Record<string, Updater> = {};
  private bodyShadow: SVGEllipseElement;
  private contactEls: SVGEllipseElement[] = [];
  private propUpdaters: ((s: Solved, u: number) => void)[] = [];
  private seq = 0;
  private v!: VariantAnim;
  private vb: Box = { x0: 0, y0: 0, x1: 1, y1: 1 };

  constructor(
    private svg: SVGSVGElement,
    readonly def: ExerciseAnimDef,
    private uid: string,
  ) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    this.defs = el('defs', {}, svg);
    this.defs.innerHTML = `
      <linearGradient id="${uid}bgfloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e2b7a" stop-opacity="0"/><stop offset="1" stop-color="#14123a" stop-opacity=".55"/></linearGradient>
      <linearGradient id="${uid}mattop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fd8cd"/><stop offset="1" stop-color="#3fc9bd"/></linearGradient>
      <linearGradient id="${uid}matedge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#249a90"/><stop offset="1" stop-color="#1a6f69"/></linearGradient>
      <linearGradient id="${uid}water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5aa9ff" stop-opacity=".55"/><stop offset="1" stop-color="#2f5fd0" stop-opacity=".75"/></linearGradient>
      <linearGradient id="${uid}metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f1e8"/><stop offset="1" stop-color="#9c98c8"/></linearGradient>
      <radialGradient id="${uid}contact"><stop offset="0" stop-color="#0b2b33" stop-opacity=".55"/><stop offset="1" stop-color="#0b2b33" stop-opacity="0"/></radialGradient>
      <radialGradient id="${uid}spot" cx=".5" cy=".35" r=".6"><stop offset="0" stop-color="#5550c0" stop-opacity=".55"/><stop offset="1" stop-color="#5550c0" stop-opacity="0"/></radialGradient>
      <radialGradient id="${uid}iron" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#6d68b8"/><stop offset="1" stop-color="#25224f"/></radialGradient>
      <clipPath id="${uid}shorts" clipPathUnits="userSpaceOnUse"><rect x="-40" y="-40" width="56" height="80"/></clipPath>
      <clipPath id="${uid}thighshorts" clipPathUnits="userSpaceOnUse"><rect x="-40" y="-40" width="64" height="80"/></clipPath>
      <clipPath id="${uid}sleeve" clipPathUnits="userSpaceOnUse"><rect x="-40" y="-40" width="54" height="80"/></clipPath>
      <clipPath id="${uid}sock" clipPathUnits="userSpaceOnUse"><rect x="37" y="-40" width="40" height="80"/></clipPath>
      <clipPath id="${uid}hair" clipPathUnits="userSpaceOnUse"><path d="M-30-30H40V-30 2C30 1 22-3 16-1C12 0 8-8 0-7C-6-6-8 4-30 6Z"/></clipPath>
      <clipPath id="${uid}hairfront" clipPathUnits="userSpaceOnUse"><path d="M30-30V30H8C9 20 12 14 9 12C6 8 3 4 4 0C3-4 6-8 9-12C12-14 9-20 8-30Z"/></clipPath>
      <filter id="${uid}soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2.5" stdDeviation="2" flood-color="#0b0828" flood-opacity=".35"/></filter>`;
    this.back = el('g', {}, svg);
    this.propsBack = el('g', {}, svg);
    this.shadows = el('g', {}, svg);
    this.bodyShadow = el('ellipse', { fill: `url(#${uid}contact)` }, this.shadows);
    for (let i = 0; i < 8; i++) this.contactEls.push(el('ellipse', { fill: `url(#${uid}contact)` }, this.shadows));
    this.figure = el('g', {}, svg);
    this.propsFront = el('g', {}, svg);
    this.propsMid = el('g', {}, svg); // re-parented into the figure below
  }

  private makePart(layer: Layer, spec: PartSpec, side: Side): Updater {
    const c = COLORS[side];
    const gid = `${this.uid}g${this.seq++}`;
    const grad = el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse' }, this.defs);
    for (const [o, col, op] of [[0, '#ffffff', 0.42], [0.32, '#ffffff', 0], [0.5, '#0b0828', 0], [1, '#0b0828', 0.5]] as const)
      el('stop', { offset: o, 'stop-color': col, 'stop-opacity': op }, grad);
    const outlineEl = el('path', { fill: OUT, stroke: OUT, 'stroke-width': 5, 'stroke-linejoin': 'round' }, layer.out);
    const g = el('g', {}, layer.fill);
    const base = el('path', { fill: c[spec.color] }, g);
    const details = (spec.details ?? []).map((dt) => {
      const e = el('path', { d: dt.d ?? '', fill: dt.color ? c[dt.color] : dt.fill ?? 'none' }, g);
      if (dt.clip) e.setAttribute('clip-path', `url(#${this.uid}${dt.clip})`);
      if (dt.stroke) {
        e.setAttribute('stroke', dt.stroke);
        e.setAttribute('stroke-width', String(dt.sw ?? 1.6));
        e.setAttribute('stroke-linecap', 'round');
      }
      if (dt.opacity) e.setAttribute('opacity', String(dt.opacity));
      return { e, dt };
    });
    const shade = el('path', { fill: `url(#${gid})` }, g);
    let lastLen = NaN;
    return (origin, angle, len) => {
      if (len !== lastLen) {
        const d = spec.shape(len);
        outlineEl.setAttribute('d', d);
        base.setAttribute('d', d);
        shade.setAttribute('d', d);
        for (const { e, dt } of details) if (dt.useShape) e.setAttribute('d', d);
        lastLen = len;
      }
      const tf = `translate(${pt(origin)}) rotate(${f2(angle)})`;
      outlineEl.setAttribute('transform', tf);
      g.setAttribute('transform', tf);
      // aim the shading so the light stays fixed in world space
      const ld = rot(-angle, LIGHT);
      const cc = spec.center(len);
      const r = spec.radius;
      grad.setAttribute('x1', f2(cc[0] - ld[0] * r));
      grad.setAttribute('y1', f2(cc[1] - ld[1] * r));
      grad.setAttribute('x2', f2(cc[0] + ld[0] * r));
      grad.setAttribute('y2', f2(cc[1] + ld[1] * r));
    };
  }

  /** (Re)build the figure, backdrop and props for one variant. */
  setVariant(v: VariantAnim) {
    this.v = v;
    this.vb = viewBoxFor(v);
    const { x0, y0, x1, y1 } = this.vb;
    this.svg.setAttribute('viewBox', `${f2(x0)} ${f2(y0)} ${f2(x1 - x0)} ${f2(y1 - y0)}`);
    const front = !!v.front;
    for (const g of [this.back, this.propsBack, this.propsMid, this.propsFront, this.figure]) while (g.firstChild) g.removeChild(g.firstChild);
    // drop old part gradients
    this.defs.querySelectorAll(`[id^="${this.uid}g"]`).forEach((n) => n.remove());
    this.buildBackdrop(v);
    const P = partSpecs(front);
    const mk = () => {
      const g = el('g', {}, this.figure);
      return { g, out: el('g', {}, g), fill: el('g', {}, g) } as Layer;
    };
    const farSide: Side = front ? 'near' : 'far';
    const farLeg = mk();
    const farArm = mk();
    this.figure.appendChild(this.propsMid);
    const body = mk();
    const nearLeg = mk();
    const nearArm = mk();
    nearArm.g.setAttribute('filter', `url(#${this.uid}soft)`);
    nearLeg.g.setAttribute('filter', `url(#${this.uid}soft)`);
    this.U = {};
    for (const [s, side, leg, arm] of [['f', farSide, farLeg, farArm], ['n', 'near', nearLeg, nearArm]] as const) {
      this.U[s + 'thigh'] = this.makePart(leg, P.thigh, side);
      this.U[s + 'shin'] = this.makePart(leg, P.shin, side);
      this.U[s + 'foot'] = this.makePart(leg, P.foot, side);
      this.U[s + 'upper'] = this.makePart(arm, P.upper, side);
      this.U[s + 'fore'] = this.makePart(arm, P.fore, side);
      this.U[s + 'hand'] = this.makePart(arm, P.hand, side);
    }
    this.U.neck = this.makePart(body, P.neck, 'near');
    this.U.torso = this.makePart(body, P.torso, 'near');
    this.U.head = this.makePart(body, P.head, 'near');
    this.propUpdaters = (v.props ?? []).map((p) => this.buildProp(p));
  }

  private buildBackdrop(v: VariantAnim) {
    const { x0, x1, y0, y1 } = this.vb;
    const W = x1 - x0;
    const u = this.uid;
    const back = this.back;
    el('ellipse', { cx: (x0 + x1) / 2, cy: y0 + (y1 - y0) * 0.4, rx: W * 0.62, ry: (y1 - y0) * 0.8, fill: `url(#${u}spot)` }, back);
    if (v.floor === 'water') {
      el('rect', { x: x0, y: y0, width: W, height: y1 - y0, fill: '#1c1a52' }, back);
      return;
    }
    el('rect', { x: x0, y: -26, width: W, height: y1 + 26, fill: `url(#${u}bgfloor)` }, back);
    const grid = el('g', { stroke: 'rgba(130,120,255,.22)', 'stroke-width': 1.2 }, back);
    const cx = (x0 + x1) / 2;
    for (let i = -14; i <= 14; i++) el('line', { x1: cx + i * 22, y1: -26, x2: cx + i * 60, y2: y1 + 20 }, grid);
    for (const y of [-26, -14, 4, 28]) el('line', { x1: x0, y1: y, x2: x1, y2: y }, grid);
    if (v.floor === 'none') return;
    const mx0 = x0 + 14;
    const mx1 = x1 - 14;
    el('path', { d: `M${mx0 + 8} -12H${mx1 - 8}L${mx1} 10H${mx0}Z`, fill: `url(#${u}mattop)` }, back);
    el('path', { d: `M${mx0} 10H${mx1}V17Q${mx1} 19 ${mx1 - 2} 19H${mx0 + 2}Q${mx0} 19 ${mx0} 17Z`, fill: `url(#${u}matedge)` }, back);
    el('path', { d: `M${mx0 + 9} -11H${mx1 - 9}`, stroke: 'rgba(255,255,255,.45)', 'stroke-width': 1.5, 'stroke-linecap': 'round' }, back);
  }

  private joint(s: Solved, p: JointName | Vec): Vec {
    if (Array.isArray(p)) return p;
    const q = s.J[p];
    return p[0] === 'f' && !this.v.front ? add(q, FAR_OFFSET) : q;
  }

  /** Clay slab: outlined block with a lighter top face. */
  private slab(parent: SVGGElement, x: number, y: number, w: number, h: number, face: string, edge: string, top = 6) {
    el('rect', { x, y, width: w, height: h, rx: 4, fill: edge, stroke: OUT, 'stroke-width': 2.5 }, parent);
    el('rect', { x: x + 1.5, y: y + 1.5, width: w - 3, height: Math.min(top, h - 3), rx: 3, fill: face }, parent);
  }

  private buildProp(p: Prop): (s: Solved, u: number) => void {
    const at = p.at ?? [0, 0];
    const w = p.w ?? 40;
    const h = p.h ?? 46;
    const front = p.k === 'dumbbell' || p.k === 'kettlebell' || p.k === 'band' || p.k === 'rope';
    const farAttached = p.j?.startsWith('f') && !this.v.front;
    const parent = el('g', {}, farAttached ? this.propsMid : front ? this.propsFront : this.propsBack);
    const show = (u: number) => {
      if (!p.on) return;
      const vis = u >= p.on[0] && u < p.on[1];
      parent.setAttribute('display', vis ? 'inline' : 'none');
    };
    const none = (_s: Solved, u: number) => show(u);
    switch (p.k) {
      case 'chair': {
        // seat on four legs; optional backrest on one side
        const legC = '#b8693a';
        el('rect', { x: at[0] + 4, y: -h, width: 6, height: h, fill: '#9a5730', stroke: OUT, 'stroke-width': 2 }, parent);
        el('rect', { x: at[0] + w - 10, y: -h, width: 6, height: h, fill: legC, stroke: OUT, 'stroke-width': 2 }, parent);
        if (p.facing) {
          const bx = p.facing < 0 ? at[0] + 2 : at[0] + w - 10;
          el('rect', { x: bx, y: -h - 46, width: 8, height: 48, rx: 3, fill: legC, stroke: OUT, 'stroke-width': 2.5 }, parent);
          el('rect', { x: bx - 2, y: -h - 48, width: 12, height: 18, rx: 4, fill: '#f0a868', stroke: OUT, 'stroke-width': 2.5 }, parent);
        }
        this.slab(parent, at[0], -h - 7, w, 9, '#ffc58f', '#f0a868', 4);
        return none;
      }
      case 'box':
        this.slab(parent, at[0], -h, w, h, '#ffc58f', '#f0a868', 7);
        return none;
      case 'wall': {
        const left = (p.facing ?? -1) < 0;
        const ww = Math.max(30, left ? at[0] - this.vb.x0 + 10 : this.vb.x1 - at[0] + 10);
        const x = left ? at[0] - ww : at[0];
        el('rect', { x, y: this.vb.y0 - 10, width: ww, height: -this.vb.y0 + 10, fill: '#3d3a99', stroke: OUT, 'stroke-width': 2.5 }, parent);
        el('rect', { x: left ? at[0] - 7 : at[0], y: this.vb.y0 - 10, width: 7, height: -this.vb.y0 + 10, fill: '#5450c0' }, parent);
        const lines = el('g', { stroke: 'rgba(255,255,255,.07)', 'stroke-width': 1.5 }, parent);
        for (let y = -20, i = 0; y > this.vb.y0; y -= 22, i++) {
          el('line', { x1: x, y1: y, x2: x + ww, y2: y }, lines);
          for (let bx = x + (i % 2 ? 18 : 0); bx < x + ww; bx += 36) el('line', { x1: bx, y1: y, x2: bx, y2: y - 22 }, lines);
        }
        return none;
      }
      case 'bar': {
        // bar seen end-on. Low bar: on a stand. High bar: a rack behind the figure (post + top arm).
        const low = at[1] > -160;
        const px = at[0] - 78;
        const d = low ? `M${at[0]} ${at[1]}V0M${at[0] - 16} 0H${at[0] + 16}` : `M${px} 0V${at[1] - 10}H${at[0]}M${px - 18} 0H${px + 18}`;
        el('path', { d, stroke: OUT, 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }, parent);
        el('path', { d, stroke: '#7d78c9', 'stroke-width': 6.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }, parent);
        if (!low) el('path', { d: `M${at[0]} ${at[1] - 10}V${at[1]}`, stroke: OUT, 'stroke-width': 5, 'stroke-linecap': 'round' }, parent);
        // the bar itself sits in front of the hands so the grip reads as wrapped around it
        const barEnd = el('g', {}, this.propsFront);
        el('circle', { cx: at[0], cy: at[1], r: 7, fill: `url(#${this.uid}metal)`, stroke: OUT, 'stroke-width': 2.5 }, barEnd);
        return none;
      }
      case 'post': {
        el('rect', { x: at[0] - 5, y: at[1] - 12, width: 10, height: -at[1] + 12, rx: 3, fill: '#5450c0', stroke: OUT, 'stroke-width': 2.5 }, parent);
        el('circle', { cx: at[0], cy: at[1], r: 5, fill: '#ffd23f', stroke: OUT, 'stroke-width': 2 }, parent);
        return none;
      }
      case 'dumbbell': {
        const r = 9.5 * (p.size ?? 1);
        const disc = el('g', {}, parent);
        el('circle', { r, fill: `url(#${this.uid}iron)`, stroke: OUT, 'stroke-width': 2.5 }, disc);
        el('circle', { r: r * 0.45, fill: '#4a46a8', stroke: OUT, 'stroke-width': 1.5 }, disc);
        el('path', { d: `M${-r * 0.6} ${-r * 0.55}A${r * 0.8} ${r * 0.8} 0 0 1 ${r * 0.3} ${-r * 0.8}`, stroke: '#fff', 'stroke-width': 1.6, opacity: 0.5, fill: 'none', 'stroke-linecap': 'round' }, disc);
        return (s, u) => {
          show(u);
          const side = p.j![0] as 'n' | 'f';
          const c = add(this.joint(s, p.j!), rot(s.ang[`${side}Hand`], [7, 0.5]));
          disc.setAttribute('transform', `translate(${pt(c)})`);
        };
      }
      case 'kettlebell': {
        const r = 13 * (p.size ?? 1);
        const g = el('g', {}, parent);
        el('path', { d: `M${-r * 0.55} ${-r * 0.7}C${-r * 0.6} ${-r * 1.9} ${r * 0.6} ${-r * 1.9} ${r * 0.55} ${-r * 0.7}`, stroke: OUT, 'stroke-width': 6, fill: 'none' }, g);
        el('path', { d: `M${-r * 0.55} ${-r * 0.7}C${-r * 0.6} ${-r * 1.9} ${r * 0.6} ${-r * 1.9} ${r * 0.55} ${-r * 0.7}`, stroke: '#4a46a8', 'stroke-width': 3, fill: 'none' }, g);
        el('circle', { cy: 0, r, fill: `url(#${this.uid}iron)`, stroke: OUT, 'stroke-width': 2.5 }, g);
        el('path', { d: `M${-r * 0.55} ${-r * 0.35}A${r * 0.7} ${r * 0.7} 0 0 1 ${r * 0.1} ${-r * 0.75}`, stroke: '#fff', 'stroke-width': 1.6, opacity: 0.45, fill: 'none', 'stroke-linecap': 'round' }, g);
        return (s, u) => {
          show(u);
          const side = p.j![0] as 'n' | 'f';
          const a = s.ang[`${side}Hand`];
          const c = add(this.joint(s, p.j!), rot(a, [8 + r * 1.35, 0]));
          g.setAttribute('transform', `translate(${pt(c)}) rotate(${f2(a - 90)})`);
        };
      }
      case 'band': {
        const o = el('path', { fill: 'none', stroke: OUT, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
        const i = el('path', { fill: 'none', stroke: p.color ?? '#3fc9bd', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
        return (s, u) => {
          show(u);
          const d = 'M' + (p.pts ?? []).map((q) => pt(this.joint(s, q))).join('L');
          o.setAttribute('d', d);
          i.setAttribute('d', d);
        };
      }
      case 'rope': {
        const o = el('path', { fill: 'none', stroke: OUT, 'stroke-width': 4.5, 'stroke-linecap': 'round' }, parent);
        const i = el('path', { fill: 'none', stroke: '#ffd23f', 'stroke-width': 2, 'stroke-linecap': 'round' }, parent);
        const turns = p.n ?? 1;
        return (s, u) => {
          show(u);
          const wN = this.joint(s, 'nWrist');
          const wF = this.joint(s, 'fWrist');
          const c: Vec = [(wN[0] + wF[0]) / 2 - 6, (wN[1] + wF[1]) / 2];
          // the rope tip circles the body: overhead at u = 0, under the feet at u = 0.5 (the hop)
          const th = rad(-90 + 360 * turns * u);
          const down = -c[1] + 3;
          const tip: Vec = [c[0] + Math.cos(th) * 70, c[1] + Math.sin(th) * (Math.sin(th) > 0 ? down : 120)];
          const v = sub(tip, c);
          const n = Math.hypot(v[0], v[1]) || 1;
          const side: Vec = [(-v[1] / n) * 22, (v[0] / n) * 22];
          const m = add(c, [v[0] * 0.75, v[1] * 0.75]);
          const d = `M${pt(wN)}Q${pt(add(m, side))} ${pt(tip)}Q${pt(sub(m, side))} ${pt(wF)}`;
          o.setAttribute('d', d);
          i.setAttribute('d', d);
        };
      }
      case 'bike': {
        // stationary bike: crank at `at`
        const C = at;
        const frame = `M${C[0] - 34} ${-4}L${C[0]} ${C[1]}L${C[0] - 34} ${C[1] - 62}M${C[0]} ${C[1]}L${C[0] + 30} ${C[1] - 78}M${C[0] + 56} -4L${C[0] + 40} ${C[1] - 40}L${C[0] + 30} ${C[1] - 78}`;
        el('path', { d: frame, stroke: OUT, 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }, parent);
        el('path', { d: frame, stroke: '#7a6cf0', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }, parent);
        el('path', { d: `M${C[0] - 44} -2H${C[0] + 66}`, stroke: OUT, 'stroke-width': 9, 'stroke-linecap': 'round' }, parent);
        el('path', { d: `M${C[0] - 44} -2H${C[0] + 66}`, stroke: '#5450c0', 'stroke-width': 5, 'stroke-linecap': 'round' }, parent);
        el('circle', { cx: C[0] + 40, cy: C[1] - 40, r: 22, fill: '#2f2c7c', stroke: OUT, 'stroke-width': 3 }, parent);
        el('circle', { cx: C[0] + 40, cy: C[1] - 40, r: 9, fill: '#5450c0', stroke: OUT, 'stroke-width': 2 }, parent);
        // saddle and handlebar
        el('path', { d: `M${C[0] - 50} ${C[1] - 66}Q${C[0] - 34} ${C[1] - 72} ${C[0] - 20} ${C[1] - 66}L${C[0] - 22} ${C[1] - 60}L${C[0] - 48} ${C[1] - 60}Z`, fill: '#3a2723', stroke: OUT, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, parent);
        el('path', { d: `M${C[0] + 30} ${C[1] - 78}L${C[0] + 22} ${C[1] - 88}L${C[0] + 34} ${C[1] - 90}`, stroke: OUT, 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
        el('path', { d: `M${C[0] + 30} ${C[1] - 78}L${C[0] + 22} ${C[1] - 88}L${C[0] + 34} ${C[1] - 90}`, stroke: '#d9d6ee', 'stroke-width': 3.5, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
        // cranks (far one behind the figure, near one in front)
        const farCrank = el('path', { stroke: OUT, 'stroke-width': 6, 'stroke-linecap': 'round' }, this.propsMid);
        const nearCrankO = el('path', { stroke: OUT, 'stroke-width': 7, 'stroke-linecap': 'round' }, this.propsFront);
        const nearCrank = el('path', { stroke: '#d9d6ee', 'stroke-width': 3.5, 'stroke-linecap': 'round' }, this.propsFront);
        el('circle', { cx: C[0], cy: C[1], r: 7, fill: '#d9d6ee', stroke: OUT, 'stroke-width': 2.5 }, this.propsFront);
        return (s) => {
          const nb = s.J.nBall;
          const fb = this.joint(s, 'fBall');
          farCrank.setAttribute('d', `M${pt(add(C, FAR_OFFSET))}L${pt(fb)}`);
          nearCrankO.setAttribute('d', `M${pt(C)}L${pt(nb)}`);
          nearCrank.setAttribute('d', `M${pt(C)}L${pt(nb)}`);
        };
      }
      case 'water': {
        const y = at[1];
        const { x0, x1, y1 } = this.vb;
        el('rect', { x: x0, y, width: x1 - x0, height: y1 - y, fill: '#2b3f9a' }, this.propsBack);
        const front = el('path', { fill: `url(#${this.uid}water)` }, this.propsFront);
        const crest = el('path', { fill: 'none', stroke: '#bfe3ff', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.8 }, this.propsFront);
        return (_s, u) => {
          let d = `M${x0} ${y}`;
          let c = `M${x0} ${y}`;
          for (let x = x0; x <= x1 + 10; x += 10) {
            const yy = y + Math.sin(x / 14 + u * Math.PI * 4) * 1.6;
            d += `L${f2(x)} ${f2(yy)}`;
            c += `L${f2(x)} ${f2(yy)}`;
          }
          d += `L${x1 + 10} ${y1}L${x0} ${y1}Z`;
          front.setAttribute('d', d);
          crest.setAttribute('d', c);
        };
      }
      case 'stairs': {
        const n = p.n ?? 4;
        const g = el('g', {}, parent);
        let d = `M${at[0] - 3 * w} 60`;
        for (let i = -3; i <= n + 2; i++) {
          const x = at[0] + i * w;
          const y = at[1] - i * h;
          d += `L${x} ${y}L${x + w} ${y}`;
        }
        d += `L${at[0] + (n + 3) * w} 60Z`;
        el('path', { d, fill: '#4a46a8', stroke: OUT, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, g);
        for (let i = -3; i <= n + 2; i++) {
          const x = at[0] + i * w;
          const y = at[1] - i * h;
          el('rect', { x: x + 1.5, y: y + 1.5, width: w - 1.5, height: 5, fill: '#6f6ad6' }, g);
        }
        const dx = -w * (p.scroll ?? 0);
        const dy = h * (p.scroll ?? 0);
        return (_s, u) => {
          show(u);
          g.setAttribute('transform', `translate(${f2(dx * u)} ${f2(dy * u)})`);
        };
      }
      case 'rail': {
        const a = at;
        const b: Vec = [at[0] + w, at[1] - h];
        el('path', { d: `M${pt(a)}L${pt(b)}`, stroke: OUT, 'stroke-width': 8, 'stroke-linecap': 'round' }, parent);
        el('path', { d: `M${pt(a)}L${pt(b)}`, stroke: '#d9d6ee', 'stroke-width': 4, 'stroke-linecap': 'round' }, parent);
        return none;
      }
      case 'machine': {
        // lat pulldown: seat at `at` (seat top centre), column on the right, pulley on top
        const col = at[0] + 70;
        el('rect', { x: col - 10, y: -250, width: 20, height: 250, rx: 4, fill: '#36338c', stroke: OUT, 'stroke-width': 2.5 }, parent);
        const plates = p.n ?? 6;
        for (let i = 0; i < 8; i++)
          el('rect', { x: col - 16, y: -8 - (i + 1) * 9, width: 32, height: 8, rx: 2, fill: i < plates ? '#ff6b5b' : '#5450c0', stroke: OUT, 'stroke-width': 1.8 }, parent);
        el('path', { d: `M${col} -240H${at[0] + 10}`, stroke: OUT, 'stroke-width': 10, 'stroke-linecap': 'round' }, parent);
        el('path', { d: `M${col} -240H${at[0] + 10}`, stroke: '#5450c0', 'stroke-width': 6, 'stroke-linecap': 'round' }, parent);
        el('circle', { cx: at[0] + 10, cy: -236, r: 7, fill: '#d9d6ee', stroke: OUT, 'stroke-width': 2 }, parent);
        this.slab(parent, at[0] - 26, at[1], 52, 10, '#ffc58f', '#f0a868', 4);
        el('rect', { x: at[0] - 4, y: at[1] + 10, width: 8, height: -at[1] - 10, fill: '#36338c', stroke: OUT, 'stroke-width': 2 }, parent);
        el('rect', { x: at[0] + 22, y: at[1] - 46, width: 14, height: 14, rx: 6, fill: '#f0a868', stroke: OUT, 'stroke-width': 2.5 }, parent);
        el('path', { d: `M${at[0] + 29} ${at[1] - 32}V${at[1] + 10}`, stroke: OUT, 'stroke-width': 5 }, parent);
        const cable = el('path', { stroke: '#d9d6ee', 'stroke-width': 1.8 }, parent);
        const barO = el('path', { stroke: OUT, 'stroke-width': 8, 'stroke-linecap': 'round' }, this.propsFront);
        const bar = el('path', { stroke: '#d9d6ee', 'stroke-width': 4, 'stroke-linecap': 'round' }, this.propsFront);
        return (s) => {
          const wN = s.J.nWrist;
          const top: Vec = [at[0] + 10, -236];
          cable.setAttribute('d', `M${pt(top)}L${pt(add(wN, [2, -6]))}`);
          const a = add(wN, [-14, 4]);
          const b = add(wN, [18, -3]);
          barO.setAttribute('d', `M${pt(a)}L${pt(b)}`);
          bar.setAttribute('d', `M${pt(a)}L${pt(b)}`);
        };
      }
    }
    return none;
  }

  render(u: number) {
    const v = this.v;
    const s = frameAt(v, u);
    const { J, ang, len } = s;
    const far: Vec = v.front ? [0, 0] : FAR_OFFSET;
    for (const side of ['f', 'n'] as const) {
      const o: Vec = side === 'f' ? far : [0, 0];
      const at = (p: Vec) => add(p, o);
      this.U[side + 'thigh'](at(J[`${side}Hip`]), ang[`${side}Thigh`], len[`${side}Thigh`]);
      this.U[side + 'shin'](at(J[`${side}Knee`]), ang[`${side}Shin`], SK.shin);
      this.U[side + 'foot'](at(J[`${side}Ankle`]), ang[`${side}Foot`], 0);
      this.U[side + 'upper'](at(J[`${side}Shoulder`]), ang[`${side}Upper`], len[`${side}Upper`]);
      this.U[side + 'fore'](at(J[`${side}Elbow`]), ang[`${side}Fore`], SK.fore);
      this.U[side + 'hand'](at(J[`${side}Wrist`]), ang[`${side}Hand`], 0);
    }
    this.U.neck(J.neck, angleOf(sub(J.head, J.neck)), 16);
    this.U.torso(J.pelvis, ang.torso, 0);
    this.U.head(J.head, ang.head, 0);
    for (const up of this.propUpdaters) up(s, u);
    this.figure.setAttribute('opacity', f2(cutFade(v, u)));
    this.shade(s);
  }

  /** Soft contact shadows where a part touches the floor. */
  private shade(s: Solved) {
    const v = this.v;
    let i = 0;
    const hide = () => {
      while (i < this.contactEls.length) this.contactEls[i++].setAttribute('rx', '0');
    };
    if (v.floor === 'water') {
      this.bodyShadow.setAttribute('rx', '0');
      hide();
      return;
    }
    const far: Vec = v.front ? [0, 0] : FAR_OFFSET;
    for (const o of outline(s, v.front)) {
      if (i >= this.contactEls.length) break;
      if (o.part === 'torso' || o.part === 'head') continue;
      let lo = -Infinity;
      let x = 0;
      let n = 0;
      for (const p of o.pts) if (p[1] > lo) lo = p[1];
      if (lo < -4) continue;
      for (const p of o.pts)
        if (p[1] > lo - 3) {
          x += p[0];
          n++;
        }
      const off = o.side === 'f' ? far : ([0, 0] as Vec);
      const e = this.contactEls[i++];
      e.setAttribute('cx', f2(x / n + off[0]));
      e.setAttribute('cy', f2(1.5 + off[1]));
      e.setAttribute('rx', o.part === 'foot' ? '14' : '10');
      e.setAttribute('ry', '3.6');
    }
    hide();
    const mid = (s.J.pelvis[0] + s.J.neck[0]) / 2;
    const h = -(s.J.pelvis[1] + s.J.neck[1]) / 2;
    this.bodyShadow.setAttribute('cx', f2(mid));
    this.bodyShadow.setAttribute('cy', '1');
    this.bodyShadow.setAttribute('rx', '62');
    this.bodyShadow.setAttribute('ry', '6');
    this.bodyShadow.setAttribute('opacity', f2(Math.max(0.2, Math.min(1, 1.25 - h / 90))));
  }
}

function usePrefersReducedMotion() {
  const q = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const on = () => setReduced(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

export interface ExerciseAnimProps {
  exerciseId: string;
  /** Show the easier variant. */
  easy: boolean;
  /** Called when the person switches the variant in the animation (tap or toggle). */
  onEasyChange?: (easy: boolean) => void;
  /** Pause the loop (for example while the surrounding sheet is closing). Default true. */
  active?: boolean;
  /** Freeze on this cycle time (0..1) instead of playing. For still images and tests. */
  freezeAt?: number;
  /** Show the Normal/Leichter switch and let a tap on the picture switch. Default true; false when the version is chosen elsewhere. */
  switchable?: boolean;
}

/**
 * Looping animation of one exercise. Tapping the picture or the Normal/Leichter switch changes the variant.
 * It only animates while visible and active; with reduced motion it shows a still pose.
 */
export function ExerciseAnim({ exerciseId, easy, onEasyChange, active = true, freezeAt, switchable = true }: ExerciseAnimProps) {
  const def = EXERCISE_ANIMS[exerciseId];
  const svgRef = useRef<SVGSVGElement>(null);
  const puppetRef = useRef<Puppet | null>(null);
  const clockRef = useRef(0);
  const uid = 'xa' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const [isEasy, setIsEasy] = useState(easy);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const reduced = usePrefersReducedMotion();

  useEffect(() => setIsEasy(easy), [easy]);
  const variant = def ? (isEasy ? def.easy : def.normal) : undefined;

  // build the scene for this exercise, rebuild the figure when the variant changes
  useEffect(() => {
    if (!def || !svgRef.current) return;
    if (!puppetRef.current || puppetRef.current.def !== def) puppetRef.current = new Puppet(svgRef.current, def, uid);
    puppetRef.current.setVariant(variant!);
    clockRef.current = 0;
    puppetRef.current.render(freezeAt ?? variant!.still ?? 0.5);
  }, [def, variant, uid, freezeAt]);

  // only animate while on screen
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => setVisible(es.some((e) => e.isIntersecting)));
    io.observe(svg);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const on = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  const playing = !!variant && active && visible && pageVisible && !reduced && freezeAt === undefined;
  useEffect(() => {
    if (!playing || !variant) {
      if (variant && reduced && freezeAt === undefined) puppetRef.current?.render(variant.still ?? 0.5);
      return;
    }
    let raf = 0;
    let last: number | null = null;
    const loop = (ts: number) => {
      if (last !== null) clockRef.current += Math.min(0.1, (ts - last) / 1000);
      last = ts;
      puppetRef.current?.render((clockRef.current / variant.dur) % 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, variant, reduced, freezeAt]);

  const choose = (next: boolean) => {
    setIsEasy(next);
    onEasyChange?.(next);
  };

  if (!def || !variant) return null;
  return (
    <div className="xanim">
      <svg
        ref={svgRef}
        className="xanim-svg"
        role="img"
        aria-label={switchable ? `${variant.name}: Animation. Tippen wechselt zwischen normal und leichter.` : `${variant.name}: Animation`}
        onClick={switchable ? () => choose(!isEasy) : undefined}
        style={switchable ? undefined : { cursor: 'default' }}
      />
      {switchable && (
        <div className="xanim-bar">
          <div className="xanim-switch" role="group" aria-label="Variante">
            <button type="button" aria-pressed={!isEasy} onClick={() => choose(false)}>
              Normal
            </button>
            <button type="button" aria-pressed={isEasy} onClick={() => choose(true)}>
              Leichter
            </button>
          </div>
          <span className="xanim-hint">{reduced ? 'Standbild' : 'Antippen zum Wechseln'}</span>
        </div>
      )}
    </div>
  );
}
