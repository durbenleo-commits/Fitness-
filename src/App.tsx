import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { achievementStatus, type Achievement } from './achievements';
import { currentStreak, levelFromXp, totalXp } from './game';
import { useGame, useToday } from './store';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AchievementsView } from './views/Achievements';
import { ArenaView } from './views/Arena';
import { Onboarding } from './views/Onboarding';
import { SettingsView } from './views/Settings';
import { Books, StatsView } from './views/Stats';
import { ExercisesView } from './views/Exercises';
import { HubView, SCREEN_TITLE, type Screen } from './views/Hub';
import { MasteryView } from './views/Mastery';
import { NavBar } from './views/NavBar';
import { Icon } from './views/Icons';
import { Hud, TodayView } from './views/Today';
import { UpdatePrompt } from './views/UpdatePrompt';
import { LevelUp, Toast, Victory } from './views/ui';
import { closeTopOverlay, handleOverlayPop, takeOverlayEntry } from './views/overlayStack';
import type { Battle } from './battle';

type Tab = 'heute' | 'arena' | 'menu';

const TABS: { id: Tab; label: string; icon: 'today' | 'arena' | 'menu' }[] = [
  { id: 'heute', label: 'Heute', icon: 'today' },
  { id: 'arena', label: 'Arena', icon: 'arena' },
  { id: 'menu', label: 'Menü', icon: 'menu' },
];

/** The sub-screen stored in a history entry (pushed when a menu row opens a screen). */
const depthOf = (st: unknown): number => {
  const v = (st as { qfDepth?: unknown } | null)?.qfDepth;
  return typeof v === 'number' && v >= 1 ? v : 0;
};
const screenOf = (st: unknown): Screen | null => {
  const v = (st as { qfScreen?: unknown } | null)?.qfScreen;
  return typeof v === 'string' && v in SCREEN_TITLE ? (v as Screen) : null;
};

export default function App() {
  const today = useToday();
  const game = useGame(today);
  const { state } = game;
  const [tab, setTab] = useState<Tab>('heute');
  // Screens opened from the menu live in the browser history, so the Android back button
  // and the browser's back go back to the menu.
  const [screen, setScreen] = useState<Screen | null>(null);
  const [motion, setMotion] = useState<'push' | 'pop' | 'none'>('none');
  const menuScroll = useRef(0);
  const depthRef = useRef(0); // history entries pushed on top of the menu (menu -> Übungen -> Meisterschaft = 2)
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => {
    const st = window.history.state as { qfOverlay?: unknown } | null;
    if (screenOf(st) || st?.qfOverlay) window.history.replaceState(null, ''); // a reload starts on Heute
    const onPop = (e: PopStateEvent) => {
      if (handleOverlayPop(e.state)) return; // back closed a sheet or the scanner: stay on this screen
      const next = screenOf(e.state);
      depthRef.current = next ? depthOf(e.state) : 0;
      setScreen(next);
      setMotion('pop');
      if (next === null && tabRef.current === 'menu') requestAnimationFrame(() => window.scrollTo(0, menuScroll.current));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (closeTopOverlay()) return; // an open sheet or the scanner closes first
      if (canGoBack) window.history.back();
      else CapApp.exitApp();
    });
    return () => {
      sub.then((h) => h.remove());
    };
  }, []);
  const openScreen = useCallback((s: Screen) => {
    if (depthRef.current === 0) menuScroll.current = window.scrollY;
    depthRef.current += 1;
    const entry = { qfScreen: s, qfDepth: depthRef.current };
    // opened from a sheet button: take over the sheet's history entry instead of stacking on it
    if (takeOverlayEntry()) window.history.replaceState(entry, '');
    else window.history.pushState(entry, '');
    setScreen(s);
    setMotion('push');
    setTab('menu');
    window.scrollTo(0, 0);
  }, []);
  const back = useCallback(() => window.history.back(), []);

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

  const sub = tab === 'menu' ? screen : null;

  if (!state.profile) return (
    <>
      <Onboarding onStart={game.startGame} />
      <UpdatePrompt />
    </>
  );

  return (
    <div className="app">
      {sub ? (
        <NavBar title={SCREEN_TITLE[sub]} backLabel="Menü" onBack={back} />
      ) : (
        <Hud
          profile={state.profile}
          level={lvl.level}
          intoLevel={lvl.intoLevel}
          needed={lvl.needed}
          streak={currentStreak(state, today)}
          today={today}
        />
      )}

      <main className={`content ${sub ? 'sub' : ''}`}>
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
        {tab === 'menu' && (
          <div key={sub ?? 'menu'} className={`screen motion-${motion}`}>
            {sub === null && <HubView game={game} xp={xp} achievements={achievements} onOpen={openScreen} />}
            {sub !== null && (
              <div className="large-title-row">
                <h1 className="large-title" id="screen-title">
                  {SCREEN_TITLE[sub]}
                </h1>
                {sub === 'erfolge' && (
                  <span className="count">
                    {achievements.filter((a) => a.unlocked).length} von {achievements.length}
                  </span>
                )}
              </div>
            )}
            {sub === 'meisterschaft' && <MasteryView game={game} />}
            {sub === 'erfolge' && <AchievementsView list={achievements} />}
            {sub === 'werte' && <StatsView game={game} today={today} xp={xp} />}
            {sub === 'uebungen' && <ExercisesView game={game} onOpenMastery={() => openScreen('meisterschaft')} />}
            {sub === 'lesen' && (
              <div className="reading-screen">
                <Books game={game} today={today} />
              </div>
            )}
            {sub === 'einstellungen' && <SettingsView game={game} />}
          </div>
        )}
      </main>

      <nav className="tabs" aria-label="Bereiche">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => {
              // leaving an open screen (or tapping Menü on it) goes back to the menu first
              if (depthRef.current > 0) window.history.go(-depthRef.current); // pops every opened screen at once
              setMotion('none');
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
      <UpdatePrompt />
    </div>
  );
}
