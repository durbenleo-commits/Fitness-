import { useEffect, useState, type ReactNode } from 'react';
import { EASY_XP_FACTOR } from '../game';
import { EXERCISE_ANIMS } from '../anim/exercises';
import { ExerciseAnim } from './ExerciseAnim';
import { Sheet } from './ui';
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
  const def = EXERCISE_ANIMS[exerciseId];
  const [isEasy, setIsEasy] = useState(easy);
  useEffect(() => setIsEasy(easy), [easy]);
  const change = (next: boolean) => {
    setIsEasy(next);
    onEasyChange?.(next);
  };
  if (!def) {
    return (
      <Sheet title="Anleitung" onClose={onClose}>
        <p className="xguide-note">Für diese Übung gibt es noch keine Animation.</p>
      </Sheet>
    );
  }
  const v = isEasy ? def.easy : def.normal;
  return (
    <Sheet title="Anleitung" onClose={onClose}>
      <div className="xguide">
        <ExerciseAnim exerciseId={exerciseId} easy={isEasy} onEasyChange={change} />
        <div className="xguide-head">
          <h3>{v.name}</h3>
          <span className={'xguide-xp ' + (isEasy ? 'less' : 'full')}>{isEasy ? `${Math.round(EASY_XP_FACTOR * 100)} % XP` : 'Volle XP'}</span>
        </div>
        <ol className="xguide-cues">
          {v.cues.map((c, i) => (
            <li key={c}>
              <span>{i + 1}</span>
              {c}
            </li>
          ))}
        </ol>
        {isEasy && <p className="xguide-note">Gleiche Menge wie normal, nur mit weniger Kraft. Dafür gibt es {Math.round(EASY_XP_FACTOR * 100)} % der XP.</p>}
        {footer}
      </div>
    </Sheet>
  );
}
