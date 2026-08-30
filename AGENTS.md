# AGENTS.md

## Mission

`dividendi` is a mobile-first Chinese website for:

1. Every currently traded contract of the configured CFFEX stock-index futures
   products, with daily discount points in text and charts.
1. Dividend yields from recent prices for the configured A-shares.

UI and the public README are Simplified Chinese. Internal code/notes may be
English. The output is historical information, not investment advice.

## Design

- Static GitHub Pages; no runtime backend, accounts, or database.
- React + TypeScript + Vite with responsive CSS and tree-shaken ECharts. Use
  Python only in GitHub Actions for data collection. No browser Python, C++,
  WebAssembly, or SSR unless a measured need appears.
- Plan split refreshes: replace `data/latest.json` nominally hourly during
  trading hours and update `data/history.json` once nightly. Never poll a
  provider or the static file more often than once per 5 minutes.
- The UI fetches `latest.json` at startup, then hourly while visible and the
  market is open; it pauses while hidden/offline/outside trading hours.
- Keep a schema-versioned rolling EOD window: retain market dates in the 365
  calendar days ending at the newest snapshot and prune older entries after a
  successful update. Initial backfill covers only that window. Git history may
  retain old blobs; accept this while the data remains small.
- Future update CI writes proposed data separately and validates it before
  replacing tracked files. Invalid or unchanged output produces no commit and
  no Pages deployment. Valid changed output is committed directly to `main`,
  then built and deployed exactly once in that workflow; do not rely on the bot
  push to trigger another workflow.
- Keep the last good data on failure and display its source time/staleness. Load
  history on demand.
- Use pnpm/Vite and Nix-managed development tools. Keep Nix, Markdown, commit,
  Actions, web/TypeScript, and Python checks; omit unused Bazel, C++, and Rust
  tooling.
- `config/instruments.json` is the only instrument catalog. The TypeScript UI
  imports it and the Python collector reads it; never duplicate futures,
  underlyings, stock codes, display names, or ordering in code. Both consumers
  iterate its arrays; provider adapters derive their symbols from the configured
  exchange/market and code.
- Native Nix targets are `aarch64-darwin`, `aarch64-linux`, and
  `x86_64-linux`; there are no cross-compilation outputs.
- Target commands: `nix develop`, `just check`, `just test`, `just build`,
  `just data`, and `nix flake check`.

## Formulas

- `贴水点数 = 同时点标的指数点位 - 期货合约价格`; positive is discount and
  negative is premium. Use latest prices intraday and same-day closes for EOD.
- `日化贴水点数 = 贴水点数 / 剩余交易日数`. While the market is open, count
  today and later sessions through expiry; for EOD history, count sessions
  strictly after the snapshot date. Omit when no session remains.
- Derive expiry from CFFEX's third-Friday rule and the trading calendar.
- `近12个月税前股息率 = 过去365天已实施的每股现金分红 / 最近不复权价格`.
- Exclude tax, reinvestment, forecasts, and price appreciation. Keep formulas
  deterministic and separate from collection/UI.

## Data

- Intraday futures, underlying-index, and stock quotes: Sina adapters through
  AKShare. Treat the one-hour interval as a provider-protection limit, not a
  freshness SLA.
- EOD futures OHLC: CFFEX daily CSV via AKShare `get_futures_daily`.
- EOD underlying-index and stock closes: BaoStock, unadjusted.
- Dividends: CNInfo via AKShare `stock_dividend_cninfo`.
- Isolate providers behind adapters. Store source, fetch time, market date, raw
  values, and schema version. Before publish, require a common market date,
  unique contracts, all configured stocks, and finite/plausible values.
- Smoke test 2026-08-30: Sina returned every contract, underlying index, and
  stock in the current catalog; the EOD sources also worked without
  credentials. Eastmoney current-quote adapters, AKShare's CSI history adapter,
  and CFFEX contract metadata failed, so do not make them critical. TianQin is
  excluded: it requires an account and its A-share data is paid.
- This is a personal, non-commercial site. Free endpoints still have no SLA or
  assured redistribution right; confirm attribution and never hide stale or
  partial data.

## Mobile UX

- Design at 360/390 px first; desktop is an enhancement. Avoid horizontal page
  scrolling, hover-only details, chart-only information, and targets under
  44 px. Support safe areas, accessible contrast, and explicit empty/error/
  stale states.
- Put data date and a Chinese text summary before each lazy-loaded chart.
- Futures: contract cards, maturity/discount chart, selectable history.
  Dividends: ranked cards/bar chart with price, TTM dividend, yield, and
  relevant dates.

## Progress

- [x] Capture product, language, hosting, mobile, and framework requirements.
- [x] Research and smoke-test the initial data-source chain.
- [x] Propose architecture, formulas, data flow, and mobile UX.
- [x] Confirm trading-day discount and preceding-365-day dividend formulas.
- [x] Add simplified native Nix shells/checks and a locked dependency graph.
- [x] Add the shared configurable futures/stock instrument catalog.
- [ ] Define fixtures/schema; implement and test collectors.
- [ ] Backfill data; implement hand-checked formula tests.
- [ ] Build and mobile-test both views.
- [ ] Add gated data-update CI and Pages deployment when the collectors and UI
  exist.
- [ ] Review data terms; add attribution/disclaimer.

Current stage: development environment complete; data schema/fixtures are next.
Update this section after every material step.

## Working rules

- Preserve GPL-3.0; never commit credentials or generated local output.
- Take development and collector Python packages from the pinned Nixpkgs. If a
  package is missing, define it in a repository Nix overlay; do not add a
  `uv`/`pip`-managed environment.
- Test parsers with fixtures, not live calls; add regression tests for defects.
- Keep changes focused and public behavior documented in Chinese.
- Use commit style `type: lowercase summary.` (72 characters max).
- Run narrow and repository-wide checks; report anything not run.
- Update decisions/progress here before ending a work session.
