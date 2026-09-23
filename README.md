# Valvet

Service app for one Bally *The Addams Family* pinball machine (1992, WPC). Static Astro site with
Svelte islands, installable as a PWA, built from the data kit in `../kit`.

## Run

```
pnpm install
pnpm dev            # http://localhost:4321
pnpm build          # dist/
pnpm preview
```

Gates: `pnpm check` (astro check + tsc), `pnpm lint`, `pnpm test` (vitest), `pnpm test:e2e`
(Playwright, phone-dark + desktop-light against `pnpm preview`).

## Deploy

- **GitHub Pages** (chosen target): `.github/workflows/deploy.yml` builds with
  `BASE_PATH=/<repo name>/` and publishes `dist/`. Enable Pages → Source "GitHub Actions".
- **Docker**: `docker compose up --build` serves on http://localhost:8080. Pass
  `--build-arg BASE_PATH=/valvet/` to serve under a sub-path. *Untested locally* (no Docker here).
- `BASE_PATH` must start and end with `/`. In Git Bash prefix `MSYS_NO_PATHCONV=1`, otherwise MSYS
  rewrites `/valvet/` into a Windows path.

## Data

All data is copied from the kit, never edited here:

```
pnpm sync-kit   # kit/data → src/data/kit + public/data, kit/assets → public/assets,
                # kit/handbook → src/content/handbook, kit/docs → kit-docs
pnpm fonts      # @fontsource woff2 → public/fonts
pnpm icons      # public/icons/icon.svg → 192/512 png
pnpm thumbs     # optional page thumbnails
```

Handbook pages are rendered by a custom content loader (`src/lib/handbook/loader.ts`) that turns
`#find:CODE` and `#goto:ops:N` links into real anchors.

## Assumptions and decisions (from the owner, §10 of the build prompt)

- UI language is **English throughout**. Source data with Swedish wiring names is mapped in
  `src/lib/data/en.ts`.
- App name stays **Valvet**. Deploy target GitHub Pages. Service log and photos stay local on the
  device (M2+).
- Project lives in the sibling folder `../valvet`; the kit is read-only source.
- Astro 7 is used instead of the Astro 5 the prompt mentions (the kit's dependency policy pins nothing
  older). `pnpm-workspace.yaml` sets `minimumReleaseAge: 0` so current releases install.
- Fonts are self-hosted from `public/fonts` so they work under any base path.
- Repo: https://github.com/Dsgj/TheAddamsFamilyHandbook (public, owner decision). Live site:
  https://dsgj.github.io/TheAddamsFamilyHandbook/. The scans are Williams/Midway
  copyright material; the owner accepted publishing them.
- Per-component status (OK / Fault / Not tested + note) lives in `localStorage` under `valvet:status`
  until M2 introduces the storage adapter.

## Data caveats shown in the UI

See `CHANGELOG.md` and `kit-docs/KNOWN-ISSUES.md`. Every caveat is rendered as a provenance note next
to the affected data.
