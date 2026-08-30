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
  `(newest - 365 days, newest]` of trading-session closes; never archive an
  intraday snapshot. The browser fetches latest with `no-store`, keeps it only
  in memory, and loads history only on explicit user interaction.
- Browser polling is hourly, visible/online, and limited to the China-market
  refresh window. Every trigger shares a hard five-minute minimum gap.

## Architecture

- React + TypeScript + Vite; lazy, tree-shaken ECharts. Static GitHub Pages;
  no runtime backend, accounts, database, browser Python, C++, WASM, or SSR.
- Python collector with narrow provider adapters: Sina current quotes, CNInfo
  implemented cash dividends, official CFFEX close archives, BaoStock close
  history, CFFEX rules, and the SSE trading calendar. Multi-request collection
  uses randomized polite delays.
- `main` never tracks generated JSON. Local data lives in ignored `.data`, with
  `DIVIDENDI_DATA_DIR` exported by the dev shell and Vite development URLs set in
  `.env.development`. Production temporarily checks the `data` branch out at
  `public/data` before building. Preserve last-good data on failure.
- pnpm lockfile plus Nixpkgs `fetchPnpmDeps`; no node2nix. Python and development
  packages come from pinned Nixpkgs. Put missing packages in `nix/overlay.nix`;
  do not add uv/pip environments.
- Native systems: `aarch64-darwin`, `aarch64-linux`, `x86_64-linux`.

## Mobile UX

- Design at 360/390 px first; no horizontal page scroll, hover-only content,
  chart-only facts, or targets below 44 px. Support safe areas and reduced motion.
- Default to dark mode, offer a persistent light-mode toggle, and keep chart
  colors synchronized with the selected theme.
- Show market/fetch time and Chinese summaries before charts. Keep explicit
  loading, error, empty, and last-good states.
- Historical charts pair each metric with its same-day close: metric on the
  left axis and stock/futures close on the right axis.

## Commands

- `nix develop`; `just setup`
- `just check`; `just test`; `just ci`
- `just data`; `just history`; `just backfill`; `just validate`; `just build`

## Progress

- [x] Nix dev shell/checks/package and pnpm dependency lock.
- [x] Shared instrument catalog, formulas, CFFEX sessions, and 365-day retention.
- [x] Fixture-tested Sina and CNInfo adapters; live-smoked the configured catalog.
- [x] Validated/atomic latest publisher and rolling EOD history publisher.
- [x] Keep generated JSON out of `main` while preserving local debugging through
  `.data` and tracked development environment variables.
- [x] Chinese mobile UI with text, current cross-sectional charts, responsive
  empty/error states, and 360/390 px browser QA.
- [x] Default-dark theme with a persistent light toggle and matching ECharts
  palettes, verified at 360/390 px without horizontal overflow.
- [x] Historical dual-axis charts and summaries pair dividend yield or daily
  discount points with the same trading day's close.
- [x] Backfilled 242 trading-session closes for the rolling window and added
  on-demand selectable trend charts with 360/390 px browser QA.
- [x] Store production JSON in a one-commit orphan `data` branch. Weekend,
  holiday, and unchanged runs must make no commit or deployment. Changed data
  replaces that commit with `--force-with-lease`, then deploys once.
- [x] Added GitHub Pages and scheduled data workflows using the Nix toolchain;
  production builds stage data without tracking it on `main`.
- [ ] Review provider attribution/redistribution terms before public launch.

Current stage: the static vertical slice is deployed with a rolling EOD data
branch. Next work is provider-terms review and any product refinements requested
after real-device use.

## Working rules

- Preserve GPL-3.0; never commit credentials or local build artifacts.
- Test parsers with fixtures, not live calls. Add regression tests for defects.
- Keep commits focused; use `type: lowercase summary.` (72 characters max).
- Run narrow and repository-wide checks. Update this progress section after each
  material stage.
