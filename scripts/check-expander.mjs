// Daily check of the live link expander with real short links shared from
// Google Maps. Google changes its answers without notice (the "?g_st" tag,
// address-only links, cookie pages...), so this catches it before users do.
// Run: node scripts/check-expander.mjs   (exits 1 if any link fails)

const EXPANDER = 'https://123go-expand.123go-taxi.workers.dev';
/** How far the answer may be from the real place, in metres. */
const TOLERANCE_M = 300;

// Real links from our own phones (Android app, iPhone app, desktop), with where they really are.
const BATON_ROUGE = { lat: 45.397038, lon: -71.942085 };
const OZDILEK = { lat: 41.0773612, lon: 29.011635 };
const CASES = [
  { link: 'https://maps.app.goo.gl/42vbXakpmaLpAsuD9?g_st=ac', place: BATON_ROUGE, note: 'mobile, with ?g_st' },
  { link: 'https://maps.app.goo.gl/r6ssFsMEZsTXLkoDA', place: BATON_ROUGE, note: 'mobile, address only' },
  { link: 'https://maps.app.goo.gl/vU2dmEkDJhSTsGqG6', place: BATON_ROUGE, note: 'mobile' },
  { link: 'https://maps.app.goo.gl/inhRMpVNq3GiVe456', place: BATON_ROUGE, note: 'desktop' },
  { link: 'https://maps.app.goo.gl/VytxARA1gNn8LKZ38?g_st=ac', place: OZDILEK, note: 'iPhone, Istanbul' },
];

/** Coordinates in a long Google link: the exact pin first, then the map centre or ?q=. */
function coordinates(link) {
  const text = decodeURIComponent(link);
  const match =
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(text) ??
    /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(text) ??
    /[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(text);
  return match ? { lat: Number(match[1]), lon: Number(match[2]) } : null;
}

function metres(a, b) {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.round(Math.sqrt(x * x + y * y) * 6371000);
}

async function check({ link, place }) {
  const response = await fetch(`${EXPANDER}/expand?url=${encodeURIComponent(link)}`, {
    headers: { origin: 'https://123go.taxi' },
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return `HTTP ${response.status} ${JSON.stringify(body)}`;
  const found = coordinates(body.url ?? '');
  if (!found) return `no coordinates in ${body.url}`;
  const off = metres(found, place);
  return off <= TOLERANCE_M ? null : `${off} m away (${found.lat}, ${found.lon})`;
}

let failed = 0;
for (const test of CASES) {
  // One retry: a single slow answer from Google isn't worth an alarm.
  let problem = await check(test).catch((error) => String(error));
  if (problem) {
    await new Promise((resolve) => setTimeout(resolve, 30000));
    problem = await check(test).catch((error) => String(error));
  }
  console.log(`${problem ? 'FAIL' : 'ok  '} ${test.link} (${test.note})${problem ? `: ${problem}` : ''}`);
  if (problem) failed++;
}
if (failed) {
  console.error(`\n${failed} of ${CASES.length} short links no longer expand correctly.`);
  process.exit(1);
}
