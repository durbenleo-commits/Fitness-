import { useState } from 'react';
import {
  battleStatus,
  hpLeft,
  phaseProgress,
  quickAmounts,
  weekStart,
  type Battle,
  type BattlePhase,
} from '../battle';
import { ATTR_LABEL, BOSS_ATTR_POINTS, ENEMY_ATTR_POINTS, addDays, daysBetween, formatDate } from '../game';
import type { Game } from '../store';

export function ArenaView({ game, today }: { game: Game; today: string }) {
  const { state } = game;
  const enemy = state.battles.find((b) => b.id === `enemy-${today}`);
  const boss = state.battles.find((b) => b.id === `boss-${weekStart(today)}`);
  const nextMonday = addDays(weekStart(today), 7);
  const past = state.battles.filter((b) => b.id !== enemy?.id && b.id !== boss?.id).reverse();
  const wins = state.battles.filter((b) => b.defeatedOn);

  return (
    <section className="arena">
      <div className="section-head">
        <h1>Arena</h1>
        <span className="count">{wins.length === 1 ? "1 Sieg" : `${wins.length} Siege`}</span>
      </div>

      {enemy && <BattleCard battle={enemy} game={game} today={today} />}

      <h2>Wochen-Boss</h2>
      {boss ? (
        <BattleCard battle={boss} game={game} today={today} />
      ) : (
        <p className="boss-wait">
          <span className="boss-wait-icon" aria-hidden>
            ❔
          </span>
          <span>
            Der nächste Boss taucht am {formatDate(nextMonday, { weekday: 'long', day: 'numeric', month: 'long' })} auf. Er bleibt die ganze Woche und hat drei Phasen.
          </span>
        </p>
      )}

      {past.length > 0 && (
        <>
          <h2>Frühere Kämpfe</h2>
          <ul className="past-battles">
            {past.slice(0, 12).map((b) => {
              const status = battleStatus(b, today);
              return (
                <li key={b.id} className={status}>
                  <span aria-hidden>{b.icon}</span>
                  <span className="pb-name">
                    {b.name}
                    {b.boss && <span className="tag boss">Boss</span>}
                  </span>
                  <span className="pb-state">{status === 'defeated' ? `Besiegt, +${b.xp} XP` : 'Entkommen'}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function BattleCard({ battle: b, game, today }: { battle: Battle; game: Game; today: string }) {
  const health = game.state.health.connected ? game.state.health.days : null;
  const status = battleStatus(b, today);
  const hp = hpLeft(b, health);
  const [shake, setShake] = useState(0);
  const [hitText, setHitText] = useState<string | null>(null);

  const attack = (phase: BattlePhase, amount: number) => {
    game.hit(b.id, phase.id, amount);
    setShake((n) => n + 1);
    setHitText(`−${amount.toLocaleString('de-DE')}`);
    navigator.vibrate?.(40);
  };

  const daysLeft = daysBetween(today, b.end);
  const deadline = b.boss
    ? daysLeft === 0
      ? 'Letzter Tag!'
      : `Noch ${daysLeft + 1} Tage, bis ${formatDate(b.end, { weekday: 'long' })}`
    : 'Nur heute';

  return (
    <article className={`battle attr-${b.attr} ${b.boss ? 'is-boss' : ''} ${status}`} aria-label={b.name}>
      <header className="battle-head">
        <div key={shake} className={`enemy-portrait ${shake ? 'hit' : ''}`} aria-hidden>
          <span>{b.icon}</span>
          {hitText && shake > 0 && (
            <span key={shake} className="dmg display">
              {hitText}
            </span>
          )}
        </div>
        <div className="enemy-info">
          <div className="enemy-tags">
            {b.boss && <span className="tag boss">Boss</span>}
            {b.elite && <span className="tag elite">Elite</span>}
            <span className="tag">{ATTR_LABEL[b.attr]}</span>
          </div>
          <h3 className="enemy-name">{b.name}</h3>
          <p className="taunt">„{b.taunt}“</p>
        </div>
      </header>

      <div className="hp" role="progressbar" aria-label="Lebenspunkte des Gegners" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hp * 100)}>
        <div className="hp-fill" style={{ width: `${hp * 100}%` }} />
      </div>
      <div className="hp-meta">
        <span>{Math.round(hp * 100)} % Lebenspunkte</span>
        <span>{status === 'active' ? deadline : ''}</span>
      </div>

      {status === 'defeated' && (
        <p className="victory">
          <span className="display">Besiegt</span>
          <span>
            +{b.xp} XP und +{b.boss ? BOSS_ATTR_POINTS : ENEMY_ATTR_POINTS} {ATTR_LABEL[b.attr]}
          </span>
        </p>
      )}
      {status === 'escaped' && <p className="escaped-note">Entkommen. Morgen wartet ein neuer Gegner.</p>}

      <ul className="phases">
        {b.phases.map((p) => (
          <PhaseRow
            key={p.id}
            phase={p}
            progress={phaseProgress(b, p, health)}
            fromHealth={!!health && p.kind !== 'exercise'}
            canAct={status === 'active'}
            hasToday={p.log.some((l) => l.date === today)}
            onAttack={(n) => attack(p, n)}
            onUndo={() => game.undoHit(b.id, p.id)}
          />
        ))}
      </ul>

      {status === 'active' && (
        <p className="small-text battle-hint">
          {b.phases.length > 1 ? 'Bring alle Balken auf voll. ' : ''}
          Trag ein, was du gemacht hast. Jede Wiederholung ist ein Treffer. Sieg bringt {b.xp} XP.
        </p>
      )}
    </article>
  );
}

function PhaseRow(props: {
  phase: BattlePhase;
  progress: number;
  fromHealth: boolean;
  canAct: boolean;
  hasToday: boolean;
  onAttack: (n: number) => void;
  onUndo: () => void;
}) {
  const { phase: p, progress, fromHealth, canAct, hasToday, onAttack, onUndo } = props;
  const done = progress >= p.target;
  const rest = Number(Math.max(p.target - progress, 0).toFixed(1));
  const fmt = (n: number) => n.toLocaleString('de-DE');

  return (
    <li className={`phase ${done ? 'done' : ''}`}>
      <div className="phase-top">
        <span className="phase-icon" aria-hidden>
          {p.icon}
        </span>
        <span className="phase-title">{p.title}</span>
        <span className="phase-count">
          <strong>{fmt(Math.min(progress, p.target))}</strong> / {fmt(p.target)} {p.unit}
        </span>
      </div>
      <div className="phase-bar">
        <span style={{ width: `${Math.min(progress / p.target, 1) * 100}%` }} />
      </div>

      {fromHealth && !done && <p className="small-text">Wird automatisch aus Samsung Health übernommen.</p>}

      {canAct && !done && !fromHealth && (
        <div className="attacks">
          {quickAmounts(p.unit)
            .filter((n) => n < rest)
            .map((n) => (
              <button key={n} className="attack" onClick={() => onAttack(n)}>
                +{fmt(n)}
              </button>
            ))}
          <button className="attack finish" onClick={() => onAttack(rest)}>
            Rest: {fmt(rest)}
          </button>
        </div>
      )}
      {canAct && hasToday && !fromHealth && (
        <button className="link-button undo" onClick={onUndo}>
          Letzten Eintrag zurücknehmen
        </button>
      )}
    </li>
  );
}
