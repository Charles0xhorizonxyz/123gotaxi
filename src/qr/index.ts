import QRCode from 'qrcode';

const QR_OPTIONS = {
  // "Q" still scans with ~25% of the code damaged: creases, dirt, glare.
  errorCorrectionLevel: 'Q',
  margin: 2,
  color: { dark: '#000000', light: '#ffffff' },
} as const;

export async function drawQr(canvas: HTMLCanvasElement, text: string, size = 320): Promise<void> {
  await QRCode.toCanvas(canvas, text, { ...QR_OPTIONS, width: size });
}

/** A high-resolution PNG for printing, as an object URL the caller must revoke. */
export async function qrPngUrl(text: string, size = 1024): Promise<string> {
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, text, { ...QR_OPTIONS, width: size });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not create the PNG.');
  return URL.createObjectURL(blob);
}

export function pngFileName(label: string | undefined): string {
  const slug = (label ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `gogogo-${slug || 'destination'}.png`;
}
