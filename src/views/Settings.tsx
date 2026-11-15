import { useRef, useState } from 'react';
import {
  ATTR_LABEL,
  DIFFICULTY_LABEL,
  MAX_CUSTOM_QUESTS,
  MAX_DAILY_QUESTS,
  QUEST_ATTRS,
  QUEST_POOL,
  isGameState,
  makeCustomQuest,
  toDateKey,
  unavailableReason,
  type Difficulty,
  type QuestAttr,
} from '../game';
import type { Game } from '../store';
import { SCANNABLE } from '../pose';
import { AttrTile } from './Icons';
import { EquipmentPicker, Segmented } from './ui';

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

      <CameraSection game={game} />

      <HealthSection game={game} />

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
                  {q.base.toLocaleString('de-DE')} {q.unit}, {ATTR_LABEL[q.attr]}, {q.daily ? 'jeden Tag' : 'zufällig'}
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
              Jeden Tag als Extra-Quest
              <small>
                {dailyCount >= MAX_DAILY_QUESTS
                  ? `Du hast schon ${MAX_DAILY_QUESTS} tägliche Quests.`
                  : 'Sonst wird sie ab morgen ab und zu zufällig gezogen.'}
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
          <small className="small-text">Eigene Quests bringen 30 XP und werden nicht automatisch schwerer.</small>
        </form>
      ) : (
        <button className="secondary" disabled={full} onClick={() => setOpen(true)}>
          {full ? `Maximal ${MAX_CUSTOM_QUESTS} eigene Quests` : 'Eigene Quest anlegen'}
        </button>
      )}
    </div>
  );
}

function BuiltInQuests({ game }: { game: Game }) {
  const { state } = game;
  return (
    <fieldset className="field">
      <legend>Übungen im Zufallspool</legend>
      <p className="small-text">Schalte Übungen aus, die du nicht machen kannst oder willst. Gilt ab morgen.</p>
      <ul className="quest-list">
        {QUEST_POOL.filter((q) => !q.retired).map((q) => {
          const reason = q.fixed ? 'Jeden Tag fest dabei' : unavailableReason(q, state.profile);
          const enabled = !reason && !state.disabledQuests.includes(q.id);
          return (
            <li key={q.id} className={`attr-${q.attr} ${enabled ? '' : 'off'}`}>
              <AttrTile attr={q.attr} size="sm" />
              <label className="ql-text switch-label" htmlFor={`q-${q.id}`}>
                <strong>{q.title}</strong>
                <span>{reason ?? ATTR_LABEL[q.attr]}</span>
              </label>
              <input
                id={`q-${q.id}`}
                type="checkbox"
                role="switch"
                className="switch"
                disabled={!!reason}
                checked={enabled || !!q.fixed}
                onChange={(e) => game.setQuestEnabled(q.id, e.target.checked)}
              />
            </li>
          );
        })}
      </ul>
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
          Schritte und Läufe aus Samsung Health kann nur die Android-App lesen, nicht die Browser-Version. Lade die neueste APK unter
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
            Verbunden über Health Connect. Schritt- und Lauf-Quests haken sich selbst ab, und deine Schritte und Läufe treffen Gegner automatisch.
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
            So geht's: Öffne Samsung Health, tippe auf ⋮ → Einstellungen → Health Connect und erlaube Samsung Health, Schritte und Training zu teilen.
            Danach hier verbinden und Questfit den Lesezugriff erlauben.
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

function CameraSection({ game }: { game: Game }) {
  const profile = game.state.profile!;
  const names = Object.keys(SCANNABLE)
    .map((id) => QUEST_POOL.find((q) => q.id === id)?.title)
    .filter(Boolean)
    .join(', ');
  return (
    <div className="field">
      <span>Kamera-Zähler</span>
      <p className="small-text">
        Bei {names} zählt die Kamera mit. Tippe die Quest an, stell das Handy so auf, dass du ganz zu sehen bist, und leg los. Die Bilder
        bleiben auf dem Handy und werden nirgends gespeichert.
      </p>
      <label className="check">
        <input type="checkbox" checked={!!profile.cameraRequired} onChange={(e) => game.updateProfile({ cameraRequired: e.target.checked })} />
        <span>
          Kamera-Pflicht
          <small>Diese Übungen lassen sich dann nur noch vor der Kamera abhaken, auch gegen Gegner. Probier die Erkennung vorher einmal aus.</small>
        </span>
      </label>
    </div>
  );
}
