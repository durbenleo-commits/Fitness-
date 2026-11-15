import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { achievementStatus, type Achievement } from './achievements';
import { currentStreak, levelFromXp, totalXp } from './game';
import { useGame, useToday } from './store';
import { AchievementsView } from './views/Achievements';
import { Onboarding } from './views/Onboarding';
import { SettingsView } from './views/Settings';
import { StatsView } from './views/Stats';
import { Hud, TodayView } from './views/Today';
import { LevelUp, Toast } from './views/ui';

type Tab = 'heute' | 'werte' | 'erfolge' | 'einstellungen';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'heute', label: 'Heute', icon: '⚔️' },
  { id: 'werte', label: 'Werte', icon: '📈' },
  { id: 'erfolge', label: 'Erfolge', icon: '🏅' },
  { id: 'einstellungen', label: 'Einstellungen', icon: '⚙️' },
];

export default function App() {
  const today = useToday();
  const game = useGame(today);
  const { state } = game;
  const [tab, setTab] = useState<Tab>('heute');

  const xp = totalXp(state);
  const lvl = levelFromXp(xp);
  const achievements = useMemo(() => achievementStatus(state, today), [state, today]);

  // Celebrate only what happens during this session, not what was already there on load.
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const lastLevel = useRef(lvl.level);
  useEffect(() => {
    if (state.profile && lvl.level > lastLevel.current) setLevelUp(lvl.level);
    lastLevel.current = lvl.level;
  }, [lvl.level, state.profile]);

  const [toasts, setToasts] = useState<Achievement[]>([]);
  const known = useRef(new Set(achievements.filter((a) => a.unlocked).map((a) => a.achievement.id)));
  useEffect(() => {
    const fresh = achievements.filter((a) => a.unlocked && !known.current.has(a.achievement.id)).map((a) => a.achievement);
    known.current = new Set(achievements.filter((a) => a.unlocked).map((a) => a.achievement.id));
    if (fresh.length > 0 && state.profile) setToasts((t) => [...t, ...fresh]);
  }, [achievements, state.profile]);
  const dropToast = useCallback(() => setToasts((t) => t.slice(1)), []);

  if (!state.profile) return <Onboarding onStart={game.startGame} />;

  return (
    <div className="app">
      <Hud
        profile={state.profile}
        level={lvl.level}
        intoLevel={lvl.intoLevel}
        needed={lvl.needed}
        streak={currentStreak(state, today)}
        today={today}
      />

      <main className="content">
        {tab === 'heute' && <TodayView game={game} today={today} />}
        {tab === 'werte' && <StatsView state={state} today={today} xp={xp} />}
        {tab === 'erfolge' && <AchievementsView list={achievements} />}
        {tab === 'einstellungen' && <SettingsView game={game} />}
      </main>

      <nav className="tabs" aria-label="Bereiche">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => {
              setTab(t.id);
              window.scrollTo(0, 0);
            }}
          >
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {toasts.length > 0 && levelUp === null && <Toast key={toasts[0].id} icon={toasts[0].icon} title={toasts[0].title} onDone={dropToast} />}
      {levelUp !== null && <LevelUp level={levelUp} onClose={() => setLevelUp(null)} />}
    </div>
  );
}
