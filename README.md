# 123go.taxi

*Paste a place. Get a QR. Share it. Go!*

**123go.taxi** is a fully open-source web app ([MIT](LICENSE)) that turns an address into a QR code that a taxi driver can scan to start navigation in their own app: Google Maps, Yandex, Waze, Apple Maps or any other.

> Status: live at [123go.taxi](https://123go.taxi), in field testing. What works, how it runs and what comes next: [PLAN.md](PLAN.md).

## How it works

1. **You** paste a Google Maps, Yandex, Waze, Apple Maps or OpenStreetMap link (short `maps.app.goo.gl` links too, even with the place name the Maps app puts in front), type an address and pick it from the list, or type coordinates such as `29.979235, 31.134202`. Everything map apps offer to copy works too: degrees-minutes-seconds (`40°59'01.8"N 29°02'19.9"E`), Plus Codes (`8GGFX2MQ+GG`), OpenStreetMap short links (`osm.org/go/…`), Organic Maps links (`omaps.app/…`), UTM and MGRS, all decoded on the phone. A QR is only ever made from a link, coordinates, or a place picked from the list, never from guessed words. The QR code appears straight away, with the readable address above it. Add up to 4 stops and drag them into order for a multi-stop ride.
2. Show the QR, share the link, or download it as a PNG. Save places on your device, with a private name and note, and export or import the list.
3. **The driver** scans it with the phone's camera, or with **Scan** in 123go.taxi itself, and the route starts in their navigation app. Driving yourself? **Open in navigation** opens it in yours.

The QR code points to a 123go.taxi page, not straight to one app, so app support can improve without reprinting codes. That page lists the apps. Once a phone has a navigation app chosen ("Open this app directly next time" on that page, or **Your navigation app** on the main page), a scan opens it straight away (it can be changed any time).

**For restaurants, hotels and other places:** make the QR for your address, tap **Put it on your website**, type your place's name (it goes into the QR, so guests and drivers see it), pick the language, and copy the ready-made **Reach us with 123go.taxi** card (the words over the QR) onto your Contact or Getting here page. Guests tap it on a phone or scan it on a computer, and your place lands in their list, ready for the driver. Send places the one-pager in six languages: **[123go.taxi/onmysite/](https://123go.taxi/onmysite/)**. Step-by-step guide, including exact instructions an AI assistant can follow: [docs/ADD-TO-YOUR-WEBSITE.md](docs/ADD-TO-YOUR-WEBSITE.md).

**Navigation apps:** the *Your navigation app* menu lists Google Maps, Yandex Navigator and Maps, Waze, Apple Maps, 2GIS, Mapy.com, Organic Maps, OsmAnd and HERE WeGo, plus the ride apps **Uber** and **Yandex Go** to book a ride there (and on Android **Bolt**, **BiTaksi** and **Citymapper**, which take the location directly) (each with the link its maker documents), ready to use. Handy to send a friend a destination they book themselves. On Android, **Other app on this phone** opens any installed navigation app. Afterwards, if you like, [suggest your app on GitHub](https://github.com/Charles0xhorizonxyz/123gotaxi/issues/new?template=app-suggestion.yml) so it becomes a button for everyone.

**Languages:** English, Français, Türkçe, Deutsch, Español and Русский. The site follows the phone's language the first time; the **文A** button in the bottom-right corner changes it. All the words live in `src/i18n/index.ts`: add a language there and the build checks nothing is missing.

**Install it:** the round download button in the bottom-right corner installs it (on iPhone: Share in Safari's toolbar, then "Add to Home Screen"), so it sits on the home screen like an app. No store, no account.

## Privacy

- No accounts, no database, no analytics, no cookies.
- **Address lookups:** to show a readable address, the phone making the QR sends the final stop's coordinates (nothing else) to [Geoapify](https://www.geoapify.com), a German OpenStreetMap address service under EU privacy law, or, if Geoapify is slow or unavailable, to [Photon](https://photon.komoot.io), komoot's open one. The address then travels inside the QR, so the driver's phone looks nothing up.
- **Typed addresses:** when you type words (not a link or coordinates) in "Where to?", those words go to the same address service (Geoapify, or Photon as backup) to list matching places. Nothing else goes with them.
- **Short map links only:** if you paste a short link such as `maps.app.goo.gl/…`, that link (nothing else) goes to our tiny link expander on Cloudflare (`worker/`), which returns the long link holding the coordinates. When Google's long link only carries an address, the expander looks that address up itself, in OpenStreetMap's address services (Photon and Nominatim). It stores and logs nothing. Long links, addresses and coordinates never go there.
- QR codes are generated in your browser, and **Scan** reads them on your phone: camera images never leave it.
- **The coordinates are part of the QR link.** Anyone who scans the code sees the location. For a home address, consider pinning a nearby corner instead.
- Saved places, names and notes stay in your browser (`localStorage`) and never go into the QR code or anywhere else.
- **Opened QRs are kept on that phone.** Any 123go.taxi QR opened on a phone (camera, Scan, or a tapped link) is added to *Your places* as **New**, with ✓ to keep it and ✕ to remove it. That includes a driver's phone, which keeps the places its driver scans until removed. It stays on that phone only.
- The chosen navigation app is stored only in that phone's browser.
- The published page's Content-Security-Policy forbids it from sending data to any server other than those address services and the link expander.

## Development

Requires Node.js 24 (see `.nvmrc`).

```sh
npm install
npm run dev        # local dev server
npm test           # unit tests
npm run test:e2e   # browser smoke tests (first run: npx playwright install chromium)
npm run lint
npm run build      # static site in dist/
npm run iphone     # the live site in Safari's engine (WebKit), iPhone 15 size (first run: npx playwright install webkit)
```

The short-link expander in `worker/` is a Cloudflare Worker, live at `https://123go-expand.123go-taxi.workers.dev`. Deploy it with `npx wrangler@4 deploy --config worker/wrangler.toml`.

## Self-hosting

It's a static site: build it and serve `dist/` from anywhere. Two build-time settings:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_PUBLIC_URL` | `https://123go.taxi` | Address that QR codes point to. |
| `BASE_PATH` | `/` | Sub-path if the site isn't at the root of its domain, e.g. `/123gotaxi/`. |

The Geoapify key in `src/config.ts` only works from 123go.taxi. When self-hosting, put your own free key there, or leave it empty to use Photon alone.

## Credits

Addresses © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, looked up with [Geoapify](https://www.geoapify.com) and [Photon](https://github.com/komoot/photon) by komoot. QR reading on iPhone with [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0).

## Contact

Questions, ideas or bug reports: open an issue, or write to [0xhorizonxyz@gmail.com](mailto:0xhorizonxyz@gmail.com).

## License

[MIT](LICENSE)
