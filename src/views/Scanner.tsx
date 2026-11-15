// Camera rep counter: the phone watches you and counts the reps itself.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { SCANNABLE, initialScan, scanAmount, step, type Point, type ScanState } from '../pose';
import { Icon } from './Icons';

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

export function Scanner(props: {
  exerciseId: string;
  title: string;
  target: number;
  unit: string;
  allowManual: boolean;
  onDone: (amount: number) => void;
  onManual?: () => void;
  onClose: () => void;
}) {
  const { exerciseId, title, target, unit, allowManual, onDone, onManual, onClose } = props;
  const spec = SCANNABLE[exerciseId];
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanRef = useRef<ScanState>(initialScan(exerciseId));
  const [scan, setScan] = useState<ScanState>(scanRef.current);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const finished = useRef(false);

  const amount = scanAmount(scan);
  const done = amount >= target;

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
            scanRef.current = step(scanRef.current, lm, now, aspect);
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
  }, [facing]);

  // Reaching the target: short celebration, then hand the result back.
  useEffect(() => {
    if (!done || finished.current) return;
    navigator.vibrate?.([60, 40, 60]);
    const t = window.setTimeout(() => finish(target), 1300);
    return () => window.clearTimeout(t);
  }, [done, finish, target]);

  // A small buzz for every counted rep.
  const lastReps = useRef(0);
  useEffect(() => {
    if (scan.reps > lastReps.current) navigator.vibrate?.(25);
    lastReps.current = scan.reps;
  }, [scan.reps]);

  const statusText =
    status === 'loading'
      ? 'Kamera startet …'
      : !scan.bodyVisible
        ? 'Stell dich so hin, dass du ganz zu sehen bist'
        : spec.kind === 'hold'
          ? scan.inPosition
            ? 'Halten!'
            : 'Geh in Position'
          : scan.phase === 'down'
            ? 'Und wieder hoch'
            : 'Los geht’s';

  return (
    <div className="scanner" role="dialog" aria-modal="true" aria-label={`${title} mit Kamera zählen`}>
      <div className={`scanner-stage ${facing === 'user' ? 'mirrored' : ''}`}>
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} />
      </div>

      <header className="scanner-top">
        <button className="scanner-icon-btn" onClick={onClose} aria-label="Schließen">
          <Icon name="close" size={20} />
        </button>
        <div className="scanner-title">
          <strong>{title}</strong>
          <span>{spec.cue}</span>
        </div>
        <button className="scanner-icon-btn" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} aria-label="Kamera wechseln">
          <Icon name="swap" size={20} />
        </button>
      </header>

      {status === 'error' ? (
        <div className="scanner-panel">
          <p>{error}</p>
          {allowManual && onManual && (
            <button className="secondary" onClick={onManual}>
              Ohne Kamera abhaken
            </button>
          )}
          <button className="primary" onClick={onClose}>
            Zurück
          </button>
        </div>
      ) : (
        <footer className="scanner-bottom">
          {status === 'loading' && <p className="scanner-setup">{spec.setup}</p>}
          <div className={`scanner-count ${done ? 'done' : ''}`}>
            <span className="display big-count">{amount}</span>
            <span className="of">
              von {target} {spec.kind === 'hold' ? 'Sek.' : unit}
            </span>
          </div>
          <p className={`scanner-status ${scan.bodyVisible ? 'ok' : ''}`} aria-live="polite">
            {done ? 'Geschafft!' : statusText}
          </p>
          <div className="row">
            {allowManual && onManual && (
              <button className="secondary" onClick={onManual}>
                Ohne Kamera
              </button>
            )}
            <button className="primary grow" onClick={() => finish(Math.min(amount, target))} disabled={amount === 0}>
              {amount === 0 ? 'Noch nichts gezählt' : `${amount} übernehmen`}
            </button>
          </div>
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
