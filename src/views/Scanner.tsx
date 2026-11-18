// Camera proof: the phone watches you and counts reps, hold time, the stretch routine or
// plain time in view (presence mode).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import {
  PRESENCE,
  STRETCH,
  STRETCH_POSES,
  STRETCH_POSE_MS,
  initialScan,
  scanAmount,
  scanSpec,
  step,
  type Point,
  type ScanState,
} from '../pose';
import { Icon } from './Icons';
import { fmtTime } from './ui';

// Pairs of landmarks to draw as the skeleton.
const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

/** Load the pose model once; GPU first, CPU if the phone's WebView refuses. */
function loadLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(new URL('./mediapipe', document.baseURI).href);
      const options = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: new URL('./models/pose_landmarker_lite.task', document.baseURI).href, delegate },
        runningMode: 'VIDEO' as const,
        numPoses: 1,
      });
      try {
        return await PoseLandmarker.createFromOptions(fileset, options('GPU'));
      } catch {
        return await PoseLandmarker.createFromOptions(fileset, options('CPU'));
      }
    })().catch((e) => {
      landmarkerPromise = null;
      throw e;
    });
  }
  return landmarkerPromise;
}

type Status = 'loading' | 'running' | 'error';

/**
 * Full-screen camera proof. `exerciseId` is a scan id: an exercise from SCANNABLE, the
 * stretch routine (STRETCH) or presence mode (PRESENCE). `target` is in the scan's own
 * unit: reps, or seconds for holds, the stretch routine and presence mode.
 * With `allowPartial` (arena) the player may hand back less than the target; reaching the
 * target hands it back at once.
 * With `max` (quests) counting goes on past the target: from the target on a "Fertig" button
 * hands back what was counted, and at `max` (2×) it finishes by itself. `base` is what already
 * counts before this scan (doing more on a done quest). The result is the counted total.
 */
export function Scanner(props: {
  exerciseId: string;
  title: string;
  target: number;
  unit: string;
  easy?: boolean;
  perUnit?: number; // counted reps per unit of `unit` (lunges: 2 per leg), shown next to the target
  allowPartial?: boolean;
  max?: number; // quests: keep counting up to this (2× the target)
  base?: number; // already counted before (doing more on a done quest)
  focus?: string; // stretch routine: what it stretches, shown while the camera starts
  onDone: (amount: number) => void;
  onClose: () => void;
}) {
  const { exerciseId, title, target, unit, easy = false, perUnit = 1, allowPartial = false, max, base = 0, focus, onDone, onClose } = props;
  const spec = scanSpec(exerciseId, easy)!;
  const presence = exerciseId === PRESENCE;
  const stretch = exerciseId === STRETCH;
  const timed = spec.kind !== 'reps'; // amount and target are seconds
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanRef = useRef<ScanState>(initialScan(exerciseId));
  const [scan, setScan] = useState<ScanState>(scanRef.current);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const finished = useRef(false);

  const counted = base + scanAmount(scan);
  const amount = max ? Math.min(counted, max) : counted;
  const reached = amount >= target; // 1× done
  const doubled = !!max && amount >= max; // 2× done
  const done = max ? doubled : reached; // finishes by itself
  const goal = max && reached ? max : target; // what the count is shown against

  const finish = useCallback(
    (value: number) => {
      if (finished.current) return;
      finished.current = true;
      onDone(value);
    },
    [onDone],
  );

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let lastVideoTime = -1;

    (async () => {
      try {
        setStatus('loading');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        const video = videoRef.current!;
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        const landmarker = await loadLandmarker();
        if (stopped) return;
        setStatus('running');

        const loop = () => {
          if (stopped) return;
          const v = videoRef.current;
          const canvas = canvasRef.current;
          if (v && canvas && v.readyState >= 2 && v.currentTime !== lastVideoTime) {
            lastVideoTime = v.currentTime;
            const now = performance.now();
            let lm: Point[] | undefined;
            landmarker.detectForVideo(v, now, (res) => {
              lm = res.landmarks[0]?.map((p) => ({ x: p.x, y: p.y, visibility: p.visibility }));
            });
            const aspect = v.videoWidth / (v.videoHeight || 1);
            scanRef.current = step(scanRef.current, lm, now, aspect, easy);
            setScan(scanRef.current);
            draw(canvas, v, lm);
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch (e) {
        const name = e instanceof Error ? e.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Questfit darf die Kamera nicht benutzen. Erlaube den Kamerazugriff in den Android-Einstellungen unter Apps → Questfit → Berechtigungen.'
            : name === 'NotFoundError'
              ? 'Keine Kamera gefunden.'
              : `Die Kamera-Erkennung konnte nicht starten: ${e instanceof Error ? e.message : String(e)}`,
        );
        setStatus('error');
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing, easy]);

  // Reaching the end (the target, or 2× for quests): short celebration, then hand the result back.
  const end = max ?? target;
  useEffect(() => {
    if (!done || finished.current) return;
    navigator.vibrate?.([60, 40, 60]);
    const t = window.setTimeout(() => finish(end), 1300);
    return () => window.clearTimeout(t);
  }, [done, finish, end]);

  // Quests: reaching 1× is worth a buzz, counting goes on towards 2×.
  const wasReached = useRef(reached);
  useEffect(() => {
    if (reached && !wasReached.current && !done) navigator.vibrate?.([60, 40, 60]);
    wasReached.current = reached;
  }, [reached, done]);

  // Closing after 1× keeps what was counted: the quest is done.
  const close = () => (max && reached && amount > base ? finish(amount) : onClose());

  // A small buzz for every counted rep, and when the stretch routine moves to the next pose.
  const lastReps = useRef(0);
  useEffect(() => {
    if (scan.reps > lastReps.current) navigator.vibrate?.(25);
    lastReps.current = scan.reps;
  }, [scan.reps]);
  const lastPose = useRef(scan.poseIndex);
  useEffect(() => {
    if (scan.poseIndex !== lastPose.current) navigator.vibrate?.([40, 30, 40]);
    lastPose.current = scan.poseIndex;
  }, [scan.poseIndex]);

  const statusText =
    status === 'loading'
      ? 'Kamera startet …'
      : scan.wrongView === 'side'
        ? 'Dreh dich zur Seite – diese Übung erkennt die Kamera nur von der Seite.'
        : scan.wrongView === 'front'
          ? 'Stell dich frontal vor die Kamera – diese Übung geht nur von vorne.'
          : !scan.bodyVisible && scan.missing?.length
            ? `Nicht zu sehen: ${scan.missing.join(', ')}`
            : presence
        ? scan.bodyVisible
          ? 'Zeit läuft, bleib im Bild'
          : 'Bleib gut sichtbar im Bild'
        : !scan.bodyVisible
          ? 'Stell dich so hin, dass du ganz zu sehen bist'
          : spec.kind === 'hold'
            ? scan.inPosition
              ? 'Halten!'
              : stretch
                ? 'Geh in die Dehnung'
                : 'Geh in Position'
            : scan.phase === 'down'
              ? 'Und wieder hoch'
              : 'Los geht’s';

  const viewLabel = (v: string | undefined) => (v === 'side' ? 'Nur von der Seite' : v === 'front' ? 'Nur von vorne' : 'Geht von der Seite und von vorne');
  const wrongShown = !!scan.wrongView && !done;
  const pose = stretch ? STRETCH_POSES[scan.poseIndex ?? 0] : undefined;
  const poseSec = Math.min(Math.floor((scan.poseMs ?? 0) / 1000), STRETCH_POSE_MS / 1000);
  const shownAmount = presence || stretch ? fmtTime(amount) : String(amount);
  const fmtGoal = (v: number) =>
    presence || stretch ? fmtTime(v) : perUnit > 1 && !timed ? `${v} (${Math.ceil(v / perUnit)} ${unit})` : `${v} ${timed ? 'Sek.' : unit}`;
  const shownTarget = fmtGoal(goal);

  return (
    <div className="scanner" role="dialog" aria-modal="true" aria-label={`${title} mit Kamera nachweisen`}>
      <div className={`scanner-stage ${facing === 'user' ? 'mirrored' : ''}`}>
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} />
      </div>

      <header className="scanner-top">
        <button className="scanner-icon-btn" onClick={close} aria-label="Schließen">
          <Icon name="close" size={20} />
        </button>
        <div className="scanner-title">
          <strong>{title}</strong>
          <span>{spec.cue}</span>
          {focus && <span className="scanner-focus">{focus}</span>}
        </div>
        <button className="scanner-icon-btn" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} aria-label="Kamera wechseln">
          <Icon name="swap" size={20} />
        </button>
      </header>

      {status === 'error' ? (
        <div className="scanner-panel">
          <p>{error}</p>
          <p className="small-text">Ohne Kamera gibt es keinen Nachweis. Versuch es noch einmal, wenn die Kamera geht.</p>
          <button className="primary" onClick={onClose}>
            Zurück
          </button>
        </div>
      ) : (
        <footer className="scanner-bottom">
          {status === 'loading' && (
            <>
              <p className="scanner-setup">{spec.setup}</p>
              <span className="view-chip">{viewLabel(spec.view)}</span>
            </>
          )}
          {pose && status === 'running' && !done && (
            <div className={`pose-card ${scan.inPosition ? 'holding' : ''}`}>
              <div className="pose-head">
                <span className="pose-step">
                  Dehnung {(scan.poseIndex ?? 0) + 1}/{STRETCH_POSES.length}
                </span>
                <strong>{pose.name}</strong>
                {pose.view && pose.view !== 'any' && <span className="view-chip small">{viewLabel(pose.view)}</span>}
                <span className="pose-time display">
                  {poseSec}/{STRETCH_POSE_MS / 1000} s
                </span>
              </div>
              <p className="pose-muscles">Dehnt: {pose.muscles}</p>
              <p>{easy && pose.easyHint ? pose.easyHint : pose.hint}</p>
              <span className="pose-bar" aria-hidden>
                <span style={{ width: `${(poseSec / (STRETCH_POSE_MS / 1000)) * 100}%` }} />
              </span>
            </div>
          )}
          {max && reached && !doubled && (
            <p className="scanner-goal" role="status">
              <strong>Geschafft!</strong> Weiter bis 2× für Bonus-XP
            </p>
          )}
          <div className={`scanner-count ${reached ? 'done' : ''} ${doubled ? 'doubled' : ''}`} key={doubled ? 'x2' : reached ? 'x1' : 'x0'}>
            <span className="display big-count">{shownAmount}</span>
            <span className="of">
              von {shownTarget}
              {max && reached && <small>2× · Bonus-XP</small>}
              {stretch && !(max && reached) && <small>Gesamtzeit</small>}
            </span>
          </div>
          {status === 'running' && scan.view && scan.bodyVisible && !wrongShown && (
            <span className="view-chip">{scan.view === 'side' ? 'Von der Seite erkannt' : 'Von vorne erkannt'}</span>
          )}
          <p className={`scanner-status ${scan.bodyVisible && !wrongShown ? 'ok' : ''}`} aria-live="polite">
            {doubled ? 'Doppelt geschafft!' : done ? 'Geschafft!' : statusText}
          </p>
          {allowPartial ? (
            <button className="primary" onClick={() => finish(Math.min(amount, target))} disabled={amount === 0}>
              {amount === 0 ? 'Noch nichts gezählt' : `${shownAmount}${timed ? '' : ' Treffer'} übernehmen`}
            </button>
          ) : max ? (
            doubled ? (
              <p className="scanner-note">Doppelt geschafft, Quest wird abgehakt …</p>
            ) : reached ? (
              <button className="primary" onClick={() => finish(amount)}>
                Fertig
              </button>
            ) : (
              <p className="scanner-note">
                Ab {fmtGoal(target)} ist die Quest geschafft. Machst du weiter, gibt es bis {fmtGoal(max)} mehr XP.
              </p>
            )
          ) : (
            <p className="scanner-note">
              {done ? 'Quest wird abgehakt …' : `Die Quest hakt sich ab, sobald ${timed ? 'die Zeit erreicht ist' : 'alle Wiederholungen gezählt sind'}.`}
            </p>
          )}
        </footer>
      )}
    </div>
  );
}

function draw(canvas: HTMLCanvasElement, video: HTMLVideoElement, lm: Point[] | undefined) {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (!lm) return;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(4, w / 110);
  ctx.strokeStyle = 'rgba(255, 210, 63, 0.9)';
  for (const [a, b] of BONES) {
    const p = lm[a];
    const q = lm[b];
    if ((p.visibility ?? 1) < 0.5 || (q.visibility ?? 1) < 0.5) continue;
    ctx.beginPath();
    ctx.moveTo(p.x * w, p.y * h);
    ctx.lineTo(q.x * w, q.y * h);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff4f7b';
  for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    const p = lm[i];
    if ((p.visibility ?? 1) < 0.5) continue;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, Math.max(5, w / 90), 0, Math.PI * 2);
    ctx.fill();
  }
}
