import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { achievementStatus, type Achievement } from './achievements';
import { currentStreak, levelFromXp, totalXp } from './game';
import { useGame, useToday } from './store';
import { AchievementsView } from './views/Achievements';
import { ArenaView } from './views/Arena';
import { Onboarding } from './views/Onboarding';
import { SettingsView } from './views/Settings';
import { StatsView } from './views/Stats';
import { Icon } from './views/Icons';
import { Hud, TodayView } from './views/Today';
import { LevelUp, Toast, Victory } from './views/ui';
import type { Battle } from './battle';

type Tab = 'heute' | 'arena' | 'werte' | 'erfolge' | 'einstellungen';

const TABS: { id: Tab; label: string; icon: 'today' | 'arena' | 'stats' | 'medal' | 'sliders' }[] = [
  { id: 'heute', label: 'Heute', icon: 'today' },
  { id: 'arena', label: 'Arena', icon: 'arena' },
  { id: 'werte', label: 'Werte', icon: 'stats' },
  { id: 'erfolge', label: 'Erfolge', icon: 'medal' },
  { id: 'einstellungen', label: 'Optionen', icon: 'sliders' },
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

  const [victory, setVictory] = useState<Battle | null>(null);
  const wonIds = useRef(new Set(state.battles.filter((b) => b.defeatedOn).map((b) => b.id)));
  useEffect(() => {
    const won = state.battles.filter((b) => b.defeatedOn);
    const fresh = won.find((b) => !wonIds.current.has(b.id));
    wonIds.current = new Set(won.map((b) => b.id));
    if (fresh) setVictory(fresh);
  }, [state.battles]);

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
        {tab === 'heute' && (
          <TodayView
            game={game}
            today={today}
            onOpenArena={() => {
              setTab('arena');
              window.scrollTo(0, 0);
            }}
          />
        )}
        {tab === 'arena' && <ArenaView game={game} today={today} />}
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
            <Icon name={t.icon} size={22} />
            {t.label}
          </button>
        ))}
      </nav>

      {toasts.length > 0 && levelUp === null && victory === null && <Toast key={toasts[0].id} icon={toasts[0].icon} tier={toasts[0].tier} title={toasts[0].title} onDone={dropToast} />}
      {victory !== null && levelUp === null && <Victory battle={victory} onClose={() => setVictory(null)} />}
      {levelUp !== null && <LevelUp level={levelUp} onClose={() => setLevelUp(null)} />}
    </div>
  );
}
