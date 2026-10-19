# gogogo.rodeo — Implementation plan

*For a smooth ride — or it might get rocky, but at least it started smoothly.*

Status: **draft, waiting for product-owner approval.** Nothing is built yet.

---

## 1. What we're building, in one paragraph

A static website with two faces on the same address:

- **Create page** (`https://gogogo.rodeo/`): the passenger searches for or pastes a place, drags a pin to the exact entrance, and gets a QR code to show, download or print.
- **Destination page** (`https://gogogo.rodeo/#v=1&lat=…&lon=…&n=…`): what the driver sees after scanning. It shows the name, a small map and big "Open with" buttons for Google Maps, Yandex, Waze, Apple Maps and "Other app". It can remember the driver's choice.

No server code, no database, no accounts, no analytics. Everything runs in the browser.

---

## 2. Tech stack (and why)

| Piece | Choice | Why |
|---|---|---|
| Language | **TypeScript**, no UI framework | The app has two screens and a handful of buttons. React/Vue would add weight and complexity without paying for itself. |
| Build tool | **Vite** | Fast, simple, produces plain static files. The current standard. |
| Map | **MapLibre GL JS** + **OpenFreeMap** tiles | OpenFreeMap is free, needs no API key, has no request limits, allows commercial use and needs no cookies. It only requires the "© OpenStreetMap" credit, which MapLibre shows automatically. The map is loaded only when needed, so the first screen stays fast. |
| QR code | **`qrcode`** (node-qrcode) | Mature, widely used, works offline in the browser, outputs canvas (for PNG) and SVG (for crisp print). |
| Tests | **Vitest** (unit) + **Playwright** (a few end-to-end smoke tests in a headless browser) | Vitest is the natural partner of Vite. Playwright catches "the page doesn't load" mistakes before deploy. |
| Hosting | **GitHub Pages**, deployed by GitHub Actions | Code, CI and hosting all live in one place. Free, HTTPS included, custom-domain support is built in. Cloudflare Pages is a fine alternative but needs your DNS moved to Cloudflare for the bare `gogogo.rodeo` address to work well. |

Rough page weight goal: create page under ~100 KB before the map loads; map adds ~250 KB, loaded on demand.

---

## 3. Repository structure

```
gogogo-rodeo/
├── README.md  LICENSE  CONTRIBUTING.md  PLAN.md
├── index.html                  # single entry; decides create vs destination
├── public/
│   ├── CNAME                   # "gogogo.rodeo" for GitHub Pages
│   └── favicon, og-image, robots.txt
├── src/
│   ├── config.ts               # BASE_URL = "https://gogogo.rodeo" + provider choice (one place)
│   ├── main.ts                 # router: params present → destination page, else create page
│   ├── destination-url/        # build + parse our own #v=1&lat=… URLs (versioned)
│   ├── geocoding/              # GeocodingProvider interface + photon.ts, geoapify.ts adapters
│   ├── navigation-links/       # google.ts, yandex.ts, waze.ts, apple.ts, geo.ts
│   ├── link-parsing/           # pull coordinates out of pasted Google / Yandex / OSM / Apple links
│   ├── qr/                     # render, PNG download, print / taxi-card layout
│   ├── preferences/            # remembered app, "ask every time", forget-me
│   ├── map/                    # lazy-loaded MapLibre wrapper, draggable pin
│   ├── pages/                  # create.ts, destination.ts
│   ├── saved-places/           # places saved in this browser only
│   └── styles/
├── tests/
│   ├── unit/                   # link builders, parsers, URL format, preferences
│   └── e2e/                    # Playwright smoke tests
├── docs/
│   ├── DNS-SETUP.md            # step-by-step domain guide for you
│   └── MANUAL-SCAN-CHECKLIST.md
└── .github/workflows/
    ├── ci.yml                  # typecheck, lint, unit + e2e tests on every push/PR
    └── deploy.yml              # build and publish to GitHub Pages on main
```

---

## 4. The QR / destination URL format

```
https://gogogo.rodeo/#v=1&lat=41.0342&lon=28.9844&n=Ev%20-%20Cihangir
```

- Everything sits after `#`. Browsers never send that part to the server, so **the hosting provider never sees or logs any destination**. Old `?lat=` links are still read.

- `v` — format version. Missing `v` is treated as `1`. If we ever change the format we bump to `v=2`, and the page keeps understanding `v=1` forever, so **printed codes never break**.
- `lat`, `lon` — WGS84 decimal degrees, rounded to **5 decimals** (about 1 metre). Enough precision for a door, and it keeps the QR small and easy to scan.
- `n` — optional label, max ~60 characters, standard URL encoding (handles Turkish letters like ş, ğ, İ). Shown on the page as plain text, never as HTML, so a crafted QR can't inject anything.
- Unknown parameters are ignored, so we can add things later without breaking old codes.
- Invalid or out-of-range coordinates show a friendly "This code looks broken" screen instead of crashing.

**Privacy note in the UI:** "Anyone who scans this code can see this exact location. For a home address, consider using a nearby corner or a short label." The label field is optional.

---

## 5. Destination page: auto-redirect vs. chooser

Plain-language rules:

1. **Nothing saved (the default)** → show the chooser: name, mini-map, big app buttons.
2. **Driver previously ticked "Remember my choice on this device"** → show "Opening in Yandex Navigator… [Choose another app]" with a short countdown (about 1.5 s), then open the app. The visible pause gives an easy escape hatch if the remembered app is wrong.
3. **`&choose=1` in the URL, or the driver taps "Choose another app"** → always show the chooser.
4. **"Forget my choice"** link is always on the page; it wipes everything we stored.

Storage: `localStorage` on gogogo.rodeo only (first-party, never sent to any server). We don't use cookies at all, which is simpler and more private than a cookie.

**No-cookies mode:** it's the default. We store nothing unless the driver ticks "Remember". A "Forget everything" button deletes what's there. If the browser blocks storage (private mode, some in-app QR scanners), the remember option is hidden and the chooser always appears.

**Honesty line on the page:** "We can't see which apps are on your phone. Pick one; if it isn't installed, your phone will offer the web version or the app store."

**Caveat worth knowing:** the remembered choice lives in *the browser that opened the QR*. iPhone's camera opens Safari, so that's consistent. Some Android scanners open their own mini-browser, which may forget. We'll test this on real phones.

---

## 6. Navigation links

Checked against official docs this week. Each will be re-verified with a unit test plus a real-phone test before launch.

| App | Link | Status |
|---|---|---|
| Google Maps | `https://www.google.com/maps/dir/?api=1&destination=LAT%2CLON&travelmode=driving&dir_action=navigate` | Official docs confirmed. The comma must be encoded. `dir_action=navigate` starts turn-by-turn directly. |
| Waze | `https://waze.com/ul?ll=LAT,LON&navigate=yes&utm_source=gogogo.rodeo` | Official docs confirmed (updated June 2026). `utm_source` is recommended by Waze, not required. |
| Apple Maps | `https://maps.apple.com/?daddr=LAT,LON&dirflg=d` | Long-standing format. Apple recently published "unified Maps URLs"; I'll confirm on a real iPhone and switch to the newer form if it's better. |
| Yandex Maps (web/app) | `https://yandex.com.tr/maps/?rtext=~LAT,LON&rtt=auto` | Opens the Yandex Maps app when installed, otherwise the website. Using the `.com.tr` domain suits Istanbul. |
| Yandex Navigator | Android: `intent://build_route_on_map?lat_to=LAT&lon_to=LON#Intent;scheme=yandexnavi;package=ru.yandex.yandexnavi;S.browser_fallback_url=…;end` · iPhone: `yandexnavi://build_route_on_map?lat_to=LAT&lon_to=LON` | **Weakest link.** Yandex's public docs for this are thin. On Android, the `intent://` form falls back cleanly to the web if Navigator is missing. On iPhone, a missing app gives an error, so we label it clearly. Needs real-phone testing. |
| Other app (Android) | `geo:LAT,LON?q=LAT,LON(Label)` | Triggers Android's "open with" chooser (Google Maps, Yandex, Waze, 2GIS…). Shown only on Android; iPhone doesn't support `geo:`. |

---

## 7. Search and autocomplete (geocoding)

**Hard rule:** no public OSM Nominatim server for autocomplete. Its policy explicitly forbids "auto-complete search" from client apps.

**v1 recommendation: Photon** (komoot's public server, `photon.komoot.io`)
- Built for search-as-you-type on OpenStreetMap data. Free, no key, no account.
- Limits: "reasonable use", no published number, no uptime guarantee. Fine for a small community project. Not fine if we suddenly get thousands of users.
- Coverage of Istanbul streets, buildings and POIs is good. Business coverage is weaker than Google's, because it depends on what's mapped in OSM.

**Fallback / upgrade path: Geoapify** (commercial, OSM-based)
- Free plan: 3,000 requests a day, commercial use allowed, attribution required ("Powered by Geoapify").
- Needs an API key. On a static site the key is visible to anyone, so we restrict it to the gogogo.rodeo domain in Geoapify's dashboard. Paid plans start if we outgrow the free tier.
- Switching is a one-line change in `config.ts`. Self-hosters can also point Photon at their own server.

**How we stay polite:**
- Wait until the user pauses typing (~300 ms) and has typed at least 3 characters.
- Cancel requests that are out of date.
- Cache results for the session.
- Bias results toward the map's current view (Istanbul by default).
- Show the provider's attribution under the suggestions.

**Pin confirmation:** picking a suggestion drops a pin. The user drags it to the exact door. The QR is only generated after "Use this spot". Optionally we show the nearest address of the dragged pin (reverse geocoding, same provider, one request per drag-end).

**Other inputs:**
- Paste a link. We parse Google Maps (`@lat,lon`, `?q=lat,lon`, `!3d…!4d…`), Yandex (`ll=` *(note: lon,lat order!)*, `pt=`, `rtext=`), OSM, Apple Maps and `geo:` links.
- **Limitation:** short links like `maps.app.goo.gl/…` or `yandex.com.tr/maps/-/…` hide the coordinates behind a redirect, and a static site can't follow it (the browser blocks it). We'll show: "Short link detected. Open it, then copy the long link from the address bar," with a pictured hint. A tiny optional "link-expander" serverless function could solve this later. That's an open question for you below.
- Raw lat/lon in any common format (`41.0342, 28.9844`, with or without degree signs).

---

## 8. Output

- Live QR preview (error correction level "Q", which survives a bit of dirt or creases on a printed card).
- **Download PNG** (high resolution).
- **Print**: a print-only stylesheet for a clean page.
- **Taxi card**: a business-card-sized layout with the QR, label, "Scan to navigate / Taramak için okutun" and the slogan. Printed via the browser's "Save as PDF", so we don't need a PDF library.
- Copy link / native Share button on phones.

---

## 9. Language and accessibility

- **English only** (decision 2026-10-19). People use their browser's built-in translation. Copy stays short and plain so machine translation handles it well.
- Big tap targets, high contrast, keyboard and screen-reader friendly autocomplete (standard "combobox" pattern), and it works without the map if the map fails to load.

---

## 10. Test plan

**Automated (runs on every change in GitHub Actions):**
- Every navigation-link builder: exact expected URLs, label encoding with Turkish characters, edge cases (negative coordinates, 180th meridian).
- Every link parser: a collection of real pasted links from Google, Yandex and Apple, including the tricky Yandex lon,lat order.
- Destination URL: build ⇄ parse round trip, missing `v`, garbage input, overly long labels.
- Preferences: remember, forget, storage blocked.
- Playwright smoke: create page loads, entering coordinates produces a QR, the destination page shows all buttons, a remembered choice redirects.

**Manual real-phone checklist** (`docs/MANUAL-SCAN-CHECKLIST.md`), a tick-box table you can fill in:
- Phones: one Android (recent, plus ideally an older one) and one iPhone.
- Scanners: built-in camera, Google Lens, plus a common third-party scanner app.
- For **each app** (Google Maps, Yandex Maps, Yandex Navigator, Waze, Apple Maps), test both **installed** and **not installed**. Does the right app open, in navigation mode, at the right spot? Does a missing app fall back to web or the store gracefully?
- Remember-choice flow, change, forget. Browser translation (Chrome "Translate to Türkçe") keeps the page usable. Printed card scanned at arm's length in a dim car.
- Run it once on a local preview, then again on the live domain (Milestone 6).

---

## 11. Milestones

Each milestone ends with a commit (or several), green CI, and a short demo note to you.

1. **Scaffold.** Repo, Vite + TS, lint, Vitest, Playwright, CI workflow, MIT licence, README, CONTRIBUTING, config file.
2. **Coordinates → QR.** Raw lat/lon input and pasted-link parsing, destination URL builder, QR preview. No map yet.
3. **Destination page.** "Open with" buttons for all apps, mini-map, remember / ask every time / forget, storage-blocked handling.
4. **Search.** Geocoding interface, Photon adapter (plus Geoapify adapter ready to switch on), autocomplete UI, draggable pin, reverse-geocoded address.
5. **Output & polish.** PNG download, print, taxi card, TR/EN, accessibility pass, privacy notes, favicon/social preview.
6. **Launch.** GitHub Pages deploy, your DNS steps (guide in `docs/DNS-SETUP.md`: apex A/AAAA records, `www` CNAME, the `CNAME` file, "Enforce HTTPS"), then the real-phone checklist on the live domain.

I can set up the live deploy at the end of Milestone 1 on the default `*.github.io` address, so you can try each milestone on your phone as it lands. The custom domain gets switched on at Milestone 6.

---

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Yandex Navigator deep link is poorly documented / behaves differently per OS | Most-used app with Istanbul drivers may be flaky | Use the Yandex Maps universal link as the main "Yandex" button, offer Navigator as a second button, and test on real phones early (Milestone 3, not 6). |
| Photon public server is slow, down or rate-limits us | Search stops working | Provider is swappable in one line; Geoapify adapter ready; raw coords and pasted links always work. |
| Short map links can't be expanded on a static site | Users paste `maps.app.goo.gl` links and get an error | Clear instructions; optional tiny serverless expander later (your call). |
| Some in-app QR scanners block custom schemes or storage | Remember-choice or Navigator button fails in those browsers | Detect blocked storage; prefer `https` links that work everywhere; document in the checklist. |
| Coordinates in the URL reveal a home address | Privacy | Plain warning on the create page; label optional; no logging anywhere (static hosting). |
| Apple changes its Maps URL format | iPhone button breaks | Format is isolated in one file with a test; a fix doesn't require reprinting QR codes (that's the whole point of decision #3). |

---

## 13. Decisions (approved 2026-10-19)

1. Licence: **MIT**.
2. Repo: public `Charles0xhorizonxyz/gogogo-rodeo`.
3. Hosting: **GitHub Pages**.
4. Short links: "copy the long link" instructions for v1; no server piece.
5. Fallback language: **English**.
6. **One-pager:** a single `index.html`. With no parameters it's the create screen; with `lat`/`lon` it's the driver's "Open with" screen.

7. **No translations:** English only; browser translation covers the rest.
8. **Registrar: Njalla.** DNS guide will target Njalla's DNS panel.
9. **Saved places** live only in the browser (`localStorage`), never sent anywhere.
11. **Look: "Bucking Cab"** (Direction C in `docs/design-rodeo.html`): cream, taxi yellow, asphalt black, one light theme. Logo `public/logo.svg`. Fonts self-hosted, no Google requests.
12. **Simplicity over extras:** no passcode on saved places, no history-scrubbing.
13. **Multi-stop journeys** (up to 4 stops): `via=lat,lon~lat,lon` lists earlier stops, `lat`/`lon` stays the final one, so the v1 format is unchanged. Only apps that follow every stop are offered (Google Maps, Yandex Navigator, Yandex Maps).
14. **Driver page stays** (drivers can come back to it and share it). "Put my app first next time" moves the remembered app to the top; no auto-redirect.
15. **Saved places** have an optional name and an optional note. Both are private: they stay on the device and are never put in the QR (the QR carries only the stops). Export/import as a JSON file.
17. **No "Make" button:** the QR appears as soon as a place is pasted or typed. Name and note sit under the QR.
16. Footer: "Made with ♥ by 0xhorizon.xyz". Slogan removed from the page.
10. **Two-tap rule:** passenger pastes or picks → QR appears; driver scans → taps app. Design directions in `docs/design-proposals.html`.

### Privacy model (who can see an address)

| Who | Sees the destination? | Why |
|---|---|---|
| gogogo.rodeo / GitHub (hosting) | **No** | Destination is after `#`, which is never sent to the server. No analytics. |
| Anyone who scans or gets the QR link | Yes | That's the point of the code. The UI warns about home addresses. |
| The nav app the driver picks | Yes | It has to, to route there. |
| Search provider (Photon, from Milestone 4) | What you type into search | Unavoidable for live suggestions. Pasting a link or coordinates sends nothing. Disclosed next to the search box. |
| Map tiles (OpenFreeMap, from Milestone 3) | Roughly which area is on screen | Tiles are fetched per area. No cookies, no key. |
| Saved places | Only this browser | `localStorage`, never transmitted. Clearing browser data deletes them. |

All traffic is HTTPS. There is no gogogo.rodeo server to encrypt *to*: the app never sends the address anywhere itself.

**Enforced, not just promised:**
- The published page carries a Content-Security-Policy with `connect-src 'none'`. The browser itself refuses any attempt by the page to send data to a server, even from a buggy or compromised library. Milestones 3–4 open it only to the named search and map-tile hosts.
- `referrer: no-referrer`, so the nav app isn't told which page sent the driver.
- Automated tests (`tests/e2e/privacy.spec.ts`) fail the build if making or saving a QR causes any network request, if the page can send data out, or if the destination appears in any URL sent to the server.

**Places we can't control, documented for users:** the phone itself (malware, browser extensions), QR-scanner apps that keep a scan history, browser history on the driver's phone (the full link is stored locally), and the nav app the driver picks.

### Why the QR doesn't open the driver's app directly

We considered encoding `geo:LAT,LON` straight into the QR, so the phone would offer its own app list with no web page in between. Rejected because:

- iPhone's camera doesn't understand `geo:` links, so the code would do nothing for iPhone drivers.
- Android scanners are inconsistent. Some offer the app chooser, some show the raw text.
- It would lose the "remember my app" feature and the ability to improve support without reprinting.

The destination page gives the same result in one tap. On Android it also has an **"Other app"** button that fires `geo:`, which brings up the phone's own chooser.
