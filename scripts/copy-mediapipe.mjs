// Copies the MediaPipe WebAssembly runtime into public/ so the app works offline
// (the Android app has no internet requirement for the camera counter).
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const dest = join(root, 'public/mediapipe');
mkdirSync(dest, { recursive: true });
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) copyFileSync(join(src, f), join(dest, f));
console.log('MediaPipe runtime copied to public/mediapipe');
