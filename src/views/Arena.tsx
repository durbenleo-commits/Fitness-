// The arena as an RPG battle: pick an opponent, it stands on a stage with its
// health bar and a taunt, and the exercises are the attack menu below.
import { useState } from 'react';
import {
  ENEMIES_PER_DAY,
  battleStatus,
  currentEnemy,
  enemiesOf,
  hpLeft,
  phaseProgress,
  quickAmounts,
  weekStart,
  type Battle,
  type BattlePhase,
} from '../battle';
import { ATTR_LABEL, BOSS_ATTR_POINTS, ENEMY_ATTR_POINTS, QUEST_POOL, addDays, daysBetween, formatDate, type QuestAttr } from '../game';
import { isScannable } from '../pose';
import type { Game } from '../store';
import { AttrTile, Icon } from './Icons';
import { Scanner } from './Scanner';
import { Sprite } from './Sprites';

const phaseAttr = (p: BattlePhase): QuestAttr =>
  p.kind === 'exercise' ? (QUEST_POOL.find((q) => q.id === p.exerciseId)?.attr ?? 'staerke') : 'ausdauer';

const HP_PER_PHASE = 100;

export function ArenaView({ game, today }: { game: Game; today: string }) {
  const { state } = game;
  const enemy = currentEnemy(state.battles, today);
  const wave = enemy ? enemiesOf(state.battles, today).indexOf(enemy) + 1 : 0;
  const boss = state.battles.find((b) => b.id === `boss-${weekStart(today)}`);
  const nextMonday = addDays(weekStart(today), 7);
  const [pick, setPick] = useState<'enemy' | 'boss'>(enemy && !enemy.defeatedOn ? 'enemy' : boss ? 'boss' : 'enemy');
  const selected = pick === 'boss' && boss ? boss : enemy;
  const past = state.battles.filter((b) => b.id !== enemy?.id && b.id !== boss?.id).reverse();
  const wins = state.battles.filter((b) => b.defeatedOn).length;

  return (
    <section className="arena">
      <div className="section-head">
        <h1>Arena</h1>
        <span className="count">{wins === 1 ? '1 Sieg' : `${wins} Siege`}</span>
      </div>

      <div className="foe-picker" role="tablist" aria-label="Gegner wählen">
        {enemy && (
          <button role="tab" aria-selected={selected === enemy} onClick={() => setPick('enemy')} className={enemy.defeatedOn ? 'won' : ''}>
            <Sprite enemyId={enemy.enemyId} className="foe-mini" />
            <span>
              <strong>Gegner {wave}/{ENEMIES_PER_DAY}</strong>
              <small>{enemy.defeatedOn ? 'Besiegt' : 'Nur heute'}</small>
            </span>
          </button>
        )}
        {boss ? (
          <button role="tab" aria-selected={selected === boss} onClick={() => setPick('boss')} className={`boss ${boss.defeatedOn ? 'won' : ''}`}>
            <Sprite enemyId={boss.enemyId} className="foe-mini" />
            <span>
              <strong>Wochen-Boss</strong>
              <small>{boss.defeatedOn ? 'Besiegt' : `bis ${formatDate(boss.end, { weekday: 'short' })}`}</small>
            </span>
          </button>
        ) : (
          <div className="foe-locked">
            <span className="display">?</span>
            <span>
              <strong>Wochen-Boss</strong>
              <small>ab {formatDate(nextMonday, { weekday: 'short', day: 'numeric', month: 'short' })}</small>
            </span>
          </div>
        )}
      </div>

      {selected && <BattleView key={selected.id} battle={selected} game={game} today={today} />}

      {past.length > 0 && (
        <>
          <h2>Frühere Kämpfe</h2>
          <ul className="past-battles">
            {past.slice(0, 12).map((b) => {
              const status = battleStatus(b, today);
              return (
                <li key={b.id} className={status}>
                  <Sprite enemyId={b.enemyId} className="pb-monster" />
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

function BattleView({ battle: b, game, today }: { battle: Battle; game: Game; today: string }) {
  const health = game.state.health.connected ? game.state.health.days : null;
  const status = battleStatus(b, today);
  const maxHp = b.phases.length * HP_PER_PHASE;
  const hp = Math.round(hpLeft(b, health) * maxHp);
  const [hit, setHit] = useState(0);
  const [hitText, setHitText] = useState('');
  const [scanPhase, setScanPhase] = useState<BattlePhase | null>(null);

  const attack = (phase: BattlePhase, amount: number) => {
    const before = phaseProgress(b, phase, health);
    const dealt = Math.round((Math.min(before + amount, phase.target) - Math.min(before, phase.target)) / phase.target * HP_PER_PHASE);
    game.hit(b.id, phase.id, amount);
    setHit((n) => n + 1);
    setHitText(`−${Math.max(dealt, 1)}`);
    navigator.vibrate?.(40);
  };

  const daysLeft = daysBetween(today, b.end);
  const deadline = b.boss ? (daysLeft === 0 ? 'Letzter Tag!' : `Noch ${daysLeft + 1} Tage`) : 'Nur heute';
  const firstOpen = b.phases.find((p) => phaseProgress(b, p, health) < p.target)?.id;

  return (
    <div className={`battle-wrap attr-${b.attr}`}>
      <div className={`scene ${b.boss ? 'boss' : ''} ${status}`} aria-label={`${b.name}, ${hp} von ${maxHp} Lebenspunkten`}>
        <span className="torch left" aria-hidden />
        <span className="torch right" aria-hidden />
        <span className="scene-floor" aria-hidden />

        <div className="nameplate">
          <div className="np-top">
            <strong>{b.name}</strong>
            {b.boss && <span className="tag boss">Boss</span>}
            {b.elite && <span className="tag elite">Elite</span>}
          </div>
          <div className="np-hp">
            <span className="np-label">HP</span>
            <span className="hp" role="progressbar" aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}>
              <span className="hp-fill" style={{ width: `${(hp / maxHp) * 100}%` }} />
            </span>
          </div>
          <span className="np-num">
            {hp} / {maxHp}
          </span>
        </div>

        {status === 'active' && <p className="bubble">„{b.taunt}“</p>}

        <div key={hit} className={`sprite-wrap ${hit ? 'hit' : ''}`}>
          <Sprite enemyId={b.enemyId} className="scene-sprite" />
          {hit > 0 && (
            <>
              <span className="slash" aria-hidden />
              <span className="dmg display" aria-hidden>
                {hitText}
              </span>
            </>
          )}
        </div>

        <span className="scene-chip">{status === 'active' ? deadline : status === 'defeated' ? 'Besiegt' : 'Entkommen'}</span>

        {status === 'defeated' && (
          <div className="scene-banner">
            <span className="display">Sieg</span>
            <span>
              +{b.xp} XP · +{b.boss ? BOSS_ATTR_POINTS : ENEMY_ATTR_POINTS} {ATTR_LABEL[b.attr]}
            </span>
          </div>
        )}
        {status === 'escaped' && (
          <div className="scene-banner lost">
            <span className="display">Entkommen</span>
            <span>Morgen wartet ein neuer Gegner.</span>
          </div>
        )}
      </div>

      {status === 'active' && (
        <div className="command-box">
          <div className="cmd-head">
            <span>Angriffe</span>
            <span className="cmd-reward">Sieg: +{b.xp} XP</span>
          </div>
          <ul className="moves">
            {b.phases.map((p) => (
              <Move
                key={p.id}
                phase={p}
                active={p.id === firstOpen}
                progress={phaseProgress(b, p, health)}
                fromHealth={!!health && p.kind !== 'exercise'}
                hasToday={p.log.some((l) => l.date === today)}
                cameraOnly={!!game.state.profile?.cameraRequired}
                onAttack={(n) => attack(p, n)}
                onCamera={() => setScanPhase(p)}
                onUndo={() => game.undoHit(b.id, p.id)}
              />
            ))}
          </ul>
          <p className="cmd-hint">Trag ein, was du gemacht hast. Jede Wiederholung trifft.</p>
        </div>
      )}

      {scanPhase && (
        <Scanner
          exerciseId={scanPhase.exerciseId!}
          title={`${scanPhase.title} gegen ${b.name}`}
          target={Math.max(1, Math.ceil(scanPhase.target - phaseProgress(b, scanPhase, health)))}
          unit={scanPhase.unit}
          allowManual={false}
          onDone={(n) => {
            if (n > 0) attack(scanPhase, n);
            setScanPhase(null);
          }}
          onClose={() => setScanPhase(null)}
        />
      )}
    </div>
  );
}

function Move(props: {
  phase: BattlePhase;
  active: boolean;
  progress: number;
  fromHealth: boolean;
  hasToday: boolean;
  cameraOnly: boolean;
  onAttack: (n: number) => void;
  onCamera: () => void;
  onUndo: () => void;
}) {
  const { phase: p, active, progress, fromHealth, hasToday, cameraOnly, onAttack, onCamera, onUndo } = props;
  const scannable = p.kind === 'exercise' && isScannable(p.exerciseId);
  const manual = !(scannable && cameraOnly);
  const done = progress >= p.target;
  const rest = Number(Math.max(p.target - progress, 0).toFixed(1));
  const fmt = (n: number) => n.toLocaleString('de-DE');

  return (
    <li className={`move attr-${phaseAttr(p)} ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
      <div className="move-top">
        <span className="cursor" aria-hidden>
          ▸
        </span>
        <AttrTile attr={phaseAttr(p)} size="sm" />
        <span className="move-name">{p.title}</span>
        <span className="move-count">
          {done ? (
            <Icon name="check" size={18} />
          ) : (
            <>
              noch <strong>{fmt(rest)}</strong> {p.unit}
            </>
          )}
        </span>
      </div>
      <div className="phase-bar">
        <span style={{ width: `${Math.min(progress / p.target, 1) * 100}%` }} />
      </div>
      {fromHealth && !done && <p className="move-note">Kommt automatisch aus Samsung Health.</p>}
      {!done && !fromHealth && (
        <div className="attacks">
          {scannable && (
            <button className="attack camera" onClick={onCamera}>
              <Icon name="camera" size={18} />
              Kamera
            </button>
          )}
          {manual &&
            quickAmounts(p.unit)
              .filter((n) => n < rest)
              .slice(0, scannable ? 2 : 3)
              .map((n) => (
                <button key={n} className="attack" onClick={() => onAttack(n)}>
                  +{fmt(n)}
                </button>
              ))}
          {manual && (
            <button className="attack finish" onClick={() => onAttack(rest)}>
              Alle {fmt(rest)}
            </button>
          )}
        </div>
      )}
      {hasToday && !fromHealth && (
        <button className="link-button undo" onClick={onUndo}>
          Letzten Treffer zurücknehmen
        </button>
      )}
    </li>
  );
}
