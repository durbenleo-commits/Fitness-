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
  type Difficulty,
  type QuestAttr,
} from '../game';
import type { Game } from '../store';
import { Segmented } from './ui';

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

const ICONS = ['🏋️', '🚴', '🏊', '⚽', '🥊', '🧗', '🤾', '🏀', '🎾', '🧎', '🥾', '❤️'];
const UNITS = ['Wdh.', 'Min.', 'Sek.', 'km', 'Schritte', 'Sätze'];

function CustomQuests({ game }: { game: Game }) {
  const { state } = game;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
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
    game.addCustomQuest(makeCustomQuest({ title, icon, attr, amount: n, unit, daily: daily && dailyCount < MAX_DAILY_QUESTS }));
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
        <p className="small-text">Du hast noch keine eigenen Quests. Leg Übungen an, die dir fehlen, z. B. Klimmzüge oder Radfahren.</p>
      ) : (
        <ul className="quest-list">
          {state.customQuests.map((q) => (
            <li key={q.id} className={`attr-${q.attr}`}>
              <span aria-hidden>{q.icon}</span>
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
            <legend>Symbol</legend>
            <div className="icon-picker">
              {ICONS.map((i) => (
                <button type="button" key={i} aria-pressed={icon === i} onClick={() => setIcon(i)}>
                  {i}
                </button>
              ))}
            </div>
          </fieldset>
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
        {QUEST_POOL.map((q) => {
          const enabled = !state.disabledQuests.includes(q.id);
          return (
            <li key={q.id} className={`attr-${q.attr} ${enabled ? '' : 'off'}`}>
              <span aria-hidden>{q.icon}</span>
              <label className="ql-text switch-label" htmlFor={`q-${q.id}`}>
                <strong>{q.title}</strong>
                <span>{ATTR_LABEL[q.attr]}</span>
              </label>
              <input
                id={`q-${q.id}`}
                type="checkbox"
                role="switch"
                className="switch"
                checked={enabled}
                onChange={(e) => game.setQuestEnabled(q.id, e.target.checked)}
              />
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
