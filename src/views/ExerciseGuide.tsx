import { useEffect, useId, useState, type ReactNode } from 'react';
import { EASY_XP_FACTOR } from '../game';
import { EXERCISE_ANIMS } from '../anim/exercises';
import { ExerciseAnim } from './ExerciseAnim';
import { Icon } from './Icons';
import { Sheet, useDeviceFlag } from './ui';
import './exercise-guide.css';

export interface ExerciseGuideProps {
  exerciseId: string;
  /** Start with the easier variant. */
  easy: boolean;
  onClose: () => void;
  /** Called when the person switches the variant in the sheet. */
  onEasyChange?: (easy: boolean) => void;
  /** Extra content under the cues (for example "Diese Version nehmen"). */
  footer?: ReactNode;
}

/** Sheet "Anleitung": animation (tap switches normal / easier), short cues and the XP hint. */
export function ExerciseGuide({ exerciseId, easy, onClose, onEasyChange, footer }: ExerciseGuideProps) {
  const [isEasy, setIsEasy] = useState(easy);
  useEffect(() => setIsEasy(easy), [easy]);
  const change = (next: boolean) => {
    setIsEasy(next);
    onEasyChange?.(next);
  };
  if (!EXERCISE_ANIMS[exerciseId]) {
    return (
      <Sheet title="Anleitung" onClose={onClose}>
        <p className="xguide-note">Für diese Übung gibt es noch keine Animation.</p>
      </Sheet>
    );
  }
  return (
    <Sheet title="Anleitung" onClose={onClose}>
      <GuideBody exerciseId={exerciseId} easy={isEasy} onEasyChange={change} footer={footer} />
    </Sheet>
  );
}

/**
 * The guide itself: animation, name with the XP hint and the numbered cues. With `onEasyChange` the
 * animation has its own Normal/Leichter switch; without it the version is chosen elsewhere.
 * `xpNote={false}` hides the XP chip and the XP sentence (arena: the version does not change XP).
 */
export function GuideBody({
  exerciseId,
  easy,
  onEasyChange,
  footer,
  xpNote = true,
}: {
  exerciseId: string;
  easy: boolean;
  onEasyChange?: (easy: boolean) => void;
  footer?: ReactNode;
  xpNote?: boolean;
}) {
  const def = EXERCISE_ANIMS[exerciseId];
  if (!def) return null;
  const v = easy ? def.easy : def.normal;
  return (
    <div className="xguide">
      <ExerciseAnim exerciseId={exerciseId} easy={easy} onEasyChange={onEasyChange} switchable={!!onEasyChange} />
      <div className="xguide-head">
        <h3>{v.name}</h3>
        {xpNote && <span className={'xguide-xp ' + (easy ? 'less' : 'full')}>{easy ? `${Math.round(EASY_XP_FACTOR * 100)} % XP` : 'Volle XP'}</span>}
      </div>
      <ol className="xguide-cues">
        {v.cues.map((c, i) => (
          <li key={c}>
            <span>{i + 1}</span>
            {c}
          </li>
        ))}
      </ol>
      {easy && (
        <p className="xguide-note">
          Gleiche Menge wie normal, nur mit weniger Kraft.{xpNote && ` Dafür gibt es ${Math.round(EASY_XP_FACTOR * 100)} % der XP.`}
        </p>
      )}
      {footer}
    </div>
  );
}

/**
 * "Anleitung" inside another sheet: a row that opens and closes the guide for the given version.
 * Whether it is open is remembered on this device. Renders nothing for exercises without an animation.
 */
export function GuideDisclosure({ exerciseId, easy, xpNote = true }: { exerciseId: string; easy: boolean; xpNote?: boolean }) {
  const [open, setOpen] = useDeviceFlag('questfit.ui.guideOpen', false);
  const id = useId();
  if (!EXERCISE_ANIMS[exerciseId]) return null;
  return (
    <div className={`xguide-fold ${open ? 'open' : ''}`}>
      <button type="button" className="xguide-toggle" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>
        <Icon name="play" size={18} />
        <span>Anleitung</span>
        <small>{open ? 'Ausblenden' : 'So geht die Übung'}</small>
        <Icon name="chevronDown" size={20} className="xguide-chevron" />
      </button>
      {open && (
        <div id={id} className="xguide-fold-body">
          <GuideBody exerciseId={exerciseId} easy={easy} xpNote={xpNote} />
        </div>
      )}
    </div>
  );
}
