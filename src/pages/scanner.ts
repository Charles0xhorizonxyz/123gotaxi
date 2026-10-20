// "Scan a QR": the phone's camera, read on the phone. No frame ever leaves it.
// Android Chrome has a built-in QR reader (BarcodeDetector). Elsewhere, the
// small jsQR library is loaded from our own site the first time it's needed.

import { h } from '../dom';
import { t } from '../i18n';

/** What the page did with a scanned text: done (close), or a reason to keep looking. */
export type ScanOutcome = { done: true } | { done: false; message: string };

type Reader = (video: HTMLVideoElement) => Promise<string | null>;

/** Look at about seven frames a second: quick to react, light on the battery. */
const FRAME_INTERVAL_MS = 150;
/** jsQR reads a smaller copy of the frame; plenty for a QR filling the viewfinder. */
const MAX_FRAME_SIDE = 640;

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
interface DetectorClass {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
}

async function createReader(): Promise<Reader> {
  const Native = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  if (Native && (await Native.getSupportedFormats().catch((): string[] => [])).includes('qr_code')) {
    const detector = new Native({ formats: ['qr_code'] });
    return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  return async (video) => {
    const scale = Math.min(1, MAX_FRAME_SIDE / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    if (!canvas.width || !canvas.height) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}

function cameraError(error: unknown): string {
  const name = (error as Error | undefined)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return t.cameraBlocked;
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return t.noCamera;
  return t.cameraFailed;
}

/** The round "Scan" button for the header. */
export function scanButton(onScan: (text: string) => ScanOutcome): HTMLButtonElement {
  const button = h('button', { type: 'button', class: 'scan-button', 'aria-label': t.scanAria });
  // Static markup, no user data: a QR corner frame.
  button.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><rect x="7.5" y="7.5" width="9" height="9" rx="1" fill="currentColor" stroke="none"/></svg>`;
  button.append(h('span', {}, t.scan));
  button.addEventListener('click', () => void openScanner(onScan));
  return button;
}

async function openScanner(onScan: (text: string) => ScanOutcome): Promise<void> {
  const video = h('video', { class: 'scan-video', muted: true, playsInline: true, autoplay: true });
  video.setAttribute('playsinline', '');
  const message = h('p', { class: 'scan-message', role: 'status' }, t.startingCamera);
  const close = h('button', { type: 'button', class: 'scan-close' }, t.close);
  const dialog = h(
    'dialog',
    { class: 'scanner', 'aria-label': t.scanAria },
    video,
    h('div', { class: 'scan-frame', 'aria-hidden': 'true' }, h('span', { class: 'scan-line' })),
    h('header', { class: 'scan-top' }, h('h2', {}, t.scanTitle)),
    h('div', { class: 'scan-bottom' }, message, close),
  );
  document.body.append(dialog);
  dialog.showModal();

  let stream: MediaStream | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastRejected = '';
  let closed = false;

  function stop(): void {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    stream?.getTracks().forEach((track) => track.stop());
    if (dialog.open) dialog.close();
    dialog.remove();
  }
  close.addEventListener('click', stop);
  dialog.addEventListener('close', stop);

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    if (closed) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    video.srcObject = stream;
    await video.play();
  } catch (error) {
    message.textContent = cameraError(error);
    dialog.classList.add('failed');
    return;
  }

  let read: Reader;
  try {
    read = await createReader();
  } catch {
    message.textContent = t.noQrReader;
    dialog.classList.add('failed');
    return;
  }
  message.textContent = t.pointAt;

  const tick = async (): Promise<void> => {
    if (closed) return;
    const text = video.readyState >= 2 ? await read(video).catch(() => null) : null;
    if (closed) return;
    if (text && text !== lastRejected) {
      const outcome = onScan(text);
      if (outcome.done) {
        navigator.vibrate?.(60);
        stop();
        return;
      }
      lastRejected = text;
      message.textContent = outcome.message;
    }
    timer = setTimeout(() => void tick(), FRAME_INTERVAL_MS);
  };
  void tick();
}
