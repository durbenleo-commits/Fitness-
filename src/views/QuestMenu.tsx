import type { ReactNode } from 'react';
import { EASY_XP_FACTOR, type QuestAttr } from '../game';
import type { Proof } from '../proof';
import { GuideDisclosure } from './ExerciseGuide';
import { AttrTile, Icon } from './Icons';
import { PROOF_ICON, Sheet, fmtNum, proofName } from './ui';

/** One line on how the proof works, under the proof name. */
function proofHint(p: Proof): string {
  switch (p.kind) {
    case 'camera':
      return p.scanId === 'stretch' ? '5 Dehnungen à 30 s vor der Kamera.' : 'Die Kamera zählt mit. Stell das Handy so hin, dass sie dich ganz sieht.';
    case 'presence':
      return 'Die Zeit läuft nur, solange die Kamera dich sieht.';
    case 'health':
      return 'Hakt sich von selbst ab, sobald Samsung Health genug meldet.';
    case 'photo':
      return 'Trag die Seite ein, bis zu der du gelesen hast, mit Foto.';
  }
}

export interface QuestMenuProps {
  /** Sheet title: the quest or move as it is now (follows the chosen version). */
  title: string;
  attr: QuestAttr;
  amount: number;
  unit: string;
  /** Word before the amount, e.g. "noch" in the arena. */
  amountPrefix?: string;
  /** XP line on the right, e.g. "+12 XP". */
  xpText?: string;
  proof: Proof;
  /** Normal / Leichter: shown as a two-option switch when `onChange` is set, else as a note when easy. */
  variant?: { easy: boolean; onChange?: (easy: boolean) => void };
  /**
   * Where the menu is used. Quests earn less XP with the easier version (EASY_XP_FACTOR); arena
   * damage and rewards do not depend on it, so the arena shows no XP percentages.
   */
  context?: 'quest' | 'arena';
  /** Built-in exercise id for the guide; nothing is shown when it has no animation. */
  exerciseId?: string;
  startLabel?: string;
  /** Starts the proof (camera, timer, reading). Missing for Samsung Health: `children` explain it instead. */
  onStart?: () => void;
  children?: ReactNode;
  onClose: () => void;
}

/**
 * The menu behind a quest or arena move: what it is, how it is proven, which version, the guide, and
 * a big "Starten". Choosing the version is the caller's job (it changes the quest right away).
 */
export function QuestMenu(props: QuestMenuProps) {
  const { title, attr, amount, unit, amountPrefix, xpText, proof, variant, context = 'quest', exerciseId, startLabel = 'Starten', onStart, children, onClose } = props;
  const pct = Math.round(EASY_XP_FACTOR * 100);
  const xpNote = context === 'quest';
  return (
    <Sheet title={title} onClose={onClose}>
      <div className={`qmenu attr-${attr}`}>
        <div className="qmenu-head">
          <AttrTile attr={attr} />
          <span className="qmenu-amount">
            {amountPrefix && <small>{amountPrefix} </small>}
            <span className="display">{fmtNum(amount)}</span> {unit}
          </span>
          {xpText && <span className="qmenu-xp">{xpText}</span>}
        </div>
        <div className={`qmenu-proof proof-${proof.kind}`}>
          <Icon name={PROOF_ICON[proof.kind]} size={20} />
          <span>
            <strong>{proofName(proof)}</strong>
            <small>{proofHint(proof)}</small>
          </span>
        </div>

        {variant?.onChange ? (
          <div className="qmenu-variant">
            <span className="qmenu-label" id="qmenu-variant-label">
              Ausführung
            </span>
            <div className="segmented" role="group" aria-labelledby="qmenu-variant-label">
              <button type="button" aria-pressed={!variant.easy} onClick={() => variant.onChange!(false)}>
                Normal
                {xpNote && <small>Volle XP</small>}
              </button>
              <button type="button" aria-pressed={variant.easy} onClick={() => variant.onChange!(true)}>
                Leichter
                {xpNote && <small>{pct} % XP</small>}
              </button>
            </div>
          </div>
        ) : variant?.easy ? (
          <p className="qmenu-note">{xpNote ? `Leichtere Ausführung, ${pct} % der XP.` : 'Leichtere Ausführung (in den Einstellungen gewählt).'}</p>
        ) : null}

        {exerciseId && <GuideDisclosure exerciseId={exerciseId} easy={!!variant?.easy} xpNote={xpNote} />}

        {children}

        {onStart && (
          <div className="qmenu-start">
            <button className="primary" onClick={onStart}>
              <Icon name={PROOF_ICON[proof.kind]} size={22} />
              {startLabel}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
