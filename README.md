# gogogo.rodeo

*For a smooth ride — or it might get rocky, but at least it started smoothly.*

**gogogo.rodeo** turns an address into a QR code that a taxi driver can scan to start navigation in their own app: Google Maps, Yandex, Waze, Apple Maps or any other.

> Status: early development. See [PLAN.md](PLAN.md) for the roadmap.

## How it works

1. **You** search for a place, paste a Google Maps or Yandex link, or type coordinates.
2. You drag the pin to the exact entrance and get a QR code to show, download or print.
3. **The driver** scans it, taps their navigation app, and the route starts.

The QR code points to a gogogo.rodeo page, not straight to one app. That page lists the apps, so app support can improve without reprinting codes. Drivers can tick "Remember my choice" to skip the list next time.

## Privacy

- No accounts, no database, no analytics, no cookies.
- QR codes are generated in your browser.
- **The coordinates are part of the QR link.** Anyone who scans the code sees the location. For a home address, consider pinning a nearby corner instead.
- A remembered app choice is stored only in the driver's own browser (`localStorage`) and can be cleared from the page at any time.

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
| `VITE_PUBLIC_URL` | `https://gogogo.rodeo` | Address that QR codes point to. |
| `BASE_PATH` | `/` | Sub-path if the site isn't at the root of its domain, e.g. `/gogogo-rodeo/`. |

## Credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Further credits for map tiles and search will be listed here as those features land.

## License

[MIT](LICENSE)
