import type { AchievementStatus } from '../achievements';
import {
  QUEST_POOL,
  READ_QUEST,
  attributes,
  GATED_EXERCISES,
  exerciseOpen,
  isCoreQuest,
  levelFromXp,
  playerClass,
  readingOn,
  stateLevel,
  stateMastery,
  unavailableReason,
} from '../game';
import { SKILL_PATHS, masteryOf } from '../mastery';
import { bookProgress, currentBook, finishedBooks } from '../reading';
import type { Game } from '../store';
import { Badge3D, Icon, type IconName, type Tone } from './Icons';
import { titleOf } from './masteryUi';

export type Screen = 'meisterschaft' | 'erfolge' | 'werte' | 'uebungen' | 'lesen' | 'einstellungen';

export const SCREEN_TITLE: Record<Screen, string> = {
  meisterschaft: 'Meisterschaft',
  erfolge: 'Erfolge',
  werte: 'Werte',
  uebungen: 'Quests & Übungen',
  lesen: 'Lesen',
  einstellungen: 'Einstellungen',
};

interface Row {
  id: Screen;
  icon: IconName;
  tone: Tone;
  sub: string;
}

/** The menu tab: every screen that is not Heute or Arena, as grouped rows with a live summary. */
export function HubView(props: { game: Game; xp: number; achievements: AchievementStatus[]; onOpen: (s: Screen) => void }) {
  const { state } = props.game;
  const profile = state.profile;

  // Meisterschaft
  const points = stateMastery(state);
  const level = stateLevel(state);
  const gated = GATED_EXERCISES.filter((id) => {
    const t = QUEST_POOL.find((q) => q.id === id);
    return t && !unavailableReason(t, profile);
  });
  const open = gated.filter((id) => exerciseOpen(points, level, id)).length;
  const pathIds = SKILL_PATHS.flatMap((p) => p.ids);
  const topTier = Math.max(0, ...pathIds.map((id) => masteryOf(points, id).tier));
  const atTop = pathIds.filter((id) => topTier > 0 && masteryOf(points, id).tier === topTier).length;
  const goal = profile?.trainingGoal;
  const mastery = [
    topTier > 0 ? `${atTop} ${atTop === 1 ? 'Übung' : 'Übungen'} auf Stufe ${topTier}` : `${open} von ${gated.length} frei`,
    goal ? `Ziel: ${titleOf(goal)}` : topTier > 0 ? `${open} von ${gated.length} frei` : 'Noch keine Stufe',
  ].join(' · ');

  // Erfolge
  const got = props.achievements.filter((a) => a.unlocked);
  const gold = got.filter((a) => a.achievement.tier === 'gold').length;
  const ach = `${got.length} von ${props.achievements.length} freigeschaltet${gold > 0 ? ` · ${gold} Gold` : ''}`;

  // Werte
  const cls = playerClass(attributes(state));
  const werte = `${cls.name} · Level ${levelFromXp(props.xp).level}`;

  // Übungen
  const extras = QUEST_POOL.filter((q) => !q.retired && !q.fixed && !isCoreQuest(q.id) && q.id !== READ_QUEST && !unavailableReason(q, profile));
  const onCount = extras.filter((q) => exerciseOpen(points, level, q.id) && !state.disabledQuests.includes(q.id)).length;
  const custom = state.customQuests.length;
  const uebungen = `${onCount} in den Extras${custom > 0 ? ` · ${custom} eigene` : ''}`;

  // Lesen
  const book = currentBook(state);
  const done = finishedBooks(state).length;
  const reading = readingOn(profile) || book !== undefined || done > 0;
  const p = book ? bookProgress(book) : null;
  const lesen = book
    ? `${book.title} · ${p?.percent !== undefined ? `${p.percent} %` : `Seite ${p?.page ?? 0}`}`
    : done > 0
      ? `${done} ${done === 1 ? 'Buch' : 'Bücher'} gelesen · kein neues angefangen`
      : 'Noch kein Buch angefangen';

  const groups: { label: string; rows: Row[] }[] = [
    {
      label: 'Fortschritt',
      rows: [
        { id: 'meisterschaft', icon: 'path', tone: 'gold', sub: mastery },
        { id: 'erfolge', icon: 'medal', tone: 'bronze', sub: ach },
        { id: 'werte', icon: 'stats', tone: 'ausdauer', sub: werte },
      ],
    },
    {
      label: 'Training',
      rows: [
        { id: 'uebungen', icon: 'staerke', tone: 'staerke', sub: uebungen },
        ...(reading ? [{ id: 'lesen' as const, icon: 'book' as const, tone: 'intelligenz' as const, sub: lesen }] : []),
      ],
    },
    {
      label: 'App',
      rows: [{ id: 'einstellungen', icon: 'sliders', tone: 'neutral', sub: 'Profil, Ausrüstung, Samsung Health, Backup' }],
    },
  ];

  return (
    <section className="hub">
      <h1 className="large-title">Menü</h1>
      {groups.map((g) => (
        <div key={g.label} className="group-section">
          <h2 className="group-label">{g.label}</h2>
          <ul className="group">
            {g.rows.map((r) => (
              <li key={r.id}>
                <button type="button" className="group-row" onClick={() => props.onOpen(r.id)}>
                  <Badge3D icon={r.icon} tone={r.tone} size={36} />
                  <span className="group-row-text">
                    <strong>{SCREEN_TITLE[r.id]}</strong>
                    <span>{r.sub}</span>
                  </span>
                  <Icon name="chevronRight" size={18} className="group-row-chevron" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
