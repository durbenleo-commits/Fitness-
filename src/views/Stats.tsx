import { useMemo, useState } from 'react';
import {
  ATTR_LABEL,
  READ_QUEST,
  addDays,
  attributes,
  bestStreak,
  daysBetween,
  levelFromXp,
  playerClass,
  until,
  dailySeries,
  exerciseTotals,
  formatDate,
  isCleared,
  questsDone,
  requiredQuests,
  summarizeSeason,
  type Attr,
  type GameState,
} from '../game';
import type { Game } from '../store';
import { BookCard, ReadingSheet } from './Reading';
import { currentBook, finishedBooks, totalPagesRead, type Book } from '../reading';
import { Badge3D, Icon } from './Icons';
import { Segmented } from './ui';

const ATTR_ORDER: Attr[] = ['staerke', 'ausdauer', 'beweglichkeit', 'intelligenz', 'disziplin'];
const CHART_DAYS = 14;

// Reading is shown in the Bücher section with the pages really read, not as quest amounts.
const notReading = (e: { templateId: string }) => e.templateId !== READ_QUEST;

export function StatsView({ game, today, xp }: { game: Game; today: string; xp: number }) {
  const { state } = game;
  const attrs = attributes(state);
  const last28 = useMemo(() => Array.from({ length: 28 }, (_, i) => addDays(today, i - 27)), [today]);
  const exercises = exerciseTotals(state).filter(notReading);
  const [compare, setCompare] = useState<'week' | 'start'>('week');
  const start = state.profile?.startDate ?? today;
  const baseline = attributes(state, until(compare === 'week' ? addDays(today, -7) : start));
  const cls = playerClass(attrs);
  const lvl = levelFromXp(xp);
  const segments = 20;
  const filled = Math.round((lvl.intoLevel / lvl.needed) * segments);

  return (
    <section className="stats">
      <div className="class-card">
        <span className="class-label">Deine Klasse · Tag {Math.max(1, daysBetween(start, today) + 1)}</span>
        <span className="display class-name">{cls.name}</span>
        <p className="class-line">{cls.line}</p>
        <div className="class-stats">
          {ATTR_ORDER.map((a) => (
            <div key={a} className={`class-stat attr-${a}`}>
              <Badge3D icon={a} tone={a} size={30} />
              <span className="display">{attrs[a]}</span>
              <span className="class-stat-name">{ATTR_LABEL[a]}</span>
            </div>
          ))}
        </div>
      </div>

      <h2>Dein Rating</h2>
      <div className="rating">
        <div className="rating-top">
          <div className="rating-level">
            <span className="display">{lvl.level}</span>
            <span>Level</span>
          </div>
          <div className="rating-xp">
            <span className="display">{xp.toLocaleString('de-DE')}</span>
            <span>XP gesammelt</span>
          </div>
        </div>
        <div className="xp-segments" role="progressbar" aria-valuemin={0} aria-valuemax={lvl.needed} aria-valuenow={lvl.intoLevel} aria-label="Fortschritt zum nächsten Level">
          {Array.from({ length: segments }, (_, i) => (
            <span key={i} className={i < filled ? 'on' : ''} />
          ))}
        </div>
        <p className="rating-next">
          {(lvl.needed - lvl.intoLevel).toLocaleString('de-DE')} XP bis Level {lvl.level + 1}
        </p>
      </div>

      <div className="compare-head">
        <span>Veränderung</span>
        <Segmented
          options={[
            { value: 'week' as const, label: '7 Tage' },
            { value: 'start' as const, label: 'Seit Tag 1' },
          ]}
          value={compare}
          onChange={setCompare}
        />
      </div>
      <ul className="attr-rows">
        {ATTR_ORDER.map((a) => {
          const delta = attrs[a] - baseline[a];
          return (
            <li key={a} className={`attr-row attr-${a}`}>
              <Badge3D icon={a} tone={a} size={34} />
              <span className="attr-row-name">{ATTR_LABEL[a]}</span>
              <span className="display attr-row-val">{attrs[a]}</span>
              <span className={`attr-delta ${delta > 0 ? 'up' : ''}`}>{delta > 0 ? `▲ ${delta}` : '±0'}</span>
            </li>
          );
        })}
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

      <Books game={game} today={today} />

      <History state={state} today={today} />

      <h2>Letzte 4 Wochen</h2>
      <div className="calendar" role="list">
        {last28.map((d) => {
          const day = state.days[d];
          // only required quests count for the day; extras are optional
          const req = requiredQuests(day);
          const ratio = req.length > 0 ? req.filter((q) => q.done).length / req.length : 0;
          const cls = isCleared(day) ? 'full' : ratio > 0 ? 'part' : 'none';
          return (
            <span
              key={d}
              role="listitem"
              className={`cal ${cls} ${d === today ? 'today' : ''}`}
              title={formatDate(d)}
              aria-label={`${formatDate(d)}: ${cls === 'full' ? 'alle Pflicht-Quests' : cls === 'part' ? 'teilweise' : 'nichts'}`}
            />
          );
        })}
      </div>
      <p className="legend">
        <span className="cal full" /> alle Pflicht-Quests <span className="cal part" /> teilweise <span className="cal none" /> nichts
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
  const exercises = exerciseTotals(state).filter(notReading);
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

const pagesOf = (b: Book) => b.log.reduce((s, l) => s + (l.to - l.from), 0);

/** Reading log: the book on the nightstand, finished books, pages overall. */
function Books({ game, today }: { game: Game; today: string }) {
  const { state } = game;
  const [sheet, setSheet] = useState<'log' | 'new' | 'edit' | null>(null);
  const book = currentBook(state);
  const done = finishedBooks(state);
  const total = totalPagesRead(state);
  if (!book && done.length === 0) {
    return (
      <>
        <h2>Bücher</h2>
        <p className="small-text">Noch kein Buch angefangen. Trag dein Buch ein und halte danach fest, wie weit du gekommen bist.</p>
        <button className="secondary" onClick={() => setSheet('new')}>
          Buch anfangen
        </button>
        {sheet && <ReadingSheet game={game} today={today} startNew onClose={() => setSheet(null)} />}
      </>
    );
  }
  return (
    <>
      <div className="books-head">
        <h2>Bücher</h2>
        <span className="books-total">
          <span className="display">{total.toLocaleString('de-DE')}</span> Seiten gelesen
        </span>
      </div>
      {book && <BookCard book={book} big label="Liest gerade" sub={`seit ${formatDate(book.startedOn)}`} />}
      <div className="books-actions">
        {book && (
          <button className="primary" onClick={() => setSheet('log')}>
            Seiten eintragen
          </button>
        )}
        <button className="secondary" onClick={() => setSheet('new')}>
          Buch anfangen
        </button>
      </div>
      {book && (
        <button className="link-button books-edit" onClick={() => setSheet('edit')}>
          <Icon name="pencil" size={16} />
          Buch bearbeiten
        </button>
      )}
      {sheet && <ReadingSheet game={game} today={today} startNew={sheet === 'new'} startEdit={sheet === 'edit'} onClose={() => setSheet(null)} />}
      {done.length > 0 && (
        <ul className="book-list">
          {[...done].reverse().map((b) => (
            <li key={b.id}>
              {b.cover ? <img className="book-mini" src={b.cover} alt={`Cover von „${b.title}“`} /> : <Badge3D icon="book" tone="intelligenz" size={30} />}
              <span className="ql-text">
                <strong>{b.title}</strong>
                <span>
                  Fertig am {formatDate(b.finishedOn!, { day: 'numeric', month: 'short', year: 'numeric' })} · {pagesOf(b).toLocaleString('de-DE')} Seiten
                  gelesen
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
