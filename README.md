# 123go.taxi

*For a smooth ride — or it might get rocky, but at least it started smoothly.*

**123go.taxi** is a fully open-source web app ([MIT](LICENSE)) that turns an address into a QR code that a taxi driver can scan to start navigation in their own app: Google Maps, Yandex, Waze, Apple Maps or any other.

> Status: early development. See [PLAN.md](PLAN.md) for the roadmap.

## How it works

1. **You** paste a Google Maps, Yandex, Apple Maps or OpenStreetMap link, or type coordinates. The QR code appears straight away. Add up to 4 stops and drag them into order for a multi-stop ride.
2. Show the QR, share the link, or download it as a PNG. Save places on your device, with a private name and note, and export or import the list.
3. **The driver** scans it, taps their navigation app, and the route starts.

The QR code points to a 123go.taxi page, not straight to one app. That page lists the apps, so app support can improve without reprinting codes. Drivers can tick "Put my app first next time".

## Privacy

- No accounts, no database, no analytics, no cookies.
- **One outside lookup:** to show a readable address, the phone making the QR sends the final stop's coordinates (nothing else) to [Photon](https://photon.komoot.io), an open OpenStreetMap address service. The address then travels inside the QR, so the driver's phone looks nothing up.
- **Short map links only:** if you paste a short link such as `maps.app.goo.gl/…`, that link (nothing else) goes to our tiny link expander on Cloudflare (`worker/`), which returns the long link holding the coordinates. When Google's long link only carries an address, the expander looks that address up in Photon itself. It stores and logs nothing. Long links, addresses and coordinates never go there.
- QR codes are generated in your browser.
- **The coordinates are part of the QR link.** Anyone who scans the code sees the location. For a home address, consider pinning a nearby corner instead.
- Saved places, names and notes stay in your browser (`localStorage`) and never go into the QR code or anywhere else.
- A remembered app choice is stored only in the driver's own browser and can be cleared by unticking the box.
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

## Self-hosting

It's a static site: build it and serve `dist/` from anywhere. Two build-time settings:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_PUBLIC_URL` | `https://123go.taxi` | Address that QR codes point to. |
| `BASE_PATH` | `/` | Sub-path if the site isn't at the root of its domain, e.g. `/123gotaxi/`. |

## Credits

Addresses © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, looked up with [Photon](https://github.com/komoot/photon) by komoot.

## Contact

Questions, ideas or bug reports: open an issue, or write to [0xhorizonxyz@gmail.com](mailto:0xhorizonxyz@gmail.com).

## License

[MIT](LICENSE)
