import { useCallback, useEffect, useState } from 'react';
import {
  dailyQuests,
  emptyState,
  generateDay,
  isGameState,
  levelFromXp,
  normalize,
  randomPool,
  rerollQuest,
  scaledAmount,
  startNewSeason,
  toDateKey,
  totalXp,
  type GameState,
  type Profile,
  type QuestTemplate,
} from './game';

const KEY = 'questfit.state.v1';

function load(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isGameState(parsed)) return normalize(parsed);
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

const currentLevel = (s: GameState) => levelFromXp(totalXp(s)).level;

export function useGame(today: string) {
  const [state, setState] = useState<GameState>(load);

  useEffect(() => save(state), [state]);

  // Make sure today's quests exist, scaled to the current level.
  useEffect(() => {
    setState((s) => {
      if (!s.profile || s.days[today]) return s;
      const day = generateDay(today, currentLevel(s), s.profile.difficulty, randomPool(s), dailyQuests(s));
      return { ...s, days: { ...s.days, [today]: day } };
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
        const next = rerollQuest(day, questId, currentLevel(s), s.profile.difficulty, randomPool(s));
        return { ...s, days: { ...s.days, [today]: next } };
      });
    },
    [today],
  );

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setState((s) => (s.profile ? { ...s, profile: { ...s.profile, ...patch } } : s));
  }, []);

  /** New daily quests show up right away; the others join the random pool from tomorrow. */
  const addCustomQuest = useCallback(
    (t: QuestTemplate) => {
      setState((s) => {
        const next = { ...s, customQuests: [...s.customQuests, t] };
        const day = s.days[today];
        if (!t.daily || !day || !s.profile) return next;
        const quest = {
          id: `${t.id}-${day.quests.length}`,
          templateId: t.id,
          title: t.title,
          icon: t.icon,
          attr: t.attr,
          amount: scaledAmount(t, 1, s.profile.difficulty),
          unit: t.unit,
          xp: t.xp,
          done: false,
        };
        return { ...next, days: { ...s.days, [today]: { ...day, quests: [...day.quests, quest] } } };
      });
    },
    [today],
  );

  /** Past results stay in the history; only future days lose the quest. */
  const removeCustomQuest = useCallback((id: string) => {
    setState((s) => ({ ...s, customQuests: s.customQuests.filter((q) => q.id !== id) }));
  }, []);

  const setQuestEnabled = useCallback((id: string, enabled: boolean) => {
    setState((s) => ({
      ...s,
      disabledQuests: enabled ? s.disabledQuests.filter((x) => x !== id) : [...new Set([...s.disabledQuests, id])],
    }));
  }, []);

  const newSeason = useCallback(
    (length: number) => setState((s) => startNewSeason(s, today, length)),
    [today],
  );

  const replaceState = useCallback((next: GameState) => setState(normalize(next)), []);
  const resetAll = useCallback(() => setState(emptyState()), []);

  return {
    state,
    startGame,
    toggleQuest,
    reroll,
    updateProfile,
    addCustomQuest,
    removeCustomQuest,
    setQuestEnabled,
    newSeason,
    replaceState,
    resetAll,
  };
}

export type Game = ReturnType<typeof useGame>;
