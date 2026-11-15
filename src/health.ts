// Bridge to Health Connect (where Samsung Health writes steps and workouts).
// Only works inside the Android app; the web version reports "unsupported".
import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import type { HealthDay } from './battle';
import { addDays, toDateKey } from './game';

const READ = ['steps', 'distance', 'workouts'] as const;
const RUN_TYPES = new Set(['running', 'runningTreadmill', 'trackAndField']);

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

/** Steps and running distance per local day for the last `days` days, including today. */
export async function fetchHealthDays(today: string, days = 8): Promise<Record<string, HealthDay>> {
  const from = addDays(today, -(days - 1));
  const startDate = startOfDay(from).toISOString();
  const endDate = new Date().toISOString();

  const out: Record<string, HealthDay> = {};
  for (let i = 0; i < days; i++) out[addDays(from, i)] = { steps: 0, runKm: 0 };

  const { samples } = await Health.queryAggregated({ dataType: 'steps', startDate, endDate, bucket: 'day', aggregation: 'sum' });
  for (const s of samples) {
    const key = toDateKey(new Date(s.startDate));
    if (out[key]) out[key].steps += Math.round(s.value);
  }

  let anchor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const res = await Health.queryWorkouts({ startDate, endDate, limit: 50, anchor });
    for (const w of res.workouts) {
      if (!RUN_TYPES.has(w.workoutType) || !w.totalDistance) continue;
      const key = toDateKey(new Date(w.startDate));
      if (out[key]) out[key].runKm = Number((out[key].runKm + w.totalDistance / 1000).toFixed(2));
    }
    anchor = res.anchor ?? undefined;
    if (!anchor) break;
  }
  return out;
}
