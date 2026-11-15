import { useState } from 'react';
import { hpLeft } from '../battle';
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
import { AttrTile, Badge3D, Icon } from './Icons';
import { Monster } from './Monster';
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
        <div className="badge-wrap" aria-label={`Level ${level}`}>
          <div className="badge">
            <span className="badge-label">Lvl</span>
            <span className="display badge-num">{level}</span>
          </div>
        </div>
        <div className="hud-who">
          <strong className="hud-name">{profile.name}</strong>
          <span className="hud-rank">
            {rankFor(level)} · {over ? 'Saison beendet' : `Tag ${day} von ${profile.seasonDays}`}
          </span>
        </div>
        <div className={`streak ${streak > 0 ? 'on' : ''}`} aria-label={`${streak} Tage Serie`}>
          <Icon name="flame" size={22} />
          <span className="display">{streak}</span>
        </div>
      </div>

      <div className="xp-row">
        <div className="xpbar" role="progressbar" aria-valuemin={0} aria-valuemax={needed} aria-valuenow={intoLevel} aria-label="Erfahrung bis zum nächsten Level">
          <div className="xpbar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="xp-text">
          {intoLevel}/{needed} XP
        </span>
      </div>
    </header>
  );
}

export function TodayView({ game, today, onOpenArena }: { game: Game; today: string; onOpenArena: () => void }) {
  const { state } = game;
  const [swapping, setSwapping] = useState(false);
  const day = state.days[today];
  if (!day || !state.profile) return null;
  const done = day.quests.filter((q) => q.done).length;
  const cleared = isCleared(day);
  const canReroll = day.rerollsUsed < REROLLS_PER_DAY;
  const enemy = state.battles.find((b) => b.id === `enemy-${today}`);

  return (
    <section>
      {seasonOver(state.profile, today) && <SeasonEnd state={state} onNewSeason={game.newSeason} />}

      <div className="section-head">
        <h1>Heutige Quests</h1>
        <span className="count">
          {done} von {day.quests.length}
        </span>
      </div>

      <div className={`day-track ${cleared ? 'full' : ''}`} aria-hidden>
        {day.quests.map((q) => (
          <span key={q.id} className={`seg attr-${q.attr} ${q.done ? 'on' : ''}`} />
        ))}
        <span className="day-bonus">
          <Icon name="star" size={18} />+{DAY_CLEAR_BONUS}
        </span>
      </div>

      <ul className={`quests ${swapping ? 'swapping' : ''}`}>
        {day.quests.map((q) => {
          const swappable = !q.done && !isDailyInstance(state, q);
          return (
            <QuestRow
              key={q.id}
              quest={q}
              swapMode={swapping}
              swappable={swappable}
              tracked={state.health.connected && isTrackedQuest(q.templateId) ? healthValue(state, today, q.templateId) : null}
              onTap={() => {
                if (swapping) {
                  if (!swappable) return;
                  game.reroll(q.id);
                  setSwapping(false);
                } else game.toggleQuest(q.id);
              }}
            />
          );
        })}
      </ul>

      <div className="today-actions">
        {cleared ? (
          <p className="cleared">
            <span className="display">Tag geschafft</span>
            <span>+{DAY_CLEAR_BONUS} Bonus-XP und +1 Disziplin. Morgen gibt es neue Quests.</span>
          </p>
        ) : swapping ? (
          <p className="hint">
            Tippe auf die Quest, die du tauschen willst.{' '}
            <button className="link-button" onClick={() => setSwapping(false)}>
              Abbrechen
            </button>
          </p>
        ) : (
          <>
            <p className="hint">Tippe auf eine Quest, wenn du sie erledigt hast.</p>
            {canReroll && done < day.quests.length && (
              <button className="joker" onClick={() => setSwapping(true)}>
                <Icon name="swap" size={18} />
                Quest tauschen <span className="joker-count">1 Joker</span>
              </button>
            )}
          </>
        )}
      </div>

      {enemy && (
        <button className={`arena-teaser attr-${enemy.attr} ${enemy.defeatedOn ? 'won' : ''}`} onClick={onOpenArena}>
          <Monster enemyId={enemy.enemyId} attr={enemy.attr} className="teaser-monster" />
          <span className="teaser-text">
            <span className="teaser-label">Heute in der Arena</span>
            <strong>{enemy.name}</strong>
            {enemy.defeatedOn ? (
              <span className="teaser-sub">Besiegt</span>
            ) : (
              <span className="teaser-hp">
                <span style={{ width: `${hpLeft(enemy, state.health.connected ? state.health.days : null) * 100}%` }} />
              </span>
            )}
          </span>
          <span className="teaser-go">{enemy.defeatedOn ? 'Ansehen' : 'Kämpfen'}</span>
        </button>
      )}
    </section>
  );
}

function healthValue(state: GameState, today: string, templateId: string): number {
  const h = state.health.days[today];
  if (!h) return 0;
  return templateId === 'steps' ? h.steps : h.runKm;
}

function QuestRow(props: { quest: QuestInstance; swapMode: boolean; swappable: boolean; tracked: number | null; onTap: () => void }) {
  const { quest: q, swapMode, swappable, tracked, onTap } = props;
  const [burst, setBurst] = useState(0);

  const tap = () => {
    if (!swapMode && !q.done) {
      setBurst((b) => b + 1);
      navigator.vibrate?.(30);
    }
    onTap();
  };

  return (
    <li className={`quest attr-${q.attr} ${q.done ? 'done' : ''} ${swapMode && !swappable ? 'locked' : ''}`}>
      <button className="quest-main" onClick={tap} aria-pressed={swapMode ? undefined : q.done} disabled={swapMode && !swappable}>
        <AttrTile attr={q.attr} />
        <span className="quest-text">
          <span className="quest-title">{q.title}</span>
          <span className="quest-attr">
            {tracked !== null && !q.done
              ? `${tracked.toLocaleString('de-DE')} von ${q.amount.toLocaleString('de-DE')}, Samsung Health`
              : `${ATTR_LABEL[q.attr]} · +${q.xp} XP`}
          </span>
        </span>
        <span className="quest-amount">
          <span className="display">{q.amount.toLocaleString('de-DE')}</span>
          <span className="quest-unit">{q.unit}</span>
        </span>
        <span className="quest-check" aria-hidden>
          {swapMode && swappable ? (
            <Icon name="swap" size={20} />
          ) : q.done ? (
            <Badge3D icon="check" tone={q.attr} shape="coin" size={42} />
          ) : null}
        </span>
        {burst > 0 && q.done && (
          <span key={burst} className="xp-burst display" aria-hidden>
            +{q.xp} XP
          </span>
        )}
      </button>
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
