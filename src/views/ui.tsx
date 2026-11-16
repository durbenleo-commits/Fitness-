import { useEffect, type ReactNode } from 'react';
import type { Battle } from '../battle';
import type { HealthMetric, Proof, ProofKind } from '../proof';
import { Badge3D, Icon, type IconName } from './Icons';
import { Sprite } from './Sprites';
import { ATTR_LABEL, BOSS_ATTR_POINTS, DEFAULT_EQUIPMENT, ENEMY_ATTR_POINTS, EQUIPMENT, rankFor, type Equipment } from '../game';

export function Segmented<T extends string | number>(props: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {props.options.map((o) => (
        <button type="button" key={String(o.value)} aria-pressed={props.value === o.value} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LevelUp({ level, onClose }: { level: number; onClose: () => void }) {
  const rankChanged = rankFor(level) !== rankFor(level - 1);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="lvlup-title" onClick={onClose}>
      <div className="lvlup" onClick={(e) => e.stopPropagation()}>
        <span id="lvlup-title" className="display lvlup-title">
          Level up
        </span>
        <span className="lvlup-hex">
          <span className="display lvlup-num">{level}</span>
        </span>
        <p>{rankChanged ? `Neuer Rang: ${rankFor(level)}. ` : ''}Deine Quests werden ab morgen etwas schwerer.</p>
        <button className="primary" onClick={onClose} autoFocus>
          Weiter
        </button>
      </div>
    </div>
  );
}

export function Toast({ icon, tier, title, onDone }: { icon: IconName; tier: 'bronze' | 'silver' | 'gold'; title: string; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 3500);
    return () => window.clearTimeout(t);
  }, [onDone, title]);
  return (
    <div className="toast" role="status" onClick={onDone}>
      <Badge3D icon={icon} tone={tier} shape="coin" size={46} />
      <span>
        <span className="toast-label">Erfolg freigeschaltet</span>
        <strong>{title}</strong>
      </span>
    </div>
  );
}

export function Victory({ battle: b, onClose }: { battle: Battle; onClose: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="victory-title" onClick={onClose}>
      <div className="lvlup" onClick={(e) => e.stopPropagation()}>
        <span id="victory-title" className="display lvlup-title">
          {b.boss ? 'Boss besiegt' : 'Sieg'}
        </span>
        <Sprite enemyId={b.enemyId} className="victory-enemy" />
        <p>
          <strong>{b.name}</strong> ist erledigt. Du bekommst {b.xp} XP und {b.boss ? BOSS_ATTR_POINTS : ENEMY_ATTR_POINTS} Punkte {ATTR_LABEL[b.attr]}.
        </p>
        <button className="primary" onClick={onClose} autoFocus>
          Weiter
        </button>
      </div>
    </div>
  );
}

/** Multi-select of the gear and places someone has, plus the no-jumping switch. */
export function EquipmentPicker(props: {
  equipment: Equipment[] | undefined;
  noJumping: boolean | undefined;
  onChange: (equipment: Equipment[], noJumping: boolean) => void;
}) {
  const list = props.equipment ?? DEFAULT_EQUIPMENT;
  const quiet = !!props.noJumping;
  const toggle = (id: Equipment) =>
    props.onChange(list.includes(id) ? list.filter((x) => x !== id) : [...list, id], quiet);
  return (
    <>
      <div className="gear" role="group" aria-label="Ausrüstung und Möglichkeiten">
        {EQUIPMENT.map((e) => (
          <button type="button" key={e.id} aria-pressed={list.includes(e.id)} onClick={() => toggle(e.id)}>
            <Badge3D icon={e.icon} tone={list.includes(e.id) ? 'gold' : 'neutral'} size={30} />
            {e.label}
          </button>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={quiet} onChange={(e) => props.onChange(list, e.target.checked)} />
        <span>
          Keine Sprungübungen
          <small>Zum Beispiel wegen Nachbarn unter dir oder wegen der Knie. Lässt Hockstrecksprünge, Hampelmänner und Seilspringen weg.</small>
        </span>
      </label>
    </>
  );
}

/** Bottom sheet over the current screen. Tapping the dimmed area closes it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay sheet-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <strong>{title}</strong>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Schließen">
            <Icon name="close" size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

/** Glyph for how a quest is proven. */
export const PROOF_ICON: Record<ProofKind, IconName> = {
  camera: 'camera',
  presence: 'timer',
  health: 'heart',
  photo: 'book',
};

/** Short German name of a proof kind, for lists. */
export const PROOF_LABEL: Record<ProofKind, string> = {
  camera: 'Kamera zählt',
  presence: 'Kamera-Zeit',
  health: 'Samsung Health',
  photo: 'Foto der Seite',
};

/** Short German name of how a quest is proven; the stretch routine gets its own name. */
export const proofName = (p: Proof) => (p.kind === 'camera' && p.scanId === 'stretch' ? 'Dehn-Routine' : PROOF_LABEL[p.kind]);

/** What to record in Samsung Health so a health quest counts. */
export const METRIC_HINT: Record<HealthMetric, string> = {
  steps: 'Dein Handy oder deine Uhr zählt die Schritte von selbst.',
  runKm: 'Zeichne deinen Lauf in Samsung Health als Training „Laufen“ auf.',
  bikeMin: 'Zeichne die Fahrt in Samsung Health als Training „Radfahren“ auf.',
  swimMin: 'Zeichne das Schwimmen in Samsung Health als Training auf, z. B. mit deiner Uhr.',
  floors: 'Dein Handy oder deine Uhr zählt die Stockwerke von selbst.',
  strengthMin: 'Zeichne das Training in Samsung Health als Krafttraining auf.',
};

/** Seconds as m:ss. */
export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A number in German style, with at most one decimal. */
export const fmtNum = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
