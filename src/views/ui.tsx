import { useEffect } from 'react';
import { rankFor } from '../game';

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
