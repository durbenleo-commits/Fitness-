import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureBattles, logDamage, settleBattles, undoDamage, type Battle } from './battle';
import {
  acknowledgeUnlocks,
  addDailyQuestToDay,
  applyAusdauerBonus,
  autoCompleteFromHealth,
  completeQuest as completeQuestIn,
  dayOutdated,
  rebuildDay,
  emptyState,
  isGameState,
  levelFromXp,
  normalize,
  randomPool,
  rerollQuest,
  setQuestVariant as setQuestVariantIn,
  setReading as setReadingIn,
  setTrainingGoal as setTrainingGoalIn,
  startNewSeason,
  toDateKey,
  totalXp,
  uncheckQuest as uncheckQuestIn,
  type GameState,
  type Profile,
  type QuestInstance,
  type QuestTemplate,
} from './game';
import { connectHealth, fetchHealthDays, healthSupported } from './health';
import { proofFor } from './proof';
import {
  logPages as logPagesIn,
  startBook as startBookIn,
  undoLastPages,
  updateBook as updateBookIn,
  type BookPatch,
  type LogPagesInput,
  type LogPagesResult,
  type UpdateBookResult,
} from './reading';

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
    // Timers can sleep in a background WebView, and visibilitychange is not reliable on resume:
    // also listen to focus, pageshow and Capacitor's document 'resume' event.
    const targets: [EventTarget, string][] = [
      [document, 'visibilitychange'],
      [document, 'resume'],
      [window, 'focus'],
      [window, 'pageshow'],
    ];
    targets.forEach(([t, ev]) => t.addEventListener(ev, refresh));
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      targets.forEach(([t, ev]) => t.removeEventListener(ev, refresh));
      window.clearInterval(timer);
    };
  }, []);
  return today;
}

const currentLevel = (s: GameState) => levelFromXp(totalXp(s)).level;
const easyOn = (s: GameState) => !!s.profile?.easyVariants;

/** Quests proven by a photo (reading) are ticked off by logPages only, never by hand. */
const needsPhoto = (s: GameState, q: QuestInstance | undefined) => !!q && proofFor(q, s.customQuests).kind === 'photo';

export function useGame(today: string) {
  const [state, setState] = useState<GameState>(load);
  // latest committed state, for actions that must answer right away (logPages)
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => save(state), [state]);

  // Make sure today's quests, today's enemy and this week's boss exist, scaled to the current level.
  useEffect(() => {
    setState((s) => {
      if (!s.profile) return s;
      let next = s;
      const existing = s.days[today];
      // Days made before a fixed quest or the rotating extras existed are rebuilt, as long as nothing
      // is ticked yet (the swap joker already used stays used).
      if (!existing || dayOutdated(existing, s.profile)) {
        next = { ...s, days: { ...s.days, [today]: rebuildDay(s, today, currentLevel(s)) } };
      }
      return ensureBattles(next, today, currentLevel(next));
    });
  }, [today, state.profile]);

  // Derived bookkeeping: health ticks off quests, finished fights get their victory date.
  // Functional update: it must build on the latest state, never overwrite a pending one.
  useEffect(() => {
    setState((s) => {
      // the Ausdauer-Bonus goes on open run quests first (once, see applyAusdauerBonus), then health ticks off
      const settled = settleBattles(autoCompleteFromHealth(applyAusdauerBonus(s, today), today), today);
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

  /**
   * Mark a quest done with what was achieved (quest unit; default its amount, clamped to
   * amount..2×amount). Calling it again on a done quest with more upgrades the result.
   * Call only after its proof (camera count, presence timer) succeeded.
   * The reading quest (photo proof) is ignored here: it is ticked off by logPages.
   */
  const completeQuest = useCallback(
    (questId: string, achieved?: number) => {
      setState((s) => {
        const day = s.days[today];
        if (!day || needsPhoto(s, day.quests.find((q) => q.id === questId))) return s;
        const next = completeQuestIn(day, questId, achieved);
        return next === day ? s : { ...s, days: { ...s.days, [today]: next } };
      });
    },
    [today],
  );

  /** Undo a finished quest. Always allowed. */
  const uncheckQuest = useCallback(
    (questId: string) => {
      setState((s) => {
        const day = s.days[today];
        if (!day) return s;
        const next = uncheckQuestIn(day, questId);
        return next === day ? s : { ...s, days: { ...s.days, [today]: next } };
      });
    },
    [today],
  );

  const reroll = useCallback(
    (questId: string) => {
      setState((s) => {
        const day = s.days[today];
        if (!day || !s.profile) return s;
        const next = rerollQuest(day, questId, currentLevel(s), s.profile.difficulty, randomPool(s), easyOn(s), s.customQuests);
        return { ...s, days: { ...s.days, [today]: next } };
      });
    },
    [today],
  );

  /** Switch one open quest of today between normal and its easier variant (less XP). */
  const setQuestVariant = useCallback(
    (questId: string, easy: boolean) => {
      setState((s) => {
        const day = s.days[today];
        if (!day) return s;
        const next = setQuestVariantIn(day, questId, easy, s.customQuests);
        return next === day ? s : { ...s, days: { ...s.days, [today]: next } };
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
        const updated = addDailyQuestToDay(day, t, s.profile.difficulty);
        return updated === day ? next : { ...next, days: { ...s.days, [today]: updated } };
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
        const fresh = rebuildDay(s, today, level);
        next = { ...next, days: { ...next.days, [today]: fresh } };
      }
      const untouched = (b: Battle) => b.end >= today && !b.defeatedOn && b.phases.every((p) => p.log.length === 0);
      next = { ...next, battles: next.battles.filter((b) => !untouched(b)) };
      return ensureBattles(next, today, level);
    });
  }, [today]);

  /** Switch the daily reading quest on or off (today follows right away, see game.setReading). */
  const setReading = useCallback(
    (on: boolean) => setState((s) => setReadingIn(s, today, on)),
    [today],
  );

  /** Start a new book (empty titles are ignored), optionally with a cover photo and page count. */
  const startBook = useCallback(
    (title: string, startPage = 0, opts?: { cover?: string; totalPages?: number }) =>
      setState((s) => startBookIn(s, title, today, startPage, opts)),
    [today],
  );

  /** Change a book's title, cover or page count. Returns at once whether it worked (German error). */
  const updateBook = useCallback((bookId: string, patch: BookPatch): UpdateBookResult => {
    const snapshot = stateRef.current;
    const result = updateBookIn(snapshot, bookId, patch);
    if (!result.error) setState((s) => (s === snapshot ? result.state : updateBookIn(s, bookId, patch).state));
    return result;
  }, []);

  /**
   * Log the page reached with a photo of it. The only way to tick off the reading quest.
   * Returns at once what happened (pages today, quest amount, done, or a German error).
   */
  const logPages = useCallback(
    (input: LogPagesInput): LogPagesResult => {
      const snapshot = stateRef.current;
      const result = logPagesIn(snapshot, today, input);
      if (!result.error) {
        // build on newer state if something else changed in between
        setState((s) => (s === snapshot ? result.state : logPagesIn(s, today, input).state));
      }
      return result;
    },
    [today],
  );

  /** Take back the last page entry of a book (typo). */
  const undoPages = useCallback(
    (bookId: string) => setState((s) => undoLastPages(s, today, bookId)),
    [today],
  );

  const newSeason = useCallback(
    (length: number) => setState((s) => startNewSeason(s, today, length)),
    [today],
  );

  /** The "Neu freigeschaltet" note on Today was closed: remember what was shown, clear a reached goal. */
  const markUnlocksSeen = useCallback(() => setState((s) => acknowledgeUnlocks(s)), []);

  /** Set (or clear with null) the training goal: a locked exercise whose prerequisites the extras then train. */
  const setTrainingGoal = useCallback((id: string | null) => setState((s) => setTrainingGoalIn(s, id)), []);

  const replaceState = useCallback((next: GameState) => setState(normalize(next)), []);
  const resetAll = useCallback(() => setState(emptyState()), []);

  return {
    state,
    hit,
    undoHit,
    health: { supported: healthSupported(), syncing, error: healthError, connect, disconnect, sync: syncHealth },
    startGame,
    completeQuest,
    uncheckQuest,
    reroll,
    setQuestVariant,
    updateProfile,
    addCustomQuest,
    removeCustomQuest,
    setQuestEnabled,
    newSeason,
    applyToToday,
    setReading,
    startBook,
    updateBook,
    logPages,
    undoPages,
    markUnlocksSeen,
    setTrainingGoal,
    replaceState,
    resetAll,
  };
}

export type Game = ReturnType<typeof useGame>;
