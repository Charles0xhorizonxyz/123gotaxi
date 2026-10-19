# Contributing to gogogo.rodeo

Thanks for helping! Bug reports, translations and real-phone test results are especially welcome.

## Ground rules

- **No tracking, ever.** No analytics, third-party cookies or fingerprinting. PRs that add them will be closed.
- **Stay static.** The site must build to plain files that any static host can serve.
- **Respect provider policies.** Geocoding and map-tile providers have usage rules (for example, the public Nominatim server forbids autocomplete). Read them before adding or changing a provider.
- **Don't claim app detection.** A website can't know which apps are installed. The UI must not pretend otherwise.

## Getting started

```sh
npm install
npm run dev
```

Before opening a pull request:

```sh
npm run typecheck && npm run lint && npm test && npm run test:e2e
```

CI runs the same checks on every pull request.

## Adding a language

1. Copy `src/i18n/en.ts` to `src/i18n/<code>.ts` and translate the values (keep the keys).
2. Register it in `src/i18n/index.ts`.
3. The unit tests check that no key is missing.

## Navigation-app links

Each app's link format lives in its own file under `src/navigation-links/`, with unit tests. If you change one, link the official documentation in your PR. If you can, also tick the matching rows in `docs/MANUAL-SCAN-CHECKLIST.md` on a real phone.

## Commit style

Short, imperative subject lines ("Add Waze link builder"). One logical change per commit.
