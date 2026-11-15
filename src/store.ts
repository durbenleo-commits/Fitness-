import { useCallback, useEffect, useState } from 'react';
import { ensureBattles, logDamage, settleBattles, undoDamage, type Battle } from './battle';
import {
  autoCompleteFromHealth,
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
import { connectHealth, fetchHealthDays, healthSupported } from './health';

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

  // Make sure today's quests, today's enemy and this week's boss exist, scaled to the current level.
  useEffect(() => {
    setState((s) => {
      if (!s.profile) return s;
      let next = s;
      const existing = s.days[today];
      // Days made before the step goal became fixed get it, as long as nothing is ticked yet.
      const outdated = existing && !existing.quests.some((q) => q.templateId === 'steps') && !existing.quests.some((q) => q.done);
      if (!existing || outdated) {
        const day = generateDay(today, currentLevel(s), s.profile.difficulty, randomPool(s), dailyQuests(s));
        next = { ...s, days: { ...s.days, [today]: day } };
      }
      return ensureBattles(next, today, currentLevel(next));
    });
  }, [today, state.profile]);

  // Derived bookkeeping: health ticks off quests, finished fights get their victory date.
  // Functional update: it must build on the latest state, never overwrite a pending one.
  useEffect(() => {
    setState((s) => {
      const settled = settleBattles(autoCompleteFromHealth(s, today), today);
      // a fresh enemy steps in once the current one falls
      return settled.profile ? ensureBattles(settled, today, currentLevel(settled)) : settled;
    });
  }, [state, today]);

  // Health Connect sync: on start, when the app returns to the foreground, and on demand.
  const [syncing, setSyncing] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const syncHealth = useCallback(async () => {
    if (!healthSupported()) return;
    setSyncing(true);
    try {
      const days = await fetchHealthDays(today);
      setState((s) => ({ ...s, health: { connected: true, lastSync: new Date().toISOString(), days: { ...s.health.days, ...days } } }));
      setHealthError(null);
    } catch (e) {
      setHealthError(`Synchronisieren fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
    }
  }, [today]);

  useEffect(() => {
    if (!state.health.connected || !healthSupported()) return;
    syncHealth();
    const onVisible = () => document.visibilityState === 'visible' && syncHealth();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [state.health.connected, syncHealth]);

  const connect = useCallback(async () => {
    const res = await connectHealth();
    if (!res.ok) {
      setHealthError(res.reason);
      return;
    }
    setHealthError(null);
    setState((s) => ({ ...s, health: { ...s.health, connected: true } }));
  }, []);

  const disconnect = useCallback(() => {
    setState((s) => ({ ...s, health: { ...s.health, connected: false } }));
  }, []);

  const hit = useCallback(
    (battleId: string, phaseId: string, amount: number) => {
      setState((s) => ({ ...s, battles: s.battles.map((b) => (b.id === battleId ? logDamage(b, phaseId, today, amount) : b)) }));
    },
    [today],
  );

  const undoHit = useCallback(
    (battleId: string, phaseId: string) => {
      setState((s) => ({ ...s, battles: s.battles.map((b) => (b.id === battleId ? undoDamage(b, phaseId, today) : b)) }));
    },
    [today],
  );

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

  /** Rebuild today's quests and untouched fights with the current settings. */
  const applyToToday = useCallback(() => {
    setState((s) => {
      if (!s.profile) return s;
      const level = currentLevel(s);
      let next = s;
      const day = s.days[today];
      if (day && !day.quests.some((q) => q.done)) {
        const fresh = generateDay(today, level, s.profile.difficulty, randomPool(s), dailyQuests(s));
        next = { ...next, days: { ...next.days, [today]: fresh } };
      }
      const untouched = (b: Battle) => b.end >= today && !b.defeatedOn && b.phases.every((p) => p.log.length === 0);
      next = { ...next, battles: next.battles.filter((b) => !untouched(b)) };
      return ensureBattles(next, today, level);
    });
  }, [today]);

  const newSeason = useCallback(
    (length: number) => setState((s) => startNewSeason(s, today, length)),
    [today],
  );

  const replaceState = useCallback((next: GameState) => setState(normalize(next)), []);
  const resetAll = useCallback(() => setState(emptyState()), []);

  return {
    state,
    hit,
    undoHit,
    health: { supported: healthSupported(), syncing, error: healthError, connect, disconnect, sync: syncHealth },
    startGame,
    toggleQuest,
    reroll,
    updateProfile,
    addCustomQuest,
    removeCustomQuest,
    setQuestEnabled,
    newSeason,
    applyToToday,
    replaceState,
    resetAll,
  };
}

export type Game = ReturnType<typeof useGame>;
