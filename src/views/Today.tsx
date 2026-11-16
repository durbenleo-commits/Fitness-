import { useCallback, useEffect, useRef, useState } from 'react';
import { currentEnemy, hpLeft } from '../battle';
import {
  ATTR_LABEL,
  DAY_CLEAR_BONUS,
  REROLLS_PER_DAY,
  formatDate,
  bestStreak,
  isCleared,
  questsDone,
  isDailyInstance,
  rankFor,
  READ_QUEST,
  seasonOver,
  seasonDay,
  summarizeSeason,
  type GameState,
  type Profile,
  type QuestInstance,
} from '../game';
import type { Game } from '../store';
import { PRESENCE } from '../pose';
import { healthProgress, proofFor, scanTarget, type HealthMetric, type ProofKind } from '../proof';
import { pagesReadOn } from '../reading';
import { AttrTile, Badge3D, Icon } from './Icons';
import { ReadingSheet } from './Reading';
import { Scanner } from './Scanner';
import { Sprite } from './Sprites';
import { SEASON_OPTIONS } from './Onboarding';
import { METRIC_HINT, PROOF_ICON, PROOF_LABEL, Segmented, Sheet, fmtNum } from './ui';

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

/** The open proof flow on the Today screen. */
type Flow =
  | { kind: 'scan'; quest: QuestInstance; scanId: string; target: number; perUnit?: number }
  | { kind: 'health'; quest: QuestInstance; metric: HealthMetric }
  | { kind: 'read' }
  | { kind: 'undo'; quest: QuestInstance };

export function TodayView({ game, today, onOpenArena }: { game: Game; today: string; onOpenArena: () => void }) {
  const { state } = game;
  const [swapping, setSwapping] = useState(false);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [filter, setFilterState] = useState<'open' | 'done'>('open');
  // Quests ticked off while looking at "Offen" stay in view until the tab changes,
  // so the check animation is visible instead of the card vanishing.
  const [justDone, setJustDone] = useState<string[]>([]);
  const setFilter = (f: 'open' | 'done') => {
    setFilterState(f);
    setJustDone([]);
  };
  const markDone = (id: string) => setJustDone((l) => [...l, id]);
  const close = useCallback(() => setFlow(null), []);
  const day = state.days[today];
  if (!day || !state.profile) return null;
  const done = day.quests.filter((q) => q.done).length;
  const cleared = isCleared(day);
  const canReroll = day.rerollsUsed < REROLLS_PER_DAY;
  const enemy = currentEnemy(state.battles, today);
  const dayNo = Math.min(seasonDay(state.profile, today), state.profile.seasonDays);
  const open = day.quests.length - done;
  const wins = state.battles.filter((b) => b.defeatedOn).length;
  const shown = day.quests.filter((q) => (filter === 'open' ? !q.done || justDone.includes(q.id) : q.done));
  const mood =
    done === 0 ? 'Neuer Tag, neue Quests. Fang mit der leichtesten an.' : open > 0 ? `Läuft. Noch ${open} ${open === 1 ? 'Quest' : 'Quests'} bis zum Bonus.` : 'Alles erledigt. Morgen geht es weiter.';

  /** Tapping a quest starts its proof; a done quest asks whether to take it back. */
  const startProof = (q: QuestInstance) => {
    if (q.done) return setFlow({ kind: 'undo', quest: q });
    const proof = proofFor(q, state.customQuests);
    switch (proof.kind) {
      case 'camera':
        return setFlow({ kind: 'scan', quest: q, scanId: proof.scanId, target: scanTarget(proof, q.amount), perUnit: proof.perUnit });
      case 'presence':
        return setFlow({ kind: 'scan', quest: q, scanId: PRESENCE, target: proof.seconds });
      case 'health':
        return setFlow({ kind: 'health', quest: q, metric: proof.metric });
      case 'photo':
        return setFlow({ kind: 'read' });
    }
  };

  return (
    <section>
      {seasonOver(state.profile, today) && <SeasonEnd state={state} onNewSeason={game.newSeason} />}

      <div className="day-hero">
        <div className="stat-chips">
          <span className="stat-chip">
            <Icon name="arena" size={16} />
            {wins} {wins === 1 ? 'Sieg' : 'Siege'}
          </span>
          <span className="stat-chip">
            <Icon name="check" size={16} />
            {questsDone(state)} erledigt
          </span>
          <span className="stat-chip">
            <Icon name="trophy" size={16} />
            Bestserie {bestStreak(state)}
          </span>
        </div>
        <h1 className="day-title">
          <span className="display">Tag {dayNo}</span>
          <span className="day-of">/ {state.profile.seasonDays}</span>
        </h1>
        <p className="day-mood">{mood}</p>
      </div>

      <div className="filter-tabs" role="tablist" aria-label="Quests filtern">
        <button role="tab" aria-selected={filter === 'open'} onClick={() => setFilter('open')}>
          Offen <span>{open}</span>
        </button>
        <button role="tab" aria-selected={filter === 'done'} onClick={() => setFilter('done')}>
          Erledigt <span>{done}</span>
        </button>
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
        {shown.length === 0 && (
          <li className="empty-list">{filter === 'open' ? 'Keine offenen Quests mehr.' : 'Noch nichts erledigt. Los geht’s!'}</li>
        )}
        {shown.map((q) => {
          const swappable = !q.done && !isDailyInstance(state, q);
          const proof = proofFor(q, state.customQuests);
          return (
            <QuestRow
              key={q.id}
              quest={q}
              swapMode={swapping}
              swappable={swappable}
              proof={proof.kind}
              note={questNote(state, today, q)}
              onTap={() => {
                if (!swapping) return startProof(q);
                if (!swappable) return;
                game.reroll(q.id);
                setSwapping(false);
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
            <p className="hint">
              Jede Quest braucht einen Nachweis: Die Kamera zählt mit, beim Lesen machst du ein Foto der Seite, Schritte und Training kommen
              aus Samsung Health.
            </p>
            {canReroll && done < day.quests.length && (
              <button className="joker" onClick={() => setSwapping(true)}>
                <Icon name="swap" size={18} />
                Quest tauschen <span className="joker-count">1 Joker</span>
              </button>
            )}
          </>
        )}
      </div>

      {flow?.kind === 'scan' && (
        <Scanner
          exerciseId={flow.scanId}
          title={flow.quest.title}
          target={flow.target}
          unit={flow.quest.unit}
          easy={!!flow.quest.easy}
          perUnit={flow.perUnit}
          onDone={(amount) => {
            if (amount >= flow.target) {
              markDone(flow.quest.id);
              game.completeQuest(flow.quest.id);
            }
            setFlow(null);
          }}
          onClose={close}
        />
      )}
      {flow?.kind === 'health' && <HealthSheet game={game} today={today} quest={flow.quest} metric={flow.metric} onClose={close} />}
      {flow?.kind === 'read' && (
        <ReadingSheet
          game={game}
          today={today}
          onClose={close}
          onCompleted={() => {
            const q = day.quests.find((x) => x.templateId === READ_QUEST);
            if (q) markDone(q.id);
          }}
        />
      )}
      {flow?.kind === 'undo' && (
        <UndoSheet
          quest={flow.quest}
          proof={proofFor(flow.quest, state.customQuests).kind}
          onCancel={close}
          onRead={() => setFlow({ kind: 'read' })}
          onConfirm={() => {
            game.uncheckQuest(flow.quest.id);
            setJustDone((l) => l.filter((x) => x !== flow.quest.id));
            setFlow(null);
          }}
        />
      )}

      {enemy && (
        <button className={`arena-teaser attr-${enemy.attr} ${enemy.defeatedOn ? 'won' : ''}`} onClick={onOpenArena}>
          <Sprite enemyId={enemy.enemyId} className="teaser-monster" />
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

/** The small line under an open quest: health progress, pages read today, or attribute and XP. */
function questNote(state: GameState, today: string, q: QuestInstance): string {
  const fallback = `${ATTR_LABEL[q.attr]} · +${q.xp} XP`;
  if (q.done) return fallback;
  const value = healthProgress(q, state.health.days, today, state.customQuests);
  if (value !== null) {
    return state.health.connected ? `${fmtNum(value)} von ${fmtNum(q.amount)} ${q.unit} · Samsung Health` : 'Kommt aus Samsung Health';
  }
  if (q.templateId === READ_QUEST) {
    const pages = pagesReadOn(state, today);
    if (pages > 0) return `Heute ${pages} von ${q.amount} Seiten`;
  }
  return fallback;
}

function QuestRow(props: {
  quest: QuestInstance;
  swapMode: boolean;
  swappable: boolean;
  proof: ProofKind;
  note: string;
  onTap: () => void;
}) {
  const { quest: q, swapMode, swappable, proof, note, onTap } = props;
  const [burst, setBurst] = useState(0);
  const wasDone = useRef(q.done);

  // Celebrate when the quest turns done (after a scan, a page photo, or Samsung Health).
  useEffect(() => {
    if (q.done && !wasDone.current) {
      setBurst((b) => b + 1);
      navigator.vibrate?.(30);
    }
    wasDone.current = q.done;
  }, [q.done]);

  const label = swapMode ? `${q.title} tauschen` : q.done ? `${q.title}, erledigt. Zurücknehmen?` : `${q.title}: Nachweis, ${PROOF_LABEL[proof]}`;

  return (
    <li className={`quest attr-${q.attr} ${q.done ? 'done' : ''} ${swapMode && !swappable ? 'locked' : ''}`}>
      <button className="quest-main" onClick={onTap} aria-label={label} disabled={swapMode && !swappable}>
        <AttrTile attr={q.attr} />
        <span className="quest-text">
          <span className="quest-title">{q.title}</span>
          <span className={`quest-attr ${proof === 'health' && !q.done ? 'health' : ''}`}>{note}</span>
        </span>
        <span className="quest-amount">
          <span className="display">{q.amount.toLocaleString('de-DE')}</span>
          <span className="quest-unit">{q.unit}</span>
        </span>
        <span className={`quest-check proof-${proof}`} aria-hidden>
          {swapMode && swappable ? (
            <Icon name="swap" size={20} />
          ) : q.done ? (
            <Badge3D icon="check" tone={q.attr} shape="coin" size={42} />
          ) : (
            <Icon name={PROOF_ICON[proof]} size={20} />
          )}
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

/** Health quests are never ticked by hand: this explains where the number comes from. */
function HealthSheet({ game, today, quest: q, metric, onClose }: { game: Game; today: string; quest: QuestInstance; metric: HealthMetric; onClose: () => void }) {
  const { state, health } = game;
  const value = healthProgress(q, state.health.days, today, state.customQuests) ?? 0;
  const connected = state.health.connected;
  const last = state.health.lastSync ? new Date(state.health.lastSync) : null;
  return (
    <Sheet title={q.title} onClose={onClose}>
      <div className="proof-sheet">
        <div className="proof-head">
          <Badge3D icon="heart" tone="ausdauer" size={46} />
          <span>
            <strong>Bestätigt von Samsung Health</strong>
            <small>Diese Quest hakt sich von selbst ab. Von Hand geht es nicht.</small>
          </span>
        </div>
        {connected && (
          <div className="proof-progress">
            <span className="proof-value">
              <span className="display">{fmtNum(value)}</span> von {fmtNum(q.amount)} {q.unit}
            </span>
            <span className="proof-bar" aria-hidden>
              <span style={{ width: `${Math.min(value / q.amount, 1) * 100}%` }} />
            </span>
          </div>
        )}
        <p className="small-text">{METRIC_HINT[metric]} Sobald Samsung Health genug meldet, ist die Quest erledigt.</p>
        {!health.supported ? (
          <p className="proof-note">
            Samsung Health kann nur die Android-App lesen, nicht die Browser-Version. Installiere die neueste Questfit-APK, dann zählt es
            automatisch.
          </p>
        ) : connected ? (
          <>
            {last && (
              <p className="small-text">
                Zuletzt abgeglichen: {last.toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <button className="secondary" onClick={health.sync} disabled={health.syncing}>
              {health.syncing ? 'Gleiche ab …' : 'Jetzt abgleichen'}
            </button>
          </>
        ) : (
          <>
            <p className="proof-note">Samsung Health ist noch nicht verbunden.</p>
            <button className="primary" onClick={health.connect}>
              Mit Samsung Health verbinden
            </button>
          </>
        )}
        {health.error && (
          <p className="error" role="alert">
            {health.error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

function UndoSheet({
  quest: q,
  proof,
  onCancel,
  onConfirm,
  onRead,
}: {
  quest: QuestInstance;
  proof: ProofKind;
  onCancel: () => void;
  onConfirm: () => void;
  onRead: () => void;
}) {
  return (
    <Sheet title="Zurücknehmen?" onClose={onCancel}>
      <div className="proof-sheet">
        <p>
          <strong>{q.title}</strong> ist erledigt. Nimmst du das zurück, fallen die {q.xp} XP dafür weg.
          {proof === 'health' && ' Solange Samsung Health genug meldet, hakt sich die Quest gleich wieder ab.'}
          {proof === 'photo' && ' Deine eingetragenen Seiten bleiben gespeichert.'}
        </p>
        {proof === 'photo' && (
          <button className="primary" onClick={onRead}>
            Seiten eintragen
          </button>
        )}
        <div className="row">
          <button className="secondary" onClick={onCancel}>
            Behalten
          </button>
          <button className="danger grow" onClick={onConfirm}>
            Zurücknehmen
          </button>
        </div>
      </div>
    </Sheet>
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
