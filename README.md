# 123go.taxi

*Hold on to your hat. Paste a place, get a QR, share it easily.*

**123go.taxi** is a fully open-source web app ([MIT](LICENSE)) that turns an address into a QR code that a taxi driver can scan to start navigation in their own app: Google Maps, Yandex, Waze, Apple Maps or any other.

> Status: early development. See [PLAN.md](PLAN.md) for the roadmap.

## How it works

1. **You** paste a Google Maps, Yandex, Apple Maps or OpenStreetMap link (short `maps.app.goo.gl` links too, even with the place name the Maps app puts in front), type an address and pick it from the list, or type coordinates such as `29.979235, 31.134202`. A QR is only ever made from a link, coordinates, or a place picked from the list, never from guessed words. The QR code appears straight away, with the readable address above it. Add up to 4 stops and drag them into order for a multi-stop ride.
2. Show the QR, share the link, or download it as a PNG. Save places on your device, with a private name and note, and export or import the list.
3. **The driver** scans it with the phone's camera, or with **Scan** in 123go.taxi itself, and the route starts in their navigation app.

The QR code points to a 123go.taxi page, not straight to one app, so app support can improve without reprinting codes. That page lists the apps. Once a phone has a navigation app chosen ("Open this app directly next time" on that page, or **Your navigation app** on the main page), a scan opens it directly; untick "Open it directly" to see the list again.

**Install it:** the main page has an **Install 123go.taxi** button (on iPhone: Share, then "Add to Home Screen"), so it sits on the home screen like an app. No store, no account.

## Privacy

- No accounts, no database, no analytics, no cookies.
- **One outside lookup:** to show a readable address, the phone making the QR sends the final stop's coordinates (nothing else) to [Photon](https://photon.komoot.io), an open OpenStreetMap address service. The address then travels inside the QR, so the driver's phone looks nothing up.
- **Typed addresses:** when you type words (not a link or coordinates) in "Where to?", those words go to Photon to list matching places. Nothing else goes with them.
- **Short map links only:** if you paste a short link such as `maps.app.goo.gl/…`, that link (nothing else) goes to our tiny link expander on Cloudflare (`worker/`), which returns the long link holding the coordinates. When Google's long link only carries an address, the expander looks that address up in Photon itself. It stores and logs nothing. Long links, addresses and coordinates never go there.
- QR codes are generated in your browser, and **Scan** reads them on your phone: camera images never leave it.
- **The coordinates are part of the QR link.** Anyone who scans the code sees the location. For a home address, consider pinning a nearby corner instead.
- Saved places, names and notes stay in your browser (`localStorage`) and never go into the QR code or anywhere else.
- The chosen navigation app is stored only in that phone's browser. Pick "Ask every time" to clear it.
- The published page's Content-Security-Policy forbids it from sending data to any server other than that address lookup and the link expander.

## Development

Requires Node.js 24 (see `.nvmrc`).

```sh
npm install
npm run dev        # local dev server
npm test           # unit tests
npm run test:e2e   # browser smoke tests (first run: npx playwright install chromium)
npm run lint
npm run build      # static site in dist/
```

The short-link expander in `worker/` is a Cloudflare Worker, live at `https://123go-expand.123go-taxi.workers.dev`. Deploy it with `npx wrangler@4 deploy --config worker/wrangler.toml`.

## Self-hosting

It's a static site: build it and serve `dist/` from anywhere. Two build-time settings:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_PUBLIC_URL` | `https://123go.taxi` | Address that QR codes point to. |
| `BASE_PATH` | `/` | Sub-path if the site isn't at the root of its domain, e.g. `/123gotaxi/`. |

## Credits

Addresses © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, looked up with [Photon](https://github.com/komoot/photon) by komoot. QR reading on iPhone with [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0).

## Contact

Questions, ideas or bug reports: open an issue, or write to [0xhorizonxyz@gmail.com](mailto:0xhorizonxyz@gmail.com).

## License

[MIT](LICENSE)
