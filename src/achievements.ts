import type { IconName } from './views/Icons';
import { defeated } from './battle';
import {
  attributes,
  bestStreak,
  daysAllDoubled,
  isCleared,
  levelFromXp,
  questsDone,
  questsDoubled,
  seasonOver,
  totalFor,
  totalXp,
  type GameState,
} from './game';
import { finishedBooks, totalPagesRead } from './reading';

export interface Achievement {
  id: string;
  icon: IconName;
  tier: 'bronze' | 'silver' | 'gold';
  title: string;
  description: string;
  target: number;
  progress: (c: Context) => number;
}

interface Context {
  state: GameState;
  today: string;
  quests: number;
  cleared: number;
  best: number;
  level: number;
  attrs: ReturnType<typeof attributes>;
  doubled: number; // quests done at 2×
  allOut: number; // days with every required quest at 2×
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-quest', icon: 'target', tier: 'bronze', title: 'Erster Schritt', description: 'Erledige deine erste Quest.', target: 1, progress: (c) => c.quests },
  { id: 'first-clear', icon: 'check', tier: 'bronze', title: 'Tag geschafft', description: 'Erledige an einem Tag alle Pflicht-Quests.', target: 1, progress: (c) => c.cleared },
  { id: 'streak-3', icon: 'flame', tier: 'bronze', title: 'Warm gelaufen', description: '3 Tage in Folge alle Pflicht-Quests.', target: 3, progress: (c) => c.best },
  { id: 'streak-7', icon: 'calendar', tier: 'silver', title: 'Eine Woche', description: '7 Tage in Folge alle Pflicht-Quests.', target: 7, progress: (c) => c.best },
  { id: 'streak-14', icon: 'chain', tier: 'silver', title: 'Nicht zu stoppen', description: '14 Tage in Folge alle Pflicht-Quests.', target: 14, progress: (c) => c.best },
  { id: 'streak-30', icon: 'trophy', tier: 'gold', title: 'Eiserner Wille', description: '30 Tage in Folge alle Pflicht-Quests.', target: 30, progress: (c) => c.best },
  { id: 'quests-50', icon: 'today', tier: 'bronze', title: 'Fleißig', description: 'Erledige 50 Quests.', target: 50, progress: (c) => c.quests },
  { id: 'quests-200', icon: 'mountain', tier: 'silver', title: 'Dauerbrenner', description: 'Erledige 200 Quests.', target: 200, progress: (c) => c.quests },
  { id: 'double-1', icon: 'star', tier: 'bronze', title: 'Doppelt hält besser', description: 'Schaff eine Quest doppelt.', target: 1, progress: (c) => c.doubled },
  { id: 'double-25', icon: 'bolt', tier: 'silver', title: 'Übererfüller', description: 'Schaff 25 Quests doppelt.', target: 25, progress: (c) => c.doubled },
  { id: 'double-day', icon: 'trophy', tier: 'gold', title: 'Alles gegeben', description: 'Schaff an einem Tag alle Pflicht-Quests doppelt.', target: 1, progress: (c) => c.allOut },
  { id: 'level-5', icon: 'arrowUp', tier: 'bronze', title: 'Aufsteiger', description: 'Erreiche Level 5.', target: 5, progress: (c) => c.level },
  { id: 'level-10', icon: 'medal', tier: 'silver', title: 'Kämpfer', description: 'Erreiche Level 10.', target: 10, progress: (c) => c.level },
  { id: 'level-20', icon: 'crown', tier: 'gold', title: 'Elite', description: 'Erreiche Level 20.', target: 20, progress: (c) => c.level },
  { id: 'strength-25', icon: 'staerke', tier: 'bronze', title: 'Kraftpaket', description: 'Erreiche 25 Punkte Stärke.', target: 25, progress: (c) => c.attrs.staerke },
  { id: 'endurance-25', icon: 'ausdauer', tier: 'bronze', title: 'Langer Atem', description: 'Erreiche 25 Punkte Ausdauer.', target: 25, progress: (c) => c.attrs.ausdauer },
  { id: 'flex-25', icon: 'beweglichkeit', tier: 'bronze', title: 'Gelenkig', description: 'Erreiche 25 Punkte Beweglichkeit.', target: 25, progress: (c) => c.attrs.beweglichkeit },
  { id: 'pushups-500', icon: 'bolt', tier: 'silver', title: '500 Liegestütze', description: 'Mach insgesamt 500 Liegestütze.', target: 500, progress: (c) => totalFor(c.state, 'pushups') },
  { id: 'run-50', icon: 'run', tier: 'silver', title: '50 Kilometer', description: 'Lauf insgesamt 50 km.', target: 50, progress: (c) => totalFor(c.state, 'run') },
  { id: 'custom', icon: 'pencil', tier: 'bronze', title: 'Eigener Weg', description: 'Lege eine eigene Quest an.', target: 1, progress: (c) => c.state.customQuests.length },
  { id: 'enemy-1', icon: 'arena', tier: 'bronze', title: 'Erster Sieg', description: 'Besiege deinen ersten Gegner.', target: 1, progress: (c) => defeated(c.state).filter((b) => !b.boss).length },
  { id: 'enemy-10', icon: 'skull', tier: 'silver', title: 'Monsterjäger', description: 'Besiege 10 Gegner.', target: 10, progress: (c) => defeated(c.state).filter((b) => !b.boss).length },
  { id: 'enemy-30', icon: 'shield', tier: 'gold', title: 'Arena-Held', description: 'Besiege 30 Gegner.', target: 30, progress: (c) => defeated(c.state).filter((b) => !b.boss).length },
  { id: 'boss-1', icon: 'horns', tier: 'silver', title: 'Bossbezwinger', description: 'Besiege einen Wochen-Boss.', target: 1, progress: (c) => defeated(c.state).filter((b) => b.boss).length },
  { id: 'boss-5', icon: 'crown', tier: 'gold', title: 'Schweinehund-Zähmer', description: 'Besiege 5 Wochen-Bosse.', target: 5, progress: (c) => defeated(c.state).filter((b) => b.boss).length },
  {
    id: 'steps-100k',
    icon: 'steps', tier: 'silver',
    title: '100.000 Schritte',
    description: 'Geh insgesamt 100.000 Schritte (aus Samsung Health oder Schritte-Quests).',
    target: 100000,
    progress: (c) => Math.max(Object.values(c.state.health.days).reduce((s, d) => s + d.steps, 0), totalFor(c.state, 'steps')),
  },
  { id: 'book-1', icon: 'book', tier: 'bronze', title: 'Bücherwurm', description: 'Lies dein erstes Buch zu Ende.', target: 1, progress: (c) => finishedBooks(c.state).length },
  { id: 'book-5', icon: 'book', tier: 'silver', title: 'Bibliothek', description: 'Lies 5 Bücher zu Ende.', target: 5, progress: (c) => finishedBooks(c.state).length },
  { id: 'pages-500', icon: 'book', tier: 'silver', title: 'Seitenfresser', description: 'Lies insgesamt 500 Seiten.', target: 500, progress: (c) => totalPagesRead(c.state) },
  {
    id: 'season',
    icon: 'flag', tier: 'gold',
    title: 'Saison beendet',
    description: 'Bring eine ganze Saison zu Ende.',
    target: 1,
    progress: (c) => c.state.seasons.length + (c.state.profile && seasonOver(c.state.profile, c.today) ? 1 : 0),
  },
];

export interface AchievementStatus {
  achievement: Achievement;
  value: number;
  unlocked: boolean;
}

export function achievementStatus(state: GameState, today: string): AchievementStatus[] {
  const c: Context = {
    state,
    today,
    quests: questsDone(state),
    cleared: Object.values(state.days).filter(isCleared).length,
    best: bestStreak(state),
    level: levelFromXp(totalXp(state)).level,
    attrs: attributes(state),
    doubled: questsDoubled(state),
    allOut: daysAllDoubled(state),
  };
  return ACHIEVEMENTS.map((a) => {
    const value = a.progress(c);
    return { achievement: a, value: Math.min(value, a.target), unlocked: value >= a.target };
  });
}
