import { useState } from 'react';
import {
  QUEST_POOL,
  READ_QUEST,
  goalSteps,
  isCoreQuest,
  lockInfo,
  stateLevel,
  stateMastery,
  unavailableReason,
  type QuestTemplate,
} from '../game';
import type { Game } from '../store';
import { MASTERY_TIERS, PREREQUISITES, SKILL_PATHS, masteryOf, pointsForTier, type MasteryPoints } from '../mastery';
import { hasExerciseAnim } from '../anim/exercises';
import { Badge3D, Icon } from './Icons';
import { ExerciseGuide } from './ExerciseGuide';
import { MasteryLine, fmtPoints, isLocked, lockText, titleOf } from './masteryUi';

const PATH_IDS = new Set(SKILL_PATHS.flatMap((p) => p.ids));
const templateOf = (id: string) => QUEST_POOL.find((t) => t.id === id);

/** Meisterschaft: training goal, the skill paths step by step, and the free exercises. */
export function MasteryView({ game }: { game: Game }) {
  const { state } = game;
  const profile = state.profile;
  const points = stateMastery(state);
  const level = stateLevel(state);
  const goal = profile?.trainingGoal ?? null;
  const [guide, setGuide] = useState<string | null>(null);
  const guideLock = guide ? lockInfo(points, level, guide) : null;

  const free = QUEST_POOL.filter(
    (q) => !q.retired && !q.fixed && q.id !== READ_QUEST && q.id !== 'steps' && !PATH_IDS.has(q.id) && !unavailableReason(q, profile),
  );

  const nodeProps = { game, points, level, goal, onGuide: setGuide };

  return (
    <div className="mastery">
      <GoalCard game={game} points={points} level={level} />

      {SKILL_PATHS.map((p) => {
        const off = unavailableReason(templateOf(p.ids[0]) as QuestTemplate, profile);
        return (
          <section key={p.id} className="group-section">
            <h2 className="group-label">{p.title}</h2>
            <p className="group-caption">{off ? `${off}. Bis dahin kommen diese Übungen nicht.` : p.line}</p>
            <ol className={`group path ${off ? 'off' : ''}`}>
              {p.ids.map((id, i) => {
                const next = p.ids[i + 1];
                const nextOpen = next ? !isLocked(lockInfo(points, level, next)) : false;
                // a line to the next step only where it builds on this path (Beine holds two chains)
                const linked = !!next && (PREREQUISITES[next] ?? []).some((r) => p.ids.includes(r.id));
                return <PathNode key={id} id={id} lit={nextOpen} linked={linked} groupOff={!!off} {...nodeProps} />;
              })}
            </ol>
          </section>
        );
      })}

      {free.length > 0 && (
        <section className="group-section">
          <h2 className="group-label">Frei</h2>
          <p className="group-caption">Ohne Vorstufe. Auch hier steigt deine Stufe mit jeder erledigten Quest.</p>
          <ul className="group path free">
            {free.map((q) => (
              <PathNode key={q.id} id={q.id} lit={false} {...nodeProps} />
            ))}
          </ul>
        </section>
      )}

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
    </div>
  );
}

function PathNode(props: {
  id: string;
  lit: boolean;
  linked?: boolean;
  /** the whole path is out (no gear for it): the reason shows once above the path */
  groupOff?: boolean;
  game: Game;
  points: MasteryPoints;
  level: number;
  goal: string | null;
  onGuide: (id: string) => void;
}) {
  const { id, game, points, level, goal } = props;
  const t = templateOf(id) as QuestTemplate;
  const lock = lockInfo(points, level, id);
  const locked = isLocked(lock);
  const reason = unavailableReason(t, game.state.profile);
  const tier = masteryOf(points, id).tier;
  const isGoal = goal === id;
  const core = isCoreQuest(id);
  const body = (
    <>
      <strong className="node-title">
        {t.title}
        {core && <span className="tag">Pflicht</span>}
      </strong>
      {locked ? (
        <span className="needs">{lockText(points, lock)}</span>
      ) : (
        <MasteryLine points={points} id={id} />
      )}
      {reason && !props.groupOff && <span className="needs">{reason}</span>}
    </>
  );
  return (
    <li className={`node ${locked ? 'locked' : 'open'} ${props.lit ? 'lit' : ''} ${props.linked ? 'linked' : ''} ${isGoal ? 'goal' : ''} ${reason ? 'off' : ''}`}>
      <span className={`node-mark tier-${tier}`} aria-hidden>
        {locked ? <Icon name="lock" size={16} /> : tier > 0 ? <span className="display">{tier}</span> : null}
      </span>
      {hasExerciseAnim(id) ? (
        <button type="button" className="node-text" onClick={() => props.onGuide(id)} aria-label={`${t.title}: Anleitung und Stufe ansehen`}>
          {body}
        </button>
      ) : (
        <span className="node-text">{body}</span>
      )}
      {locked && !reason ? (
        <button
          type="button"
          className={`goal-button ${isGoal ? 'on' : ''}`}
          aria-pressed={isGoal}
          aria-label={isGoal ? `${t.title} ist dein Ziel, tippen zum Entfernen` : `${t.title} als Trainingsziel setzen`}
          onClick={() => game.setTrainingGoal(isGoal ? null : id)}
        >
          {isGoal ? 'Ziel' : 'Als Ziel'}
        </button>
      ) : hasExerciseAnim(id) ? (
        <Icon name="chevronRight" size={18} className="node-chevron" />
      ) : (
        <span />
      )}
    </li>
  );
}

/** The training goal with what is still missing, or how mastery works when there is none. */
function GoalCard({ game, points, level }: { game: Game; points: MasteryPoints; level: number }) {
  const goal = game.state.profile?.trainingGoal;
  if (!goal) {
    return (
      <section className="mastery-intro group">
        <p>
          Jede erledigte Quest bringt der Übung einen Punkt, die leichtere Variante einen halben. Schwere Übungen öffnen sich, wenn du die
          Vorstufen gemeistert und das Level erreicht hast.
        </p>
        <ol className="tier-steps" aria-label="Stufen">
          {MASTERY_TIERS.map((need, i) => (
            <li key={need}>
              <span className={`node-mark tier-${i + 1}`}>
                <span className="display">{i + 1}</span>
              </span>
              <span>
                <strong>Stufe {i + 1}</strong>
                <small>ab {need} Punkten</small>
              </span>
            </li>
          ))}
        </ol>
        <p className="small-text">Tippe bei einer gesperrten Übung auf „Als Ziel“. Dann bringen die Extras gezielt, was dafür fehlt.</p>
      </section>
    );
  }
  const lock = lockInfo(points, level, goal);
  const steps = goalSteps(game.state).map((t) => t.title);
  return (
    <section className="goal-card group">
      <div className="goal-card-head">
        <Badge3D icon="star" tone="gold" size={40} />
        <span className="goal-card-name">
          <span className="eyebrow">Trainingsziel</span>
          <strong>{titleOf(goal)}</strong>
        </span>
        <button type="button" className="link-button" onClick={() => game.setTrainingGoal(null)}>
          Entfernen
        </button>
      </div>
      {!isLocked(lock) ? (
        <p className="goal-status">Geschafft. Die Übung ist freigeschaltet und kommt in den Extras.</p>
      ) : (
        <>
          {lock.unmet.length > 0 && (
            <ul className="goal-reqs">
              {lock.unmet.map((r) => {
                const need = pointsForTier(r.tier);
                const have = Math.min(points[r.id] ?? 0, need);
                return (
                  <li key={r.id}>
                    <span className="goal-req-top">
                      <span>
                        {titleOf(r.id)} <span className="goal-req-tier">Stufe {r.tier}</span>
                      </span>
                      <span className="mastery-count">
                        {fmtPoints(have)}/{need}
                      </span>
                    </span>
                    <span className="goal-bar" aria-hidden>
                      <span style={{ width: `${Math.round((have / need) * 100)}%` }} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {lock.level !== null && (
            <p className="goal-status">
              {lock.unmet.length === 0 ? 'Die Vorstufen hast du gemeistert. Es fehlt nur noch ' : 'Außerdem ab '}
              Level {lock.level} (du bist Level {level}).
            </p>
          )}
          {lock.unmet.length > 0 && (
            <p className="goal-status">
              {steps.length > 0
                ? `Ab morgen in den Extras: ${steps.join(', ')}.`
                : 'Was fehlt, sind Pflicht-Quests oder Übungen, die selbst noch gesperrt sind. Bleib bei der Pflicht dran.'}
            </p>
          )}
        </>
      )}
    </section>
  );
}
