import { useState } from 'react';
import {
  ATTR_LABEL,
  DAY_CLEAR_BONUS,
  REROLLS_PER_DAY,
  formatDate,
  isCleared,
  isDailyInstance,
  isTrackedQuest,
  rankFor,
  seasonOver,
  seasonDay,
  summarizeSeason,
  type GameState,
  type Profile,
  type QuestInstance,
} from '../game';
import type { Game } from '../store';
import { SEASON_OPTIONS } from './Onboarding';
import { Segmented } from './ui';

export function Hud(props: { profile: Profile; level: number; intoLevel: number; needed: number; streak: number; today: string }) {
  const { profile, level, intoLevel, needed, streak, today } = props;
  const day = seasonDay(profile, today);
  const over = day > profile.seasonDays;
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
        <span>{over ? 'Saison beendet' : `Tag ${day} von ${profile.seasonDays}`}</span>
      </div>
    </header>
  );
}

export function TodayView({ game, today }: { game: Game; today: string }) {
  const { state } = game;
  const day = state.days[today];
  if (!day || !state.profile) return null;
  const done = day.quests.filter((q) => q.done).length;
  const cleared = isCleared(day);
  const canReroll = day.rerollsUsed < REROLLS_PER_DAY;

  return (
    <section>
      {seasonOver(state.profile, today) && <SeasonEnd state={state} onNewSeason={game.newSeason} />}

      <div className="section-head">
        <h1>Heutige Quests</h1>
        <span className="count">
          {done} von {day.quests.length}
        </span>
      </div>

      <ul className="quests">
        {day.quests.map((q) => (
          <QuestRow
            key={q.id}
            quest={q}
            canReroll={canReroll && !isDailyInstance(state, q)}
            tracked={state.health.connected && isTrackedQuest(q.templateId) ? healthValue(state, today, q.templateId) : null}
            onToggle={game.toggleQuest}
            onReroll={game.reroll}
          />
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

function healthValue(state: GameState, today: string, templateId: string): number {
  const h = state.health.days[today];
  if (!h) return 0;
  return templateId === 'steps' ? h.steps : h.runKm;
}

function QuestRow(props: {
  quest: QuestInstance;
  canReroll: boolean;
  tracked: number | null;
  onToggle: (id: string) => void;
  onReroll: (id: string) => void;
}) {
  const { quest: q, canReroll, tracked, onToggle, onReroll } = props;
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
          <span className="quest-attr">
            {tracked !== null && !q.done
              ? `${tracked.toLocaleString('de-DE')} von ${q.amount.toLocaleString('de-DE')}, Samsung Health`
              : ATTR_LABEL[q.attr]}
          </span>
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

function SeasonEnd({ state, onNewSeason }: { state: GameState; onNewSeason: (len: number) => void }) {
  const profile = state.profile!;
  const s = summarizeSeason(state, profile.startDate, profile.seasonDays);
  const [length, setLength] = useState(SEASON_OPTIONS.some((o) => o.value === profile.seasonDays) ? profile.seasonDays : 66);
  const rate = Math.round((s.daysCleared / s.length) * 100);

  return (
    <div className="season-end">
      <span className="display season-end-title">Saison beendet</span>
      <p className="small-text">
        {formatDate(s.startDate)} bis {formatDate(s.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
      <dl className="season-stats">
        <div>
          <dt>Tage geschafft</dt>
          <dd>
            <span className="display">{s.daysCleared}</span> von {s.length} ({rate} %)
          </dd>
        </div>
        <div>
          <dt>Quests</dt>
          <dd className="display">{s.questsDone}</dd>
        </div>
        <div>
          <dt>XP</dt>
          <dd className="display">{s.xp.toLocaleString('de-DE')}</dd>
        </div>
        <div>
          <dt>Längste Serie</dt>
          <dd className="display">{s.bestStreak}</dd>
        </div>
      </dl>
      <p className="small-text">Level, XP und Erfolge nimmst du in die nächste Saison mit.</p>
      <Segmented options={SEASON_OPTIONS} value={length} onChange={setLength} />
      <button className="primary" onClick={() => onNewSeason(length)}>
        Neue Saison starten
      </button>
    </div>
  );
}
