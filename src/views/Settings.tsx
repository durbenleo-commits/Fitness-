import { useRef, useState } from 'react';
import {
  ATTR_LABEL,
  DIFFICULTY_LABEL,
  EXTRA_QUESTS_PER_DAY,
  MAX_CUSTOM_QUESTS,
  MAX_DAILY_QUESTS,
  QUEST_ATTRS,
  QUEST_POOL,
  READ_QUEST,
  fixedQuests,
  isCoreQuest,
  isGameState,
  goalSteps,
  lockInfo,
  stateLevel,
  stateMastery,
  type LockInfo,
  readingOn,
  makeCustomQuest,
  toDateKey,
  unavailableReason,
  type Difficulty,
  type QuestAttr,
} from '../game';
import type { Game } from '../store';
import { MAX_TIER, masteryOf, pointsForTier, type MasteryPoints, type Requirement } from '../mastery';
import { SCANNABLE, STRETCH } from '../pose';
import { proofFor } from '../proof';
import { hasExerciseAnim } from '../anim/exercises';
import { AttrTile, Icon } from './Icons';
import { ExerciseGuide } from './ExerciseGuide';
import { EquipmentPicker, Segmented, proofName } from './ui';

export function SettingsView({ game }: { game: Game }) {
  const { state } = game;
  const profile = state.profile!;
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questfit-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Backup gespeichert. Bewahre die Datei gut auf.');
  };

  const importBackup = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!isGameState(parsed)) throw new Error('format');
      if (!confirm('Dein aktueller Fortschritt wird durch das Backup ersetzt. Fortfahren?')) return;
      game.replaceState(parsed);
      setMessage('Backup geladen.');
    } catch {
      setMessage('Diese Datei ist kein Questfit-Backup. Wähle eine Datei, die du über „Backup speichern“ erstellt hast.');
    }
  };

  return (
    <section className="settings">
      <h1>Einstellungen</h1>

      <label className="field">
        <span>Name</span>
        <input value={profile.name} maxLength={20} onChange={(e) => game.updateProfile({ name: e.target.value })} />
      </label>

      <fieldset className="field">
        <legend>Schwierigkeit</legend>
        <Segmented
          options={([1, 2, 3] as Difficulty[]).map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }))}
          value={profile.difficulty}
          onChange={(d) => game.updateProfile({ difficulty: d })}
        />
        <small>Gilt ab den Quests von morgen.</small>
      </fieldset>

      <GearSection game={game} />

      <VariantsSection game={game} />

      <ReadingSection game={game} />

      <ProofSection />

      <HealthSection game={game} />

      <FixedQuests game={game} />
      <CustomQuests game={game} />
      <BuiltInQuests game={game} />

      <div className="field">
        <span>Backup</span>
        <p className="small-text">
          Dein Fortschritt ist nur auf diesem Handy gespeichert. Wenn du die Browserdaten löschst, ist er weg. Speichere ab und zu ein Backup.
        </p>
        <div className="row">
          <button className="secondary" onClick={exportBackup}>
            Backup speichern
          </button>
          <button className="secondary" onClick={() => fileRef.current?.click()}>
            Backup laden
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importBackup(f);
            e.target.value = '';
          }}
        />
        {message && (
          <p className="small-text" role="status">
            {message}
          </p>
        )}
      </div>

      <div className="field">
        <span>Neu anfangen</span>
        <button
          className="danger"
          onClick={() => {
            if (confirm('Alle Level, XP, Erfolge und Quests werden gelöscht. Das lässt sich nicht rückgängig machen. Wirklich neu anfangen?'))
              game.resetAll();
          }}
        >
          Fortschritt löschen
        </button>
      </div>
    </section>
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
  const points = stateMastery(game.state);
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
              {isCoreQuest(q.id) && q.id !== 'steps' && <MasteryLine points={points} id={q.id} />}
            </span>
            <span className="tag">Pflicht</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const titleOf = (id: string) => QUEST_POOL.find((t) => t.id === id)?.title ?? id;
/** Points with at most one decimal, German style (7,5). */
const fmtPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));
/** "Liegestütze Stufe 2 (7/10)" */
const requirementText = (points: MasteryPoints, r: Requirement) =>
  `${titleOf(r.id)} Stufe ${r.tier} (${fmtPoints(Math.min(points[r.id] ?? 0, pointsForTier(r.tier)))}/${pointsForTier(r.tier)})`;

/** Only what is missing: "ab Level 20 · Braucht: Hollow Hold Stufe 3 (12/25)". */
const lockText = (points: MasteryPoints, lock: LockInfo) =>
  [lock.level ? `ab Level ${lock.level}` : '', lock.unmet.length ? `Braucht: ${lock.unmet.map((r) => requirementText(points, r)).join(', ')}` : '']
    .filter(Boolean)
    .join(' · ');
const isLocked = (lock: LockInfo) => lock.level !== null || lock.unmet.length > 0;

/** "Stufe 1 · 5/10" with a small bar to the next Stufe. */
function MasteryLine({ points, id }: { points: MasteryPoints; id: string }) {
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
      <span className="mastery-count">{m.next === null ? `Stufe ${MAX_TIER} erreicht` : `${fmtPoints(m.points)}/${m.next}`}</span>
    </span>
  );
}

/** The training goal: what it needs and which exercises the extras bring for it. */
function GoalBox({ game, points, level }: { game: Game; points: MasteryPoints; level: number }) {
  const goal = game.state.profile?.trainingGoal;
  if (!goal) {
    return (
      <p className="small-text">
        Schwere Übungen kommen erst ab einem Level und wenn du leichtere gemeistert hast: Jede erledigte Quest bringt einen Punkt
        (leichtere Variante einen halben). Ab 3 Punkten gibt es Stufe 1, ab 10 Stufe 2, ab 25 Stufe 3. Wähle bei einer gesperrten Übung
        „Als Ziel“, dann bringen die Extras gezielt, was dafür fehlt.
      </p>
    );
  }
  const steps = goalSteps(game.state).map((t) => t.title);
  const lock = lockInfo(points, level, goal);
  return (
    <div className="goal-box">
      <div className="goal-head">
        <Icon name="star" size={18} />
        <span>
          Trainingsziel: <strong>{titleOf(goal)}</strong>
        </span>
        <button type="button" className="link-button" onClick={() => game.setTrainingGoal(null)}>
          Entfernen
        </button>
      </div>
      {!isLocked(lock) ? (
        <p className="small-text">Alles erfüllt. Die Übung ist freigeschaltet.</p>
      ) : lock.unmet.length === 0 ? (
        <p className="small-text">Die Vorstufen hast du gemeistert. Es fehlt nur noch Level {lock.level} (du bist Level {level}).</p>
      ) : (
        <>
          <p className="small-text">{lockText(points, lock)}.</p>
          <p className="small-text">
            {steps.length > 0
              ? `Ab morgen in den Extras: ${steps.join(', ')}.`
              : 'Was fehlt, sind Pflicht-Quests oder Übungen, die selbst noch gesperrt sind. Bleib bei der Pflicht dran.'}
          </p>
        </>
      )}
    </div>
  );
}

function BuiltInQuests({ game }: { game: Game }) {
  const { state } = game;
  const [guide, setGuide] = useState<string | null>(null);
  const points = stateMastery(state);
  const level = stateLevel(state);
  const goal = state.profile?.trainingGoal;
  const guideLock = guide ? lockInfo(points, level, guide) : null;
  return (
    <fieldset className="field">
      <legend>Übungen für die Extras</legend>
      <p className="small-text">
        Aus diesen Übungen kommen jeden Tag {EXTRA_QUESTS_PER_DAY} wechselnde Extra-Quests. Sie sind freiwillig und bringen zusätzliche XP.
        Schalte Übungen aus, die du nicht machen kannst oder willst. Gilt ab morgen. Tippe auf eine Übung, um zu sehen, wie sie geht.
      </p>
      <GoalBox game={game} points={points} level={level} />
      <ul className="quest-list">
        {QUEST_POOL.filter((q) => !q.retired && !q.fixed && !isCoreQuest(q.id) && q.id !== READ_QUEST).map((q) => {
          const reason = unavailableReason(q, state.profile);
          const proof = proofName(proofFor({ templateId: q.id, unit: q.unit, amount: q.base }));
          const lock = lockInfo(points, level, q.id);
          const locked = isLocked(lock);
          const enabled = !reason && !locked && !state.disabledQuests.includes(q.id);
          const sub = reason ?? ATTR_LABEL[q.attr];
          const isGoal = goal === q.id;
          return (
            <li key={q.id} className={`attr-${q.attr} ${enabled || locked ? '' : 'off'} ${locked ? 'locked' : ''} ${isGoal ? 'goal' : ''}`}>
              <AttrTile attr={q.attr} size="sm" />
              {hasExerciseAnim(q.id) ? (
                <button type="button" className="ql-text ql-guide" onClick={() => setGuide(q.id)} aria-label={`${q.title}: Anleitung ansehen`}>
                  <strong>
                    {q.title} <Icon name="play" size={15} />
                  </strong>
                  <span>
                    {sub} · {proof}
                  </span>
                  {locked ? (
                    <span className="needs">
                      <Icon name="lock" size={13} /> {lockText(points, lock)}
                    </span>
                  ) : (
                    <MasteryLine points={points} id={q.id} />
                  )}
                </button>
              ) : (
                <label className="ql-text switch-label" htmlFor={`q-${q.id}`}>
                  <strong>{q.title}</strong>
                  <span>
                    {sub} · {proof}
                  </span>
                  {locked ? (
                    <span className="needs">
                      <Icon name="lock" size={13} /> {lockText(points, lock)}
                    </span>
                  ) : (
                    <MasteryLine points={points} id={q.id} />
                  )}
                </label>
              )}
              {locked ? (
                <button
                  type="button"
                  className={`goal-button ${isGoal ? 'on' : ''}`}
                  aria-pressed={isGoal}
                  aria-label={isGoal ? `${q.title} ist dein Ziel, tippen zum Entfernen` : `${q.title} als Trainingsziel setzen`}
                  onClick={() => game.setTrainingGoal(isGoal ? null : q.id)}
                >
                  {isGoal ? 'Ziel' : 'Als Ziel'}
                </button>
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
            <div className="guide-mastery">
              {guideLock && isLocked(guideLock) ? (
                <>
                  <p className="small-text">
                    <Icon name="lock" size={13} /> {lockText(points, guideLock)}
                  </p>
                  {goal !== guide && (
                    <button type="button" className="secondary" onClick={() => game.setTrainingGoal(guide)}>
                      Als Ziel setzen
                    </button>
                  )}
                  {goal === guide && <p className="small-text">Das ist dein Trainingsziel.</p>}
                </>
              ) : (
                <MasteryLine points={points} id={guide} />
              )}
            </div>
          }
        />
      )}
    </fieldset>
  );
}

function HealthSection({ game }: { game: Game }) {
  const { state, health } = game;
  const last = state.health.lastSync ? new Date(state.health.lastSync) : null;

  if (!health.supported) {
    return (
      <div className="field">
        <span>Samsung Health</span>
        <p className="small-text">
          Schritte, Läufe, Radfahren, Schwimmen, Stockwerke und Krafttraining aus Samsung Health kann nur die Android-App lesen, nicht die
          Browser-Version. Lade die neueste APK unter
          „Releases“ im GitHub-Repository herunter und installiere sie. Dein Fortschritt zieht über „Backup speichern“ und „Backup laden“ mit.
        </p>
      </div>
    );
  }

  return (
    <div className="field">
      <span>Samsung Health</span>
      {state.health.connected ? (
        <>
          <p className="small-text">
            Verbunden über Health Connect. Schritte, Läufe, Radfahren, Schwimmen, Stockwerke und Krafttraining haken ihre Quests selbst ab
            und treffen Gegner automatisch.
            {last && ` Zuletzt abgeglichen: ${last.toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`}
          </p>
          <div className="row">
            <button className="secondary" onClick={health.sync} disabled={health.syncing}>
              {health.syncing ? 'Gleiche ab …' : 'Jetzt abgleichen'}
            </button>
            <button className="secondary" onClick={health.disconnect}>
              Trennen
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="small-text">
            Schritte, Läufe, Radfahren, Schwimmen, Stockwerke und Krafttraining zählen nur über Samsung Health. So geht's: Öffne Samsung
            Health, tippe auf ⋮ → Einstellungen → Health Connect und erlaube Samsung Health, Schritte und Training zu teilen. Danach hier
            verbinden und Questfit den Lesezugriff erlauben.
          </p>
          <button className="primary" onClick={health.connect}>
            Mit Health Connect verbinden
          </button>
        </>
      )}
      {health.error && (
        <p className="error" role="alert">
          {health.error}
        </p>
      )}
    </div>
  );
}

function GearSection({ game }: { game: Game }) {
  const profile = game.state.profile!;
  const [applied, setApplied] = useState(false);
  const nothingDoneToday = !game.state.days[toDateKey(new Date())]?.quests.some((q) => q.done);
  return (
    <fieldset className="field">
      <legend>Ausrüstung und Möglichkeiten</legend>
      <p className="small-text">
        Quests, Gegner und Bosse nehmen nur Übungen, die du damit machen kannst. Ohne Ausrüstung bekommst du Übungen mit dem eigenen
        Körpergewicht.
      </p>
      <EquipmentPicker
        equipment={profile.equipment}
        noJumping={profile.noJumping}
        onChange={(equipment, noJumping) => {
          game.updateProfile({ equipment, noJumping });
          setApplied(false);
        }}
      />
      <small>Gilt ab morgen.</small>
      {nothingDoneToday && (
        <button
          className="secondary"
          onClick={() => {
            game.applyToToday();
            setApplied(true);
          }}
          disabled={applied}
        >
          {applied ? 'Heute ist angepasst' : 'Schon heute anwenden'}
        </button>
      )}
    </fieldset>
  );
}

function VariantsSection({ game }: { game: Game }) {
  const profile = game.state.profile!;
  const nothingDoneToday = !game.state.days[toDateKey(new Date())]?.quests.some((q) => q.done);
  return (
    <div className="field">
      <span>Übungen</span>
      <label className="check">
        <input
          type="checkbox"
          checked={!!profile.easyVariants}
          onChange={(e) => {
            game.updateProfile({ easyVariants: e.target.checked });
            game.applyToToday();
          }}
        />
        <span>
          Leichtere Varianten
          <small>
            Zum Beispiel Knie-Liegestütze statt Liegestütze oder Australische Klimmzüge statt Klimmzüge. Für alle, die einfacher einsteigen
            wollen. Menge und XP bleiben gleich, die Kamera prüft die leichtere Ausführung.{' '}
            {nothingDoneToday ? 'Gilt sofort.' : 'Gilt ab morgen, weil heute schon etwas erledigt ist.'}
          </small>
        </span>
      </label>
    </div>
  );
}

function ReadingSection({ game }: { game: Game }) {
  const on = readingOn(game.state.profile);
  return (
    <div className="field">
      <span>Lesen</span>
      <label className="check">
        <input type="checkbox" checked={on} onChange={(e) => game.setReading(e.target.checked)} />
        <span>
          Lesen als tägliche Quest
          <small>Jeden Tag ein paar Seiten. Nachweis ist ein Foto der Seite, bis zu der du gekommen bist. Bringt Intelligenz.</small>
        </span>
      </label>
    </div>
  );
}

/** How each kind of quest is proven. Proof is always required. */
function ProofSection() {
  const names = (ids: string[]) =>
    ids
      .map((id) => QUEST_POOL.find((q) => q.id === id)?.title)
      .filter(Boolean)
      .join(', ');
  const camera = names(Object.keys(SCANNABLE).filter((id) => id !== STRETCH));
  return (
    <div className="field">
      <span>Nachweise</span>
      <p className="small-text">Jede Quest und jeder Treffer in der Arena braucht einen Nachweis. Abhaken von Hand gibt es nicht.</p>
      <ul className="proof-list">
        <li>
          <Icon name="camera" size={20} />
          <span>
            <strong>Kamera zählt</strong>
            {camera}.
          </span>
        </li>
        <li>
          <Icon name="camera" size={20} />
          <span>
            <strong>Dehn-Routine</strong>
            Dehnen, Dehnen mit Band, Mobilisation und Hüftöffner: fünf Dehnungen, jede 30 Sekunden vor der Kamera halten.
          </span>
        </li>
        <li>
          <Icon name="timer" size={20} />
          <span>
            <strong>Kamera-Zeit</strong>
            Seilspringen und eigene Quests: Die Zeit läuft nur, solange du im Bild bist.
          </span>
        </li>
        <li>
          <Icon name="heart" size={20} />
          <span>
            <strong>Samsung Health</strong>
            Schritte, Laufen, Radfahren, Schwimmen, Treppen und Gerätetraining.
          </span>
        </li>
        <li>
          <Icon name="book" size={20} />
          <span>
            <strong>Foto der Seite</strong>
            Lesen: die Seite fotografieren, bis zu der du gekommen bist.
          </span>
        </li>
      </ul>
      <p className="small-text">Die Kamerabilder bleiben auf dem Handy und werden nirgends gespeichert. Nur das letzte Seitenfoto pro Buch wird klein gespeichert.</p>
    </div>
  );
}
