import { useEffect } from 'react';
import type { Battle } from '../battle';
import { Monster } from './Monster';
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
        <span className="display lvlup-num">{level}</span>
        <p>{rankChanged ? `Neuer Rang: ${rankFor(level)}. ` : ''}Deine Quests werden ab morgen etwas schwerer.</p>
        <button className="primary" onClick={onClose} autoFocus>
          Weiter
        </button>
      </div>
    </div>
  );
}

export function Toast({ icon, title, onDone }: { icon: string; title: string; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 3500);
    return () => window.clearTimeout(t);
  }, [onDone, title]);
  return (
    <div className="toast" role="status" onClick={onDone}>
      <span className="toast-icon" aria-hidden>
        {icon}
      </span>
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
        <Monster enemyId={b.enemyId} attr={b.attr} className="victory-enemy" />
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
            <span aria-hidden>{e.icon}</span>
            {e.label}
          </button>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={quiet} onChange={(e) => props.onChange(list, e.target.checked)} />
        <span>
          Keine Sprungübungen
          <small>Zum Beispiel wegen Nachbarn unter dir oder wegen der Knie. Lässt Burpees, Hampelmänner und Seilspringen weg.</small>
        </span>
      </label>
    </>
  );
}
