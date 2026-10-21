# 123go.taxi: where it stands

Live at **https://123go.taxi** since 2026-10-19, first real ride with a taxi driver on 2026-10-20. Now in field testing. The first plan, kept as history: [docs/ORIGINAL-PLAN.md](docs/ORIGINAL-PLAN.md).

## What works today

**Making a QR ("Where to?")**
- Type an address or a place name and pick it from the list (Geoapify, with Photon as backup).
- Paste anything map apps share: Google Maps (long and short links, with or without `?g_st`, address-only links), Yandex, Waze, Apple Maps, OpenStreetMap, Organic Maps, `geo:` links, plain coordinates, degrees-minutes-seconds, Plus Codes, UTM, MGRS, and whole shared texts with a name in front.
- Up to 4 stops, dragged into order. A QR is only ever made from a link, coordinates or a picked place.
- Scan a QR with the camera inside the app.

**Using it**
- Save, share, download as PNG, or **Open in navigation** for yourself.
- **Your places**: saved on the phone, with a private name and note; every 123go.taxi QR opened on a phone is added as *New* (✓ keep, ✕ remove). Export and import.
- **Your navigation app**: pick one and a scanned QR opens it straight away; "Ask every time" shows the list. **More apps on this phone** adds 2GIS, Mapy.com, Organic Maps, OsmAnd, HERE WeGo; missing ones are suggested through a GitHub form (label *app suggestion*).
- Six languages (English, Français, Türkçe, Deutsch, Español, Русский), chosen from the phone, changed with 文A.
- Install on the home screen (keeps the list for good on iPhone), share the app, all from the corner buttons.

**For places**
- "Put it on your website": a *Reach us with 123go.taxi* card (words over the QR) in six languages, with the place's public name in the QR.
- One-pager to send them: **https://123go.taxi/onmysite/**. Exact guide for web designers and AI assistants: [docs/ADD-TO-YOUR-WEBSITE.md](docs/ADD-TO-YOUR-WEBSITE.md), and `/llms.txt`.

## How it runs

| Piece | Where | Notes |
|---|---|---|
| The site | GitHub Pages, from `main` | Every push is tested (unit + browser tests on iPhone and Android sizes) before it goes live. |
| Domain | `123go.taxi` at Njalla | Guide: [docs/DNS-SETUP.md](docs/DNS-SETUP.md). |
| Short-link expander | Cloudflare Worker `worker/` | `https://123go-expand.123go-taxi.workers.dev`. Deploy: `npx wrangler@4 deploy --config worker/wrangler.toml`. |
| Address search and lookup | Geoapify (free plan, 3,000 a day), Photon as backup | Key in `src/config.ts`, only accepted from `https://123go.taxi`. Watch usage in the Geoapify dashboard. |
| Daily check | GitHub Actions, 09:00 Istanbul | Real Google short links through the live expander; GitHub emails on failure. |
| Backup | The Bay backup system | Private mirror `123gotaxi-backup`. The folder must stay at `Documents\123gotaxi`. |

## Decisions worth remembering

- **Privacy first.** No accounts, no analytics, no cookies, no server of our own. Destinations stay after `#` in links, so no server sees them. The page's security rules only let it talk to the address services and the expander.
- **Simplicity first.** Few buttons, short text, explanations behind "?".
- **Opened QRs are kept on that phone, drivers' phones included** (chosen knowingly over "named places only"). The README says so.
- **Public names only when a place publishes them.** A personal QR never carries the name or note.

## Next

1. **Field test on real phones** with the [field-test page](https://claude.ai/artifact/WVPHi9DazdGoudcmZs94aB): opening the app without a tap on Android, Yandex Navigator, Scan and Install on iPhone, the new formats and languages.
2. **Native speakers** check the translations, Turkish and Russian first.
3. **Pilot with 3 to 5 places** in Istanbul using the one-pager; ask them how it went (the site counts nothing).
4. Then, depending on what testing shows: working offline (opens without signal; also helps installing), short Plus Codes with a town ("X2MQ+GG Istanbul").
