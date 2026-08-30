# AGENTS.md

## Product

`dividendi` is a mobile-first Chinese static site for:

1. Discount and daily discount points for every currently traded contract of
   configured CFFEX stock-index futures products.
1. Gross dividend yield for configured A-shares using cash dividends paid in
   the preceding 365 calendar days and the latest unadjusted price.

UI and public README text must be Simplified Chinese. This is personal research,
not investment advice.

## Invariants

- `config/instruments.json` is the only futures/underlying/stock catalog. Python
  and TypeScript validate and iterate it; never duplicate codes, names, or order.
- `贴水 = 指数 - 期货`; positive means discount. `日化贴水 = 贴水 / 剩余交易日`. Intraday includes today; EOD starts with the next session.
- CFFEX expiry is the third Friday, postponed to the next trading session.
- `股息率 = 过去365天已派发每股现金分红 / 最近不复权价`. Use payment date;
  exclude announced-but-unpaid plans, tax, reinvestment, and forecasts.
- Public financial decimals are JSON strings and are recomputed during Python
  and TypeScript validation. Publish complete, common-date data only.
- `latest.json` is atomically replaced only when financial values change.
  `history.json` replaces the same market date and retains exactly
  `(newest - 365 days, newest]`; never archive an intraday snapshot.
- Browser polling is hourly, visible/online, and limited to the China-market
  refresh window. Every trigger shares a hard five-minute minimum gap.

## Architecture

- React + TypeScript + Vite; lazy, tree-shaken ECharts. Static GitHub Pages;
  no runtime backend, accounts, database, browser Python, C++, WASM, or SSR.
- Python collector with narrow provider adapters: Sina current quotes, CNInfo
  implemented cash dividends, CFFEX rules, and the SSE trading calendar.
- `public/data/latest.json` and `public/data/history.json` ship with the site.
  Preserve last-good files when fetching or validation fails.
- pnpm lockfile plus Nixpkgs `fetchPnpmDeps`; no node2nix. Python and development
  packages come from pinned Nixpkgs. Put missing packages in `nix/overlay.nix`;
  do not add uv/pip environments.
- Native systems: `aarch64-darwin`, `aarch64-linux`, `x86_64-linux`.

## Mobile UX

- Design at 360/390 px first; no horizontal page scroll, hover-only content,
  chart-only facts, or targets below 44 px. Support safe areas and reduced motion.
- Show market/fetch time and Chinese summaries before charts. Keep explicit
  loading, error, empty, and last-good states.

## Commands

- `nix develop`; `just setup`
- `just check`; `just test`; `just ci`
- `just data`; `just history`; `just build`

## Progress

- [x] Nix dev shell/checks/package and pnpm dependency lock.
- [x] Shared instrument catalog, formulas, CFFEX sessions, and 365-day retention.
- [x] Fixture-tested Sina and CNInfo adapters; live-smoked the configured catalog.
- [x] Validated/atomic latest publisher and rolling EOD history publisher.
- [x] Seed data for 2026-08-28.
- [x] Chinese mobile UI with text, current cross-sectional charts, responsive
  empty/error states, and 360/390 px browser QA.
- [ ] Optional: backfill the rolling window and add selectable trend charts.
- [ ] Add update/Pages workflows only when requested. Planned behavior: generate
  proposed data, validate, and exit without commit/deploy when unchanged; for a
  valid change, commit to `main` and deploy exactly once in the same workflow.
- [ ] Review provider attribution/redistribution terms before public launch.

Current stage: the local vertical slice is complete. A new session should choose
between historical backfill/trends and CI/Pages deployment; CI is intentionally
absent for now.

## Working rules

- Preserve GPL-3.0; never commit credentials or local build artifacts.
- Test parsers with fixtures, not live calls. Add regression tests for defects.
- Keep commits focused; use `type: lowercase summary.` (72 characters max).
- Run narrow and repository-wide checks. Update this progress section after each
  material stage.
