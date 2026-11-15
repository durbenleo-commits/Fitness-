import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ATTR_LABEL,
  DAY_CLEAR_BONUS,
  DIFFICULTY_LABEL,
  REROLLS_PER_DAY,
  addDays,
  attributes,
  bestStreak,
  currentStreak,
  isCleared,
  isGameState,
  levelFromXp,
  questsDone,
  rankFor,
  seasonDay,
  totalXp,
  type Attr,
  type DayLog,
  type Difficulty,
  type GameState,
  type Profile,
  type QuestInstance,
} from './game';
import { useGame, useToday } from './store';

type Tab = 'heute' | 'werte' | 'einstellungen';

export default function App() {
  const today = useToday();
  const game = useGame(today);
  const { state } = game;
  const [tab, setTab] = useState<Tab>('heute');

  const xp = totalXp(state);
  const lvl = levelFromXp(xp);

  // Show the level-up screen only when the level rises during this session.
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const lastLevel = useRef(lvl.level);
  useEffect(() => {
    if (lvl.level > lastLevel.current) setLevelUp(lvl.level);
    lastLevel.current = lvl.level;
  }, [lvl.level]);

  if (!state.profile) return <Onboarding onStart={game.startGame} />;

  const profile = state.profile;
  const streak = currentStreak(state, today);

  return (
    <div className="app">
      <Hud profile={profile} level={lvl.level} intoLevel={lvl.intoLevel} needed={lvl.needed} streak={streak} today={today} />

      <main className="content">
        {tab === 'heute' && (
          <TodayView day={state.days[today]} onToggle={game.toggleQuest} onReroll={game.reroll} />
        )}
        {tab === 'werte' && <StatsView state={state} today={today} xp={xp} />}
        {tab === 'einstellungen' && (
          <SettingsView
            state={state}
            onUpdate={game.updateProfile}
            onImport={game.replaceState}
            onReset={game.resetAll}
          />
        )}
      </main>

      <nav className="tabs" aria-label="Bereiche">
        <TabButton current={tab} id="heute" label="Heute" icon="⚔️" onSelect={setTab} />
        <TabButton current={tab} id="werte" label="Werte" icon="📈" onSelect={setTab} />
        <TabButton current={tab} id="einstellungen" label="Einstellungen" icon="⚙️" onSelect={setTab} />
      </nav>

      {levelUp !== null && <LevelUp level={levelUp} onClose={() => setLevelUp(null)} />}
    </div>
  );
}

// ---------- onboarding ----------

function Onboarding({ onStart }: { onStart: (p: Profile) => void }) {
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [seasonDays, setSeasonDays] = useState(66);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    onStart({ name: name.trim() || 'Held', difficulty, seasonDays, startDate });
  };

  return (
    <form className="onboarding" onSubmit={submit}>
      <div className="onboarding-title">
        <span className="display big">Level 1</span>
        <p className="lead">Jeden Tag vier Sport-Quests. Erledige sie, sammle XP und steig im Level auf.</p>
      </div>

      <label className="field">
        <span>Wie heißt dein Charakter?</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Held" maxLength={20} autoComplete="off" />
      </label>

      <fieldset className="field">
        <legend>Wie fit bist du gerade?</legend>
        <div className="segmented">
          {([1, 2, 3] as Difficulty[]).map((d) => (
            <button type="button" key={d} aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>
              {DIFFICULTY_LABEL[d]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Wie lang soll deine Saison dauern?</legend>
        <div className="segmented">
          {[30, 66, 90].map((n) => (
            <button type="button" key={n} aria-pressed={seasonDays === n} onClick={() => setSeasonDays(n)}>
              {n} Tage
            </button>
          ))}
        </div>
      </fieldset>

      <button className="primary" type="submit">
        Saison starten
      </button>
    </form>
  );
}

// ---------- header ----------

function Hud(props: { profile: Profile; level: number; intoLevel: number; needed: number; streak: number; today: string }) {
  const { profile, level, intoLevel, needed, streak, today } = props;
  const day = seasonDay(profile, today);
  const seasonOver = day > profile.seasonDays;
  const pct = Math.round((intoLevel / needed) * 100);

  return (
    <header className="hud">
      <div className="hud-top">
        <div className="badge" aria-label={`Level ${level}`}>
          <span className="badge-label">Lvl</span>
          <span className="display badge-num">{level}</span>
        </div>
        <div className="hud-who">
          <strong className="hud-name">{profile.name}</strong>
          <span className="hud-rank">{rankFor(level)}</span>
        </div>
        <div className={`streak ${streak > 0 ? 'on' : ''}`} aria-label={`${streak} Tage Serie`}>
          <span aria-hidden>🔥</span>
          <span className="display">{streak}</span>
        </div>
      </div>

      <div className="xpbar" role="progressbar" aria-valuemin={0} aria-valuemax={needed} aria-valuenow={intoLevel} aria-label="Erfahrung bis zum nächsten Level">
        <div className="xpbar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="hud-meta">
        <span>
          {intoLevel} / {needed} XP
        </span>
        <span>{seasonOver ? `Saison geschafft (${profile.seasonDays} Tage)` : `Tag ${day} von ${profile.seasonDays}`}</span>
      </div>
    </header>
  );
}

// ---------- today ----------

function TodayView(props: { day: DayLog | undefined; onToggle: (id: string) => void; onReroll: (id: string) => void }) {
  const { day, onToggle, onReroll } = props;
  if (!day) return null;
  const done = day.quests.filter((q) => q.done).length;
  const cleared = isCleared(day);
  const canReroll = day.rerollsUsed < REROLLS_PER_DAY;

  return (
    <section>
      <div className="section-head">
        <h1>Heutige Quests</h1>
        <span className="count">
          {done} von {day.quests.length}
        </span>
      </div>

      <ul className="quests">
        {day.quests.map((q) => (
          <QuestRow key={q.id} quest={q} canReroll={canReroll} onToggle={onToggle} onReroll={onReroll} />
        ))}
      </ul>

      {cleared ? (
        <p className="cleared">
          <span className="display">Tag geschafft</span>
          <span>+{DAY_CLEAR_BONUS} Bonus-XP und +1 Disziplin. Morgen gibt es neue Quests.</span>
        </p>
      ) : (
        <p className="hint">
          Tippe eine Quest an, wenn du sie erledigt hast. Schaffst du alle, gibt es {DAY_CLEAR_BONUS} Bonus-XP.
          {canReroll && ' Eine Quest pro Tag kannst du gegen eine andere tauschen.'}
        </p>
      )}
    </section>
  );
}

function QuestRow(props: { quest: QuestInstance; canReroll: boolean; onToggle: (id: string) => void; onReroll: (id: string) => void }) {
  const { quest: q, canReroll, onToggle, onReroll } = props;
  const [burst, setBurst] = useState(0);

  const toggle = () => {
    if (!q.done) {
      setBurst((b) => b + 1);
      navigator.vibrate?.(30);
    }
    onToggle(q.id);
  };

  return (
    <li className={`quest attr-${q.attr} ${q.done ? 'done' : ''}`}>
      <button className="quest-main" onClick={toggle} aria-pressed={q.done}>
        <span className="quest-icon" aria-hidden>
          {q.icon}
        </span>
        <span className="quest-text">
          <span className="quest-title">{q.title}</span>
          <span className="quest-attr">{ATTR_LABEL[q.attr]}</span>
        </span>
        <span className="quest-amount">
          <span className="display">{q.amount.toLocaleString('de-DE')}</span>
          <span className="quest-unit">{q.unit}</span>
        </span>
        <span className="quest-check" aria-hidden>
          {q.done ? '✓' : `+${q.xp}`}
        </span>
        {burst > 0 && q.done && (
          <span key={burst} className="xp-burst display" aria-hidden>
            +{q.xp} XP
          </span>
        )}
      </button>
      {!q.done && canReroll && (
        <button className="reroll" onClick={() => onReroll(q.id)} aria-label={`${q.title} tauschen`}>
          Tauschen
        </button>
      )}
    </li>
  );
}

// ---------- stats ----------

const ATTR_ORDER: Attr[] = ['staerke', 'ausdauer', 'beweglichkeit', 'disziplin'];

function StatsView({ state, today, xp }: { state: GameState; today: string; xp: number }) {
  const attrs = attributes(state);
  const maxAttr = Math.max(10, ...Object.values(attrs));
  const last28 = useMemo(() => Array.from({ length: 28 }, (_, i) => addDays(today, i - 27)), [today]);

  return (
    <section className="stats">
      <h1>Deine Werte</h1>

      <ul className="attrs">
        {ATTR_ORDER.map((a) => (
          <li key={a} className={`attr attr-${a}`}>
            <span className="attr-name">{ATTR_LABEL[a]}</span>
            <span className="attr-bar">
              <span style={{ width: `${(attrs[a] / maxAttr) * 100}%` }} />
            </span>
            <span className="display attr-val">{attrs[a]}</span>
          </li>
        ))}
      </ul>

      <dl className="totals">
        <div>
          <dt>Gesamt-XP</dt>
          <dd className="display">{xp.toLocaleString('de-DE')}</dd>
        </div>
        <div>
          <dt>Quests erledigt</dt>
          <dd className="display">{questsDone(state)}</dd>
        </div>
        <div>
          <dt>Längste Serie</dt>
          <dd className="display">{bestStreak(state)}</dd>
        </div>
      </dl>

      <h2>Letzte 4 Wochen</h2>
      <div className="calendar" role="list">
        {last28.map((d) => {
          const day = state.days[d];
          const ratio = day ? day.quests.filter((q) => q.done).length / day.quests.length : 0;
          const cls = isCleared(day) ? 'full' : ratio > 0 ? 'part' : 'none';
          return (
            <span
              key={d}
              role="listitem"
              className={`cal ${cls} ${d === today ? 'today' : ''}`}
              title={d}
              aria-label={`${d}: ${cls === 'full' ? 'geschafft' : cls === 'part' ? 'teilweise' : 'nichts'}`}
            />
          );
        })}
      </div>
      <p className="legend">
        <span className="cal full" /> alle Quests <span className="cal part" /> teilweise <span className="cal none" /> nichts
      </p>
    </section>
  );
}

// ---------- settings ----------

function SettingsView(props: {
  state: GameState;
  onUpdate: (p: Partial<Profile>) => void;
  onImport: (s: GameState) => void;
  onReset: () => void;
}) {
  const { state, onUpdate, onImport, onReset } = props;
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
      onImport(parsed);
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
        <input value={profile.name} maxLength={20} onChange={(e) => onUpdate({ name: e.target.value })} />
      </label>

      <fieldset className="field">
        <legend>Schwierigkeit</legend>
        <div className="segmented">
          {([1, 2, 3] as Difficulty[]).map((d) => (
            <button type="button" key={d} aria-pressed={profile.difficulty === d} onClick={() => onUpdate({ difficulty: d })}>
              {DIFFICULTY_LABEL[d]}
            </button>
          ))}
        </div>
        <small>Gilt ab den Quests von morgen.</small>
      </fieldset>

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
        {message && <p className="small-text" role="status">{message}</p>}
      </div>

      <div className="field">
        <span>Neu anfangen</span>
        <button
          className="danger"
          onClick={() => {
            if (confirm('Alle Level, XP und Quests werden gelöscht. Das lässt sich nicht rückgängig machen. Wirklich neu anfangen?')) onReset();
          }}
        >
          Fortschritt löschen
        </button>
      </div>
    </section>
  );
}

// ---------- shared ----------

function TabButton(props: { current: Tab; id: Tab; label: string; icon: string; onSelect: (t: Tab) => void }) {
  const active = props.current === props.id;
  return (
    <button className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} onClick={() => props.onSelect(props.id)}>
      <span aria-hidden>{props.icon}</span>
      {props.label}
    </button>
  );
}

function LevelUp({ level, onClose }: { level: number; onClose: () => void }) {
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
