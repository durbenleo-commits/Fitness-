import { useCallback, useEffect, useState } from 'react';
import {
  emptyState,
  generateDay,
  isGameState,
  levelFromXp,
  rerollQuest,
  toDateKey,
  totalXp,
  type GameState,
  type Profile,
} from './game';

const KEY = 'questfit.state.v1';

function load(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isGameState(parsed)) return parsed;
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return emptyState();
}

function save(state: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore: private mode or quota */
  }
}

/** Today's date key; refreshes when the app comes back to the foreground. */
export function useToday(): string {
  const [today, setToday] = useState(() => toDateKey(new Date()));
  useEffect(() => {
    const refresh = () => setToday(toDateKey(new Date()));
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(timer);
    };
  }, []);
  return today;
}

export function useGame(today: string) {
  const [state, setState] = useState<GameState>(load);

  useEffect(() => save(state), [state]);

  // Make sure today's quests exist, scaled to the current level.
  useEffect(() => {
    setState((s) => {
      if (!s.profile || s.days[today]) return s;
      const { level } = levelFromXp(totalXp(s));
      return { ...s, days: { ...s.days, [today]: generateDay(today, level, s.profile.difficulty) } };
    });
  }, [today, state.profile]);

  const startGame = useCallback((profile: Profile) => {
    setState({ ...emptyState(), profile });
  }, []);

  const toggleQuest = useCallback(
    (questId: string) => {
      setState((s) => {
        const day = s.days[today];
        if (!day) return s;
        const quests = day.quests.map((q) => (q.id === questId ? { ...q, done: !q.done } : q));
        return { ...s, days: { ...s.days, [today]: { ...day, quests } } };
      });
    },
    [today],
  );

  const reroll = useCallback(
    (questId: string) => {
      setState((s) => {
        const day = s.days[today];
        if (!day || !s.profile) return s;
        const { level } = levelFromXp(totalXp(s));
        return { ...s, days: { ...s.days, [today]: rerollQuest(day, questId, level, s.profile.difficulty) } };
      });
    },
    [today],
  );

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setState((s) => (s.profile ? { ...s, profile: { ...s.profile, ...patch } } : s));
  }, []);

  const replaceState = useCallback((next: GameState) => setState(next), []);
  const resetAll = useCallback(() => setState(emptyState()), []);

  return { state, startGame, toggleQuest, reroll, updateProfile, replaceState, resetAll };
}
