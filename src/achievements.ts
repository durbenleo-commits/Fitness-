import {
  attributes,
  bestStreak,
  isCleared,
  levelFromXp,
  questsDone,
  seasonOver,
  totalFor,
  totalXp,
  type GameState,
} from './game';

export interface Achievement {
  id: string;
  icon: string;
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
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-quest', icon: '🎯', title: 'Erster Schritt', description: 'Erledige deine erste Quest.', target: 1, progress: (c) => c.quests },
  { id: 'first-clear', icon: '✅', title: 'Tag geschafft', description: 'Erledige an einem Tag alle Quests.', target: 1, progress: (c) => c.cleared },
  { id: 'streak-3', icon: '🔥', title: 'Warm gelaufen', description: '3 Tage in Folge alle Quests.', target: 3, progress: (c) => c.best },
  { id: 'streak-7', icon: '📅', title: 'Eine Woche', description: '7 Tage in Folge alle Quests.', target: 7, progress: (c) => c.best },
  { id: 'streak-14', icon: '⛓️', title: 'Nicht zu stoppen', description: '14 Tage in Folge alle Quests.', target: 14, progress: (c) => c.best },
  { id: 'streak-30', icon: '🏆', title: 'Eiserner Wille', description: '30 Tage in Folge alle Quests.', target: 30, progress: (c) => c.best },
  { id: 'quests-50', icon: '🎒', title: 'Fleißig', description: 'Erledige 50 Quests.', target: 50, progress: (c) => c.quests },
  { id: 'quests-200', icon: '🧗', title: 'Dauerbrenner', description: 'Erledige 200 Quests.', target: 200, progress: (c) => c.quests },
  { id: 'level-5', icon: '⬆️', title: 'Aufsteiger', description: 'Erreiche Level 5.', target: 5, progress: (c) => c.level },
  { id: 'level-10', icon: '🎖️', title: 'Kämpfer', description: 'Erreiche Level 10.', target: 10, progress: (c) => c.level },
  { id: 'level-20', icon: '👑', title: 'Elite', description: 'Erreiche Level 20.', target: 20, progress: (c) => c.level },
  { id: 'strength-25', icon: '💪', title: 'Kraftpaket', description: 'Erledige 25 Stärke-Quests.', target: 25, progress: (c) => c.attrs.staerke },
  { id: 'endurance-25', icon: '🫀', title: 'Langer Atem', description: 'Erledige 25 Ausdauer-Quests.', target: 25, progress: (c) => c.attrs.ausdauer },
  { id: 'flex-25', icon: '🤸', title: 'Gelenkig', description: 'Erledige 25 Beweglichkeits-Quests.', target: 25, progress: (c) => c.attrs.beweglichkeit },
  { id: 'pushups-500', icon: '🦾', title: '500 Liegestütze', description: 'Mach insgesamt 500 Liegestütze.', target: 500, progress: (c) => totalFor(c.state, 'pushups') },
  { id: 'run-50', icon: '🏃', title: '50 Kilometer', description: 'Lauf insgesamt 50 km.', target: 50, progress: (c) => totalFor(c.state, 'run') },
  { id: 'custom', icon: '✏️', title: 'Eigener Weg', description: 'Lege eine eigene Quest an.', target: 1, progress: (c) => c.state.customQuests.length },
  {
    id: 'season',
    icon: '🏁',
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
  };
  return ACHIEVEMENTS.map((a) => {
    const value = a.progress(c);
    return { achievement: a, value: Math.min(value, a.target), unlocked: value >= a.target };
  });
}
