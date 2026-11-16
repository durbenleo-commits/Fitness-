// Bridge to Health Connect (where Samsung Health writes steps and workouts).
// Only works inside the Android app; the web version reports "unsupported".
import { Capacitor } from '@capacitor/core';
import { Health, type WorkoutType } from '@capgo/capacitor-health';
import type { HealthDay } from './battle';
import { addDays, toDateKey } from './game';

const READ = ['steps', 'distance', 'workouts', 'flightsClimbed'] as const;

/** Which synced field a workout type adds to. Running adds distance, the others minutes. */
const WORKOUT_FIELD: Partial<Record<WorkoutType, 'runKm' | 'bikeMin' | 'swimMin' | 'strengthMin'>> = {
  running: 'runKm',
  runningTreadmill: 'runKm',
  trackAndField: 'runKm',
  cycling: 'bikeMin',
  bikingStationary: 'bikeMin',
  handCycling: 'bikeMin',
  swimming: 'swimMin',
  swimmingPool: 'swimMin',
  swimmingOpenWater: 'swimMin',
  strengthTraining: 'strengthMin',
  traditionalStrengthTraining: 'strengthMin',
  functionalStrengthTraining: 'strengthMin',
  weightlifting: 'strengthMin',
  calisthenics: 'strengthMin',
};

export const healthSupported = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export type ConnectResult = { ok: true } | { ok: false; reason: string };

export async function connectHealth(): Promise<ConnectResult> {
  if (!healthSupported()) return { ok: false, reason: 'Das geht nur in der Android-App.' };
  try {
    const availability = await Health.isAvailable();
    if (!availability.available) {
      return {
        ok: false,
        reason: 'Health Connect ist auf diesem Handy nicht verfügbar. Installiere „Health Connect“ aus dem Play Store und versuch es erneut.',
      };
    }
    const status = await Health.requestAuthorization({ read: [...READ] });
    if (!status.readAuthorized.includes('steps')) {
      return { ok: false, reason: 'Ohne Zugriff auf Schritte kann Questfit nichts übernehmen. Erlaube den Zugriff in Health Connect.' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `Verbindung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function openHealthSettings() {
  if (healthSupported()) await Health.openHealthConnectSettings();
}

const startOfDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0);
};

/**
 * Per local day for the last `days` days, including today: steps, floors climbed,
 * running distance and minutes of cycling, swimming and strength workouts.
 */
export async function fetchHealthDays(today: string, days = 8): Promise<Record<string, HealthDay>> {
  const from = addDays(today, -(days - 1));
  const startDate = startOfDay(from).toISOString();
  const endDate = new Date().toISOString();

  const out: Record<string, HealthDay> = {};
  for (let i = 0; i < days; i++) out[addDays(from, i)] = { steps: 0, runKm: 0, bikeMin: 0, swimMin: 0, floors: 0, strengthMin: 0 };

  const { samples } = await Health.queryAggregated({ dataType: 'steps', startDate, endDate, bucket: 'day', aggregation: 'sum' });
  for (const s of samples) {
    const key = toDateKey(new Date(s.startDate));
    if (out[key]) out[key].steps += Math.round(s.value);
  }

  // Floors need their own permission; without it the rest still syncs.
  try {
    const floors = await Health.queryAggregated({ dataType: 'flightsClimbed', startDate, endDate, bucket: 'day', aggregation: 'sum' });
    for (const s of floors.samples) {
      const key = toDateKey(new Date(s.startDate));
      if (out[key]) out[key].floors = (out[key].floors ?? 0) + Math.round(s.value);
    }
  } catch {
    /* no floors permission or no data source: keep 0 */
  }

  let anchor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const res = await Health.queryWorkouts({ startDate, endDate, limit: 50, anchor });
    for (const w of res.workouts) {
      const field = WORKOUT_FIELD[w.workoutType];
      const key = toDateKey(new Date(w.startDate));
      const day = out[key];
      if (!field || !day) continue;
      if (field === 'runKm') {
        if (w.totalDistance) day.runKm = Number((day.runKm + w.totalDistance / 1000).toFixed(2));
      } else if (w.duration > 0) {
        day[field] = Number(((day[field] ?? 0) + w.duration / 60).toFixed(1));
      }
    }
    anchor = res.anchor ?? undefined;
    if (!anchor) break;
  }
  return out;
}
