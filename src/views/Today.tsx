import { useCallback, useEffect, useRef, useState } from 'react';
import { currentEnemy, hpLeft } from '../battle';
import {
  ATTR_LABEL,
  DAY_CLEAR_BONUS,
  canSwitchVariant,
  REROLLS_PER_DAY,
  formatDate,
  bestStreak,
  extraQuests,
  isCleared,
  isDoubled,
  isLegacyDay,
  levelFromXp,
  newlyUnlocked,
  totalXp,
  isSwappable,
  maxAchieved,
  questAchieved,
  questXp,
  questsDone,
  rankFor,
  READ_QUEST,
  requiredQuests,
  seasonOver,
  seasonDay,
  summarizeSeason,
  type GameState,
  type Profile,
  type QuestInstance,
} from '../game';
import type { Game } from '../store';
import { PRESENCE, STRETCH_FOCUS } from '../pose';
import { healthProgress, proofFor, questMaxTarget, questTarget, scanToAchieved, type HealthMetric, type ProofKind } from '../proof';
import { pagesReadOn } from '../reading';
import { hasExerciseAnim } from '../anim/exercises';
import { AttrTile, Badge3D, Icon } from './Icons';
import { ExerciseGuide } from './ExerciseGuide';
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
  // target and max (2×) are in the scanner's units; base is what already counts (doing more on a done quest)
  | { kind: 'scan'; quest: QuestInstance; scanId: string; target: number; max: number; base: number; perUnit?: number }
  | { kind: 'health'; quest: QuestInstance; metric: HealthMetric }
  | { kind: 'read' }
  | { kind: 'done'; quest: QuestInstance }
  | { kind: 'guide'; questId: string };

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
  const custom = state.customQuests;
  // Required quests ("Pflicht") decide the day bonus and the streak; extras are optional.
  // Legacy days (made before extras existed) have no extras: everything is required.
  const legacy = isLegacyDay(day);
  const required = requiredQuests(day);
  const extras = extraQuests(day);
  const done = required.filter((q) => q.done).length;
  const open = required.length - done;
  const extrasDone = extras.filter((q) => q.done).length;
  // tab badges count everything the lists show; the bonus text and day track use required only
  const allDone = done + extrasDone;
  const allOpen = required.length + extras.length - allDone;
  const cleared = isCleared(day);
  const canSwap = day.rerollsUsed < REROLLS_PER_DAY && day.quests.some((q) => isSwappable(day, q, custom));
  const enemy = currentEnemy(state.battles, today);
  const dayNo = Math.min(seasonDay(state.profile, today), state.profile.seasonDays);
  const wins = state.battles.filter((b) => b.defeatedOn).length;
  // exercises a level-up unlocked since the player last closed the note
  const level = levelFromXp(totalXp(state)).level;
  const unlocked = state.seenUnlockLevel < level ? newlyUnlocked(state.seenUnlockLevel, level, state.profile) : [];
  const visible = (q: QuestInstance) => (filter === 'open' ? !q.done || justDone.includes(q.id) : q.done);
  const mood =
    done === 0 && extrasDone === 0
      ? 'Neuer Tag, neue Quests. Fang mit der leichtesten an.'
      : open > 0
        ? `Läuft. Noch ${open} ${open === 1 ? 'Quest' : 'Quests'} bis zum Bonus.`
        : extrasDone < extras.length
          ? 'Pflicht erledigt. Die Extras bringen noch mehr XP.'
          : 'Alles erledigt. Morgen geht es weiter.';

  /** Start the camera (or presence timer) for a quest; `more` continues a done quest towards 2×. */
  const startScan = (q: QuestInstance, more = false) => {
    const proof = proofFor(q, custom);
    if (proof.kind !== 'camera' && proof.kind !== 'presence') return;
    const target = questTarget(q, custom);
    const max = questMaxTarget(q, custom);
    const base = more && q.amount > 0 ? Math.min(max, Math.floor((target * questAchieved(q)) / q.amount + 1e-9)) : 0;
    setFlow({
      kind: 'scan',
      quest: q,
      scanId: proof.kind === 'camera' ? proof.scanId : PRESENCE,
      target,
      max,
      base,
      perUnit: proof.kind === 'camera' ? proof.perUnit : undefined,
    });
  };

  /** Tapping a quest starts its proof; a done quest offers "more" (up to 2×) or taking it back. */
  const startProof = (q: QuestInstance) => {
    if (q.done) return setFlow({ kind: 'done', quest: q });
    const proof = proofFor(q, custom);
    switch (proof.kind) {
      case 'camera':
      case 'presence':
        return startScan(q);
      case 'health':
        return setFlow({ kind: 'health', quest: q, metric: proof.metric });
      case 'photo':
        return setFlow({ kind: 'read' });
    }
  };

  const row = (q: QuestInstance) => {
    const swappable = isSwappable(day, q, custom);
    return (
      <QuestRow
        key={q.id}
        quest={q}
        swapMode={swapping}
        swappable={swappable}
        proof={proofFor(q, custom).kind}
        note={questNote(state, today, q)}
        canSwitch={!swapping && canSwitchVariant(q, custom)}
        onSwitch={() => game.setQuestVariant(q.id, !q.easy)}
        onGuide={!swapping && !custom.some((t) => t.id === q.templateId) && hasExerciseAnim(q.templateId) ? () => setFlow({ kind: 'guide', questId: q.id }) : undefined}
        onTap={() => {
          if (!swapping) return startProof(q);
          if (!swappable) return;
          game.reroll(q.id);
          setSwapping(false);
        }}
      />
    );
  };

  const list = (quests: QuestInstance[], empty: string, extra = false) => {
    const shown = quests.filter(visible);
    return (
      <ul className={`quests ${extra ? 'extras' : ''} ${swapping ? 'swapping' : ''}`}>
        {shown.length === 0 && <li className="empty-list">{empty}</li>}
        {shown.map(row)}
      </ul>
    );
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

      {unlocked.length > 0 && (
        <div className="unlock-note" role="status">
          <Icon name="star" size={18} />
          <span>
            <strong>Neu freigeschaltet:</strong> {unlocked.map((t) => t.title).join(', ')}. Kann ab morgen in den Extras kommen.
          </span>
          <button className="link-button" onClick={game.markUnlocksSeen}>
            OK
          </button>
        </div>
      )}

      <div className="filter-tabs" role="tablist" aria-label="Quests filtern">
        <button role="tab" aria-selected={filter === 'open'} onClick={() => setFilter('open')}>
          Offen <span>{allOpen}</span>
        </button>
        <button role="tab" aria-selected={filter === 'done'} onClick={() => setFilter('done')}>
          Erledigt <span>{allDone}</span>
        </button>
      </div>

      <div className={`day-track ${cleared ? 'full' : ''}`} aria-hidden>
        {required.map((q) => (
          <span key={q.id} className={`seg attr-${q.attr} ${q.done ? 'on' : ''}`} />
        ))}
        <span className="day-bonus">
          <Icon name="star" size={18} />+{DAY_CLEAR_BONUS}
        </span>
      </div>

      {legacy ? (
        list(required, filter === 'open' ? 'Keine offenen Quests mehr.' : 'Noch nichts erledigt. Los geht’s!')
      ) : (
        <>
          <div className="quest-section">
            <h2>Pflicht</h2>
            <span>Für Tagesbonus und Serie</span>
          </div>
          {list(required, filter === 'open' ? 'Alle Pflicht-Quests erledigt.' : 'Noch keine Pflicht-Quest erledigt. Los geht’s!')}
          {extras.length > 0 && (
            <>
              <div className="quest-section extra">
                <h2>
                  Extra <span className="quest-section-count">{extrasDone}/{extras.length}</span>
                </h2>
                <span>Freiwillig – bringen zusätzliche XP</span>
              </div>
              {list(extras, filter === 'open' ? 'Alle Extras erledigt.' : 'Noch kein Extra erledigt.', true)}
            </>
          )}
        </>
      )}

      <div className="today-actions">
        {cleared ? (
          <p className="cleared">
            <span className="display">Tag geschafft</span>
            <span>
              +{DAY_CLEAR_BONUS} Bonus-XP und +1 Disziplin.{' '}
              {extrasDone < extras.length ? 'Extras und alles bis 2× bringen weiter XP.' : 'Morgen gibt es neue Quests.'}
            </span>
          </p>
        ) : null}
        {swapping ? (
          <p className="hint">
            Tippe auf die Quest, die du tauschen willst.{' '}
            <button className="link-button" onClick={() => setSwapping(false)}>
              Abbrechen
            </button>
          </p>
        ) : (
          <>
            {!cleared && (
              <p className="hint">
                Jede Quest braucht einen Nachweis: Die Kamera zählt mit, beim Lesen machst du ein Foto der Seite, Schritte und Training kommen
                aus Samsung Health. Bis 2× gibt es mehr XP.
              </p>
            )}
            {canSwap && (
              <button
                className="joker"
                onClick={() => {
                  setFilter('open');
                  setSwapping(true);
                }}
              >
                <Icon name="swap" size={18} />
                {legacy ? 'Quest tauschen' : 'Extra tauschen'} <span className="joker-count">1 Joker</span>
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
          max={flow.max}
          base={flow.base}
          unit={flow.quest.unit}
          easy={!!flow.quest.easy}
          perUnit={flow.perUnit}
          focus={STRETCH_FOCUS[flow.quest.templateId]}
          onDone={(counted) => {
            if (counted >= flow.target && counted > flow.base) {
              if (!flow.quest.done) markDone(flow.quest.id);
              game.completeQuest(flow.quest.id, scanToAchieved(flow.quest, counted, custom));
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
      {flow?.kind === 'done' && (
        <DoneSheet
          // show the live quest (health data or pages may have raised it since the tap)
          quest={day.quests.find((q) => q.id === flow.quest.id) ?? flow.quest}
          proof={proofFor(flow.quest, custom).kind}
          onClose={close}
          onMore={() => startScan(day.quests.find((q) => q.id === flow.quest.id) ?? flow.quest, true)}
          onRead={() => setFlow({ kind: 'read' })}
          onUndo={() => {
            game.uncheckQuest(flow.quest.id);
            setJustDone((l) => l.filter((x) => x !== flow.quest.id));
            setFlow(null);
          }}
        />
      )}

      {flow?.kind === 'guide' &&
        (() => {
          const q = day.quests.find((x) => x.id === flow.questId);
          return q ? <QuestGuide quest={q} canSwitch={canSwitchVariant(q, custom)} onApply={(easy) => game.setQuestVariant(q.id, easy)} onClose={close} /> : null;
        })()}

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

const percentOf = (q: QuestInstance) => Math.round((questAchieved(q) / q.amount) * 100);

/**
 * The small line under a quest: health progress or pages read today while open, else attribute and
 * XP. Done quests show the XP earned, and how much was done when it is more than asked.
 */
function questNote(state: GameState, today: string, q: QuestInstance): string {
  const note = questNoteBase(state, today, q);
  return q.bonus ? `${note} · Ausdauer-Bonus +25 %` : note;
}

function questNoteBase(state: GameState, today: string, q: QuestInstance): string {
  if (q.done) {
    const xp = `+${questXp(q)} XP`;
    const got = questAchieved(q);
    if (q.amount > 0 && got > q.amount + 1e-9) return `${fmtNum(got)} / ${fmtNum(q.amount)} ${q.unit} · ${percentOf(q)} % · ${xp}`;
    return `${ATTR_LABEL[q.attr]} · ${xp}`;
  }
  const fallback = `${ATTR_LABEL[q.attr]} · +${q.xp} XP`;
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
  canSwitch: boolean;
  onSwitch: () => void;
  onTap: () => void;
  /** Opens the exercise guide; missing when the quest has no animation. */
  onGuide?: () => void;
}) {
  const { quest: q, swapMode, swappable, proof, note, canSwitch, onSwitch, onTap, onGuide } = props;
  const xp = questXp(q);
  const doubled = isDoubled(q);
  const [burst, setBurst] = useState<{ key: number; xp: number } | null>(null);
  const lastXp = useRef(xp);

  // Celebrate when the quest earns XP: turning done (scan, page photo, Samsung Health) or doing more.
  useEffect(() => {
    if (xp > lastXp.current) {
      const gained = xp - lastXp.current;
      setBurst((b) => ({ key: (b?.key ?? 0) + 1, xp: gained }));
      navigator.vibrate?.(30);
    }
    lastXp.current = xp;
  }, [xp]);

  const label = swapMode
    ? `${q.title} tauschen`
    : q.done
      ? `${q.title}, erledigt${doubled ? ' (doppelt)' : ''}. Mehr machen oder zurücknehmen?`
      : `${q.title}: Nachweis, ${PROOF_LABEL[proof]}`;

  return (
    <li className={`quest attr-${q.attr} ${q.done ? 'done' : ''} ${q.extra ? 'is-extra' : ''} ${swapMode && !swappable ? 'locked' : ''}`}>
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
            <Badge3D icon="check" tone={doubled ? 'gold' : q.attr} shape="coin" size={42} />
          ) : (
            <Icon name={PROOF_ICON[proof]} size={20} />
          )}
        </span>
        {doubled && (
          <span className="x2-badge display" aria-hidden>
            2×
          </span>
        )}
        {burst && q.done && (
          <span key={burst.key} className="xp-burst display" aria-hidden>
            +{burst.xp} XP
          </span>
        )}
      </button>
      {(canSwitch || onGuide) && (
        <div className="quest-tools">
          {onGuide && (
            <button type="button" className="guide-link" onClick={onGuide} aria-label={`${q.title}: Anleitung mit Animation`}>
              <Icon name="play" size={16} />
              Anleitung
            </button>
          )}
          {canSwitch && (
            <button
              className="link-button"
              style={{ fontSize: '0.8rem', padding: '0.25rem 0.4rem' }}
              onClick={onSwitch}
              aria-label={q.easy ? `${q.title}: normale Ausführung, volle XP` : `${q.title}: leichtere Ausführung, weniger XP`}
            >
              {q.easy ? 'Normal' : 'Leichter'}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * "Anleitung" for one quest: starts on the quest's current variant. Switching inside is a preview; while the
 * quest is open and switchable, "Diese Version nehmen" applies the shown variant to the quest.
 */
function QuestGuide({ quest: q, canSwitch, onApply, onClose }: { quest: QuestInstance; canSwitch: boolean; onApply: (easy: boolean) => void; onClose: () => void }) {
  const [shown, setShown] = useState(!!q.easy);
  const differs = shown !== !!q.easy;
  return (
    <ExerciseGuide
      exerciseId={q.templateId}
      easy={!!q.easy}
      onEasyChange={setShown}
      onClose={onClose}
      footer={
        differs &&
        (canSwitch ? (
          <button
            className="primary"
            onClick={() => {
              onApply(shown);
              onClose();
            }}
          >
            Diese Version nehmen
          </button>
        ) : (
          <p className="xguide-note">Nur Vorschau: Deine Quest bleibt {q.easy ? 'leichter' : 'normal'}{q.done ? ', weil sie schon erledigt ist' : ''}.</p>
        ))
      }
    />
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

/** A done quest: how much was done, doing more (up to 2×) and taking it back. */
function DoneSheet({
  quest: q,
  proof,
  onClose,
  onMore,
  onRead,
  onUndo,
}: {
  quest: QuestInstance;
  proof: ProofKind;
  onClose: () => void;
  onMore: () => void;
  onRead: () => void;
  onUndo: () => void;
}) {
  const got = questAchieved(q);
  const max = maxAchieved(q);
  const doubled = isDoubled(q);
  const xp = questXp(q);
  return (
    <Sheet title={q.title} onClose={onClose}>
      <div className="proof-sheet">
        <div className={`proof-progress attr-${q.attr}`}>
          <span className="proof-value">
            <span className="display">{fmtNum(got)}</span> von {fmtNum(q.amount)} {q.unit} · {percentOf(q)} %
          </span>
          <span className="proof-bar double" aria-hidden>
            <span style={{ width: `${Math.min(got / max, 1) * 100}%` }} />
          </span>
          <span className="double-scale" aria-hidden>
            <span>1× · {fmtNum(q.amount)}</span>
            <span>2× · {fmtNum(max)}</span>
          </span>
          <span className="done-xp">
            <strong className="display">{xp} XP</strong>
            {doubled ? ` · +2 ${ATTR_LABEL[q.attr]}` : ` · bis 2×: ${Math.round(q.xp * 2)} XP und +1 ${ATTR_LABEL[q.attr]} extra`}
          </span>
        </div>

        {doubled ? (
          <p className="proof-note">Doppelt geschafft. Mehr als 2× zählt nicht.</p>
        ) : proof === 'camera' || proof === 'presence' ? (
          <>
            <p className="small-text">
              Die Kamera zählt ab {fmtNum(got)} weiter (bis 2×: {fmtNum(max)} {q.unit}). Alles darüber bringt mehr XP, doppelt gibt es einen
              Bonus-Punkt {ATTR_LABEL[q.attr]}.
            </p>
            <button className="primary" onClick={onMore}>
              <Icon name="camera" size={20} />
              Mehr machen (bis 2×)
            </button>
          </>
        ) : proof === 'health' ? (
          <p className="small-text">
            Kommt aus Samsung Health: Was du heute mehr machst, zählt automatisch mit, bis 2× ({fmtNum(max)} {q.unit}). Von Hand geht es nicht.
          </p>
        ) : proof === 'photo' ? (
          <>
            <p className="small-text">Jede Seite, die du heute mehr liest, zählt mit, bis 2× ({fmtNum(max)} Seiten). Trag sie mit Foto ein.</p>
            <button className="primary" onClick={onRead}>
              <Icon name="book" size={20} />
              Mehr machen (bis 2×)
            </button>
          </>
        ) : null}

        <p className="small-text">
          Nimmst du die Quest zurück, fallen die {xp} XP dafür weg.
          {proof === 'health' && ' Solange Samsung Health genug meldet, hakt sich die Quest gleich wieder ab.'}
          {proof === 'photo' && ' Deine eingetragenen Seiten bleiben gespeichert.'}
        </p>
        <div className="row">
          <button className="secondary" onClick={onClose}>
            Behalten
          </button>
          <button className="danger grow" onClick={onUndo}>
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
