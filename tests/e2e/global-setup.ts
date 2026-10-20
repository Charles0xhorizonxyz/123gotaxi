// Make a fake camera video showing a 123go.taxi QR, for the in-app scanner test.
// Chromium plays it as the camera (see playwright.config.ts).
import { writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

export const SCAN_TEXT = 'https://123go.taxi/#v=1&lat=11.15&lon=40.58&n=Lucy';
export const FAKE_CAMERA = 'tests/e2e/.fake-camera.y4m';

export default function globalSetup(): void {
  const width = 640;
  const height = 480;
  const { modules } = QRCode.create(SCAN_TEXT, { errorCorrectionLevel: 'M' });
  const cell = Math.floor((height * 0.8) / (modules.size + 8));
  const side = cell * (modules.size + 8);
  const left = Math.floor((width - side) / 2);
  const top = Math.floor((height - side) / 2);

  // White picture, black modules (with a 4-module quiet zone).
  const luma = Buffer.alloc(width * height, 235);
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (!modules.get(y, x)) continue;
      for (let dy = 0; dy < cell; dy++) {
        const row = (top + (y + 4) * cell + dy) * width;
        luma.fill(16, row + left + (x + 4) * cell, row + left + (x + 5) * cell);
      }
    }
  }
  const chroma = Buffer.alloc((width / 2) * (height / 2) * 2, 128);
  writeFileSync(
    FAKE_CAMERA,
    Buffer.concat([
      Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\nFRAME\n`),
      luma,
      chroma,
    ]),
  );
}
