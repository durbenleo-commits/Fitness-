// Small pieces shared by the Meisterschaft and Übungen screens and the hub.
import { QUEST_POOL, type LockInfo } from '../game';
import { masteryOf, pointsForTier, type MasteryPoints, type Requirement } from '../mastery';

export const titleOf = (id: string) => QUEST_POOL.find((t) => t.id === id)?.title ?? id;

/** Points with at most one decimal, German style (7,5). */
export const fmtPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

/** "Liegestütze Stufe 2 (7/10)" */
export const requirementText = (points: MasteryPoints, r: Requirement) =>
  `${titleOf(r.id)} Stufe ${r.tier} (${fmtPoints(Math.min(points[r.id] ?? 0, pointsForTier(r.tier)))}/${pointsForTier(r.tier)})`;

/** Only what is missing: "ab Level 20 · Braucht: Hollow Hold Stufe 3 (12/25)". */
export const lockText = (points: MasteryPoints, lock: LockInfo) =>
  [lock.level ? `ab Level ${lock.level}` : '', lock.unmet.length ? `Braucht: ${lock.unmet.map((r) => requirementText(points, r)).join(', ')}` : '']
    .filter(Boolean)
    .join(' · ');

export const isLocked = (lock: LockInfo) => lock.level !== null || lock.unmet.length > 0;

/** "Stufe 1 · 5/10" with a small bar to the next Stufe. */
export function MasteryLine({ points, id }: { points: MasteryPoints; id: string }) {
  const m = masteryOf(points, id);
  const label = m.tier === 0 ? 'Noch keine Stufe' : `Stufe ${m.tier}`;
  const from = pointsForTier(m.tier);
  const share = m.next === null ? 1 : (m.points - from) / (m.next - from);
  return (
    <span className="mastery-line" aria-label={`${label}${m.next === null ? ', höchste Stufe' : `, ${fmtPoints(m.points)} von ${m.next} bis zur nächsten`}`}>
      <span className={`tier-badge tier-${m.tier}`}>{label}</span>
      <span className="mastery-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(share * 100)}%` }} />
      </span>
      <span className="mastery-count">{m.next === null ? 'Höchste Stufe' : `${fmtPoints(m.points)}/${m.next}`}</span>
    </span>
  );
}
