import { useMemo, useState } from 'react';
import {
  ATTR_LABEL,
  addDays,
  attributes,
  bestStreak,
  dailySeries,
  exerciseTotals,
  formatDate,
  isCleared,
  questsDone,
  summarizeSeason,
  type Attr,
  type GameState,
} from '../game';

const ATTR_ORDER: Attr[] = ['staerke', 'ausdauer', 'beweglichkeit', 'disziplin'];
const CHART_DAYS = 14;

export function StatsView({ state, today, xp }: { state: GameState; today: string; xp: number }) {
  const attrs = attributes(state);
  const maxAttr = Math.max(10, ...Object.values(attrs));
  const last28 = useMemo(() => Array.from({ length: 28 }, (_, i) => addDays(today, i - 27)), [today]);
  const exercises = exerciseTotals(state);

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

      <History state={state} today={today} />

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
              title={formatDate(d)}
              aria-label={`${formatDate(d)}: ${cls === 'full' ? 'alle Quests' : cls === 'part' ? 'teilweise' : 'nichts'}`}
            />
          );
        })}
      </div>
      <p className="legend">
        <span className="cal full" /> alle Quests <span className="cal part" /> teilweise <span className="cal none" /> nichts
      </p>

      <h2>Alle Übungen</h2>
      {exercises.length === 0 ? (
        <p className="small-text">Noch keine Quest erledigt. Deine Summen pro Übung erscheinen hier.</p>
      ) : (
        <table className="exercise-table">
          <thead>
            <tr>
              <th scope="col">Übung</th>
              <th scope="col">Mal</th>
              <th scope="col">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {exercises.map((e) => (
              <tr key={e.templateId} className={`attr-${e.attr}`}>
                <th scope="row">
                  {e.title}
                </th>
                <td>{e.count}</td>
                <td>
                  {e.total.toLocaleString('de-DE')} <span className="unit">{e.unit}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {state.seasons.length > 0 && (
        <>
          <h2>Vergangene Saisons</h2>
          <ul className="seasons">
            {[...state.seasons].reverse().map((r) => {
              const s = summarizeSeason(state, r.startDate, r.length);
              return (
                <li key={r.startDate}>
                  <strong>
                    {formatDate(s.startDate)} bis {formatDate(s.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </strong>
                  <span>
                    {s.daysCleared} von {s.length} Tagen geschafft, {s.questsDone} Quests, {s.xp.toLocaleString('de-DE')} XP, längste Serie {s.bestStreak}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/** Bar chart of the last 14 days: XP, or the amount of one exercise. */
function History({ state, today }: { state: GameState; today: string }) {
  const dates = useMemo(() => Array.from({ length: CHART_DAYS }, (_, i) => addDays(today, i - (CHART_DAYS - 1))), [today]);
  const exercises = exerciseTotals(state);
  const [metric, setMetric] = useState<string>('xp');
  const [selected, setSelected] = useState<number | null>(null);

  const ex = exercises.find((e) => e.templateId === metric);
  const activeMetric = ex ? metric : 'xp';
  const values = dailySeries(state, dates, activeMetric);
  const unit = ex ? ex.unit : 'XP';
  const max = Math.max(...values, 1);
  const sum = values.reduce((a, b) => a + b, 0);
  const color = ex ? `var(--${ex.attr})` : 'var(--signal)';

  // Geometry in viewBox units.
  const W = 320;
  const H = 140;
  const gap = 4;
  const bw = (W - gap * (CHART_DAYS - 1)) / CHART_DAYS;
  const fmt = (n: number) => Number(n.toFixed(1)).toLocaleString('de-DE');

  const shown = selected ?? values.length - 1;

  return (
    <div className="history">
      <h2>Verlauf, letzte 2 Wochen</h2>
      <div className="chips" role="group" aria-label="Was soll das Diagramm zeigen?">
        <button aria-pressed={activeMetric === 'xp'} onClick={() => setMetric('xp')}>
          XP
        </button>
        {exercises.map((e) => (
          <button key={e.templateId} aria-pressed={activeMetric === e.templateId} onClick={() => setMetric(e.templateId)}>
            <span className={`chip-dot attr-${e.attr}`} aria-hidden />
            {e.title}
          </button>
        ))}
      </div>

      <p className="chart-readout" aria-live="polite">
        <span className="display">{fmt(values[shown])}</span> {unit} am {formatDate(dates[shown], { weekday: 'short', day: 'numeric', month: 'short' })}
        <span className="chart-sum">
          Summe 14 Tage: {fmt(sum)} {unit}
        </span>
      </p>

      <svg className="chart" viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`${unit} pro Tag, letzte 14 Tage. Summe ${fmt(sum)} ${unit}.`}>
        <line x1={0} x2={W} y1={H + 0.5} y2={H + 0.5} className="chart-base" />
        {values.map((v, i) => {
          const x = i * (bw + gap);
          const h = v > 0 ? Math.max(4, (v / max) * (H - 6)) : 2;
          const y = H - h;
          const r = Math.min(4, h / 2, bw / 2);
          const d =
            v > 0
              ? `M${x},${H} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${H} Z`
              : `M${x},${H} V${y} H${x + bw} V${H} Z`;
          return (
            <g key={dates[i]}>
              <path d={d} fill={v > 0 ? color : 'var(--line)'} opacity={selected === null || selected === i ? 1 : 0.45} />
              {/* Hit target taller and wider than the bar */}
              <rect
                x={x - gap / 2}
                y={0}
                width={bw + gap}
                height={H + 18}
                fill="transparent"
                onClick={() => setSelected(selected === i ? null : i)}
              />
            </g>
          );
        })}
        {[0, 7, CHART_DAYS - 1].map((i) => (
          <text key={i} x={i * (bw + gap) + bw / 2} y={H + 14} className="chart-label" textAnchor="middle">
            {i === CHART_DAYS - 1 ? 'Heute' : formatDate(dates[i])}
          </text>
        ))}
      </svg>
      <p className="small-text">Tippe auf einen Balken, um den Wert des Tages zu sehen.</p>
    </div>
  );
}
