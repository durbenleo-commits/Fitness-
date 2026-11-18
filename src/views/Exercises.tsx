import { useState } from 'react';
import {
  ATTR_LABEL,
  EXTRA_QUESTS_PER_DAY,
  MAX_CUSTOM_QUESTS,
  MAX_DAILY_QUESTS,
  QUEST_ATTRS,
  QUEST_POOL,
  READ_QUEST,
  fixedQuests,
  isCoreQuest,
  lockInfo,
  makeCustomQuest,
  stateLevel,
  stateMastery,
  unavailableReason,
  type QuestAttr,
} from '../game';
import type { Game } from '../store';
import { proofFor } from '../proof';
import { hasExerciseAnim } from '../anim/exercises';
import { AttrTile, Badge3D, Icon } from './Icons';
import { ExerciseGuide } from './ExerciseGuide';
import { Segmented, proofName } from './ui';
import { isLocked, lockText } from './masteryUi';

/** Quests & Übungen: the daily quests, custom quests and which exercises the extras may bring. */
export function ExercisesView({ game, onOpenMastery }: { game: Game; onOpenMastery: () => void }) {
  return (
    <div className="exercises">
      <FixedQuests game={game} />
      <BuiltInQuests game={game} onOpenMastery={onOpenMastery} />
      <CustomQuests game={game} />
    </div>
  );
}

const UNITS = ['Wdh.', 'Min.', 'Sek.', 'km', 'Schritte', 'Sätze'];

function CustomQuests({ game }: { game: Game }) {
  const { state } = game;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [attr, setAttr] = useState<QuestAttr>('staerke');
  const [amount, setAmount] = useState('10');
  const [unit, setUnit] = useState(UNITS[0]);
  const [daily, setDaily] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dailyCount = state.customQuests.filter((q) => q.daily).length;
  const full = state.customQuests.length >= MAX_CUSTOM_QUESTS;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount.replace(',', '.'));
    if (!title.trim()) return setError('Gib der Quest einen Namen, z. B. „Klimmzüge“.');
    if (!Number.isFinite(n) || n <= 0) return setError('Gib eine Menge größer als 0 ein.');
    game.addCustomQuest(makeCustomQuest({ title, icon: '', attr, amount: n, unit, daily: daily && dailyCount < MAX_DAILY_QUESTS }));
    setTitle('');
    setAmount('10');
    setDaily(false);
    setError(null);
    setOpen(false);
  };

  return (
    <div className="field">
      <span>Eigene Quests</span>
      {state.customQuests.length === 0 ? (
        <p className="small-text">Du hast noch keine eigenen Quests. Leg Übungen an, die dir fehlen, z. B. Fußball, Tanzen oder Klettern.</p>
      ) : (
        <ul className="quest-list">
          {state.customQuests.map((q) => (
            <li key={q.id} className={`attr-${q.attr}`}>
              <AttrTile attr={q.attr} size="sm" />
              <span className="ql-text">
                <strong>{q.title}</strong>
                <span>
                  {q.base.toLocaleString('de-DE')} {q.unit}, {ATTR_LABEL[q.attr]}, {q.daily ? 'jeden Tag' : 'zufällig'},{' '}
                  {proofName(proofFor({ templateId: q.id, unit: q.unit, amount: q.base }, state.customQuests))}
                </span>
              </span>
              <button
                className="link-button"
                onClick={() => confirm(`„${q.title}“ löschen? Bereits erledigte Quests bleiben in deiner Statistik.`) && game.removeCustomQuest(q.id)}
              >
                Löschen
              </button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form className="custom-form" onSubmit={submit}>
          <label className="field">
            <span>Name</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={24} placeholder="Klimmzüge" />
          </label>
          <fieldset className="field">
            <legend>Bringt Punkte für</legend>
            <Segmented options={QUEST_ATTRS.map((a) => ({ value: a, label: ATTR_LABEL[a] }))} value={attr} onChange={setAttr} />
          </fieldset>
          <div className="row">
            <label className="field grow">
              <span>Menge</span>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="field grow">
              <span>Einheit</span>
              <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={daily}
              disabled={dailyCount >= MAX_DAILY_QUESTS}
              onChange={(e) => setDaily(e.target.checked)}
            />
            <span>
              Jeden Tag fest dabei
              <small>
                {dailyCount >= MAX_DAILY_QUESTS
                  ? `Du hast schon ${MAX_DAILY_QUESTS} tägliche Quests.`
                  : 'Zählt dann als Pflicht-Quest. Sonst kommt sie ab morgen ab und zu als Extra.'}
              </small>
            </span>
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="row">
            <button type="button" className="secondary" onClick={() => setOpen(false)}>
              Abbrechen
            </button>
            <button type="submit" className="primary grow">
              Quest anlegen
            </button>
          </div>
          <small className="small-text">
            Eigene Quests bringen 30 XP und werden nicht automatisch schwerer. Nachweis: Quests in Schritten kommen aus Samsung Health, alle
            anderen laufen als Kamera-Zeit (Minuten wie angegeben, eine Wiederholung zählt 3 Sekunden, ein Satz 1 Minute, ein Kilometer 6 Minuten).
          </small>
        </form>
      ) : (
        <button className="secondary" disabled={full} onClick={() => setOpen(true)}>
          {full ? `Maximal ${MAX_CUSTOM_QUESTS} eigene Quests` : 'Eigene Quest anlegen'}
        </button>
      )}
    </div>
  );
}

/** The quests of every day ("Pflicht"): the core quests, plus reading while it is on. */
function FixedQuests({ game }: { game: Game }) {
  const quests = fixedQuests(game.state.profile);
  return (
    <div className="field">
      <span>Jeden Tag fest dabei</span>
      <p className="small-text">
        Diese Pflicht-Quests kommen jeden Tag. Sind alle geschafft, gibt es den Tagesbonus und die Serie läuft weiter.
      </p>
      <ul className="quest-list fixed-list">
        {quests.map((q) => (
          <li key={q.id} className={`attr-${q.attr}`}>
            <AttrTile attr={q.attr} size="sm" />
            <span className="ql-text">
              <strong>{q.title}</strong>
              <span>
                {ATTR_LABEL[q.attr]} · {proofName(proofFor({ templateId: q.id, unit: q.unit, amount: q.base }))}
              </span>
            </span>
            <span className="tag">Pflicht</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BuiltInQuests({ game, onOpenMastery }: { game: Game; onOpenMastery: () => void }) {
  const { state } = game;
  const [guide, setGuide] = useState<string | null>(null);
  const points = stateMastery(state);
  const level = stateLevel(state);
  const guideLock = guide ? lockInfo(points, level, guide) : null;
  const list = QUEST_POOL.filter((q) => !q.retired && !q.fixed && !isCoreQuest(q.id) && q.id !== READ_QUEST);
  const lockedCount = list.filter((q) => !unavailableReason(q, state.profile) && isLocked(lockInfo(points, level, q.id))).length;
  return (
    <fieldset className="field">
      <legend>Übungen für die Extras</legend>
      <p className="small-text">
        Aus diesen Übungen kommen jeden Tag {EXTRA_QUESTS_PER_DAY} wechselnde Extra-Quests. Sie sind freiwillig und bringen zusätzliche XP.
        Schalte Übungen aus, die du nicht machen kannst oder willst. Gilt ab morgen. Tippe auf eine Übung, um zu sehen, wie sie geht.
      </p>
      {lockedCount > 0 && (
        <button type="button" className="inline-link" onClick={onOpenMastery}>
          <Badge3D icon="path" tone="gold" size={30} />
          <span>
            <strong>{lockedCount === 1 ? '1 Übung ist noch gesperrt' : `${lockedCount} Übungen sind noch gesperrt`}</strong>
            <small>Stufen, Vorstufen und Trainingsziel in der Meisterschaft</small>
          </span>
          <Icon name="chevronRight" size={18} />
        </button>
      )}
      <ul className="quest-list">
        {list.map((q) => {
          const reason = unavailableReason(q, state.profile);
          const proof = proofName(proofFor({ templateId: q.id, unit: q.unit, amount: q.base }));
          const lock = lockInfo(points, level, q.id);
          const locked = isLocked(lock);
          const enabled = !reason && !locked && !state.disabledQuests.includes(q.id);
          const sub = reason ?? ATTR_LABEL[q.attr];
          const text = (
            <>
              <strong>
                {q.title} {hasExerciseAnim(q.id) && <Icon name="play" size={15} />}
              </strong>
              <span>
                {sub} · {proof}
              </span>
              {locked && !reason && (
                <span className="needs">
                  <Icon name="lock" size={13} /> Gesperrt{lock.level ? ` · ab Level ${lock.level}` : ''}
                  {lock.unmet.length > 0 ? ` · ${lock.unmet.length === 1 ? 'eine Vorstufe fehlt' : `${lock.unmet.length} Vorstufen fehlen`}` : ''}
                </span>
              )}
            </>
          );
          return (
            <li key={q.id} className={`attr-${q.attr} ${enabled || locked ? '' : 'off'} ${locked ? 'locked' : ''}`}>
              <AttrTile attr={q.attr} size="sm" />
              {hasExerciseAnim(q.id) ? (
                <button type="button" className="ql-text ql-guide" onClick={() => setGuide(q.id)} aria-label={`${q.title}: Anleitung ansehen`}>
                  {text}
                </button>
              ) : (
                <label className="ql-text switch-label" htmlFor={`q-${q.id}`}>
                  {text}
                </label>
              )}
              {locked ? (
                <span className="lock-mark" aria-label="Gesperrt">
                  <Icon name="lock" size={18} />
                </span>
              ) : (
                <input
                  id={`q-${q.id}`}
                  aria-label={`${q.title} in den Extras`}
                  type="checkbox"
                  role="switch"
                  className="switch"
                  disabled={!!reason}
                  checked={enabled}
                  onChange={(e) => game.setQuestEnabled(q.id, e.target.checked)}
                />
              )}
            </li>
          );
        })}
      </ul>
      {guide && (
        <ExerciseGuide
          exerciseId={guide}
          easy={false}
          onClose={() => setGuide(null)}
          footer={
            guideLock && isLocked(guideLock) ? (
              <div className="guide-mastery">
                <p className="small-text">
                  <Icon name="lock" size={13} /> {lockText(points, guideLock)}
                </p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setGuide(null);
                    onOpenMastery();
                  }}
                >
                  In der Meisterschaft ansehen
                </button>
              </div>
            ) : undefined
          }
        />
      )}
    </fieldset>
  );
}
