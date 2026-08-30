# AGENTS.md

## Product

`dividendi` is a mobile-first Chinese static site for:

1. Discount and daily discount points for every currently traded contract of
   configured CFFEX stock-index futures products.
1. Gross dividend yield for configured A-shares using either cash dividends
   paid in the preceding 365 calendar days or the latest completed fiscal
   year's regular dividends, divided by the same-day unadjusted price.

UI and public README text must be Simplified Chinese. This is personal research,
not investment advice.

## Invariants

- `config/instruments.json` is the only futures/underlying/stock catalog. Python
  and TypeScript validate and iterate it; never duplicate codes, names, or order.
- `贴水 = 指数 - 期货`; positive means discount. `日化贴水 = 贴水 / 剩余交易日`. Intraday includes today; EOD starts with the next session.
- CFFEX expiry is the third Friday, postponed to the next trading session.
- `股息率 = 过去365天已派发每股现金分红 / 最近不复权价`. Use payment date;
  exclude announced-but-unpaid plans, tax, reinvestment, and forecasts.
- `购买参考股息率 = 最近完整派息财年的常规每股现金分红 / 当日不复权收盘价`.
  A fiscal year is complete only after its annual dividend is paid. Include
  regular annual/interim/quarterly payouts for that year, exclude special
  dividends, and never look ahead.
- Public financial decimals are JSON strings and are recomputed during Python
  and TypeScript validation. Publish complete, common-date data only.
- `latest.json` is atomically replaced only when financial values change.
  `history.json` replaces the same market date and retains exactly
  `(newest - 365 days, newest]` of trading-session closes; never archive an
  intraday snapshot. The browser fetches latest with `no-store`, keeps it only
  in memory, and loads history only on explicit user interaction.
- Browser polling is hourly, visible/online, and limited to the China-market
  refresh window. Every trigger shares a hard five-minute minimum gap.
- Scheduled hourly runs refresh only `latest.json`; the daily EOD run refreshes
  only `history.json`. Data-branch commit titles use a Shanghai timestamp and
  their bodies list the JSON files whose bytes actually changed.
- Fetch CNInfo dividends at most once per market date. Later quote refreshes for
  that date reuse the validated dividend basis and recompute yields from the new
  prices. EOD refreshes may catch up at most 10 trailing missing sessions; larger
  gaps require an explicit, locally reviewed `just backfill`.

## Architecture

- React + TypeScript + Vite; lazy, tree-shaken ECharts. Static GitHub Pages;
  no runtime backend, accounts, database, browser Python, C++, WASM, or SSR.
- Keep site HTML, TypeScript, styles, tests, and Vite/TypeScript configuration
  under `frontend/`. Root Node manifests remain for Nix and pnpm integration.
- Python collector with narrow provider adapters: Sina current quotes, CNInfo
  implemented cash dividends, official CFFEX close archives, BaoStock close
  history, CFFEX rules, and the SSE trading calendar. Multi-request collection
  uses randomized polite delays.
- `main` never tracks generated JSON. Local data lives in ignored `.data`, with
  `DIVIDENDI_DATA_DIR` exported by the dev shell and Vite development URLs set in
  `.env.development`. Production URLs in `.env.production` read the one-commit
  `data` branch directly from GitHub; data updates never rebuild Pages. Preserve
  last-good data on failure and allow for the raw-file CDN's five-minute cache.
- pnpm lockfile plus Nixpkgs `fetchPnpmDeps`; no node2nix. Python and development
  packages come from pinned Nixpkgs. Put missing packages in `nix/overlay.nix`;
  do not add uv/pip environments.
- GitHub workflows share the repository-scoped Magic Nix Cache. Keep GitHub
  cache enabled and FlakeHub/diagnostics disabled; local builds use their own
  Nix store.
- Dependabot checks pnpm and GitHub Actions weekly. It cannot update Nix flake
  inputs; pnpm lock changes also require refreshing the `fetchPnpmDeps` hash
  before merge.
- Native systems: `aarch64-darwin`, `aarch64-linux`, `x86_64-linux`.

## Mobile UX

- Design at 360/390 px first; no horizontal page scroll, hover-only content,
  chart-only facts, or targets below 44 px. Support safe areas and reduced motion.
- Default to dark mode, offer a persistent light-mode toggle, and keep chart
  colors synchronized with the selected theme.
- Show market/fetch time and Chinese summaries before charts. Keep explicit
  loading, error, empty, and last-good states.
- Label trailing cash dividends explicitly in currency per share, formatted to
  two decimal places instead of implying a whole-position cash amount.
- Historical charts pair each metric with its same-day close: metric on the
  left axis and stock/futures close on the right axis.

## Commands

- `nix develop`; `just setup`
- `just check`; `just test`; `just ci`
- `just data`; `just history`; `just backfill`; `just validate`
- `just publish-data`; `just build`

## Progress

- [x] Nix dev shell/checks/package and pnpm dependency lock.
- [x] Shared instrument catalog, formulas, CFFEX sessions, and 365-day retention.
- [x] Fixture-tested Sina and CNInfo adapters; live-smoked the configured catalog.
- [x] Validated/atomic latest publisher and rolling EOD history publisher.
- [x] Keep generated JSON out of `main` while preserving local debugging through
  `.data` and tracked development environment variables.
- [x] Chinese mobile UI with text, current cross-sectional charts, responsive
  empty/error states, per-contract futures prices, and 320/360/390 px browser
  QA.
- [x] Default-dark theme with a persistent light toggle and matching ECharts
  palettes, verified at 360/390 px without horizontal overflow.
- [x] Historical dual-axis charts and summaries pair dividend yield or daily
  discount points with the same trading day's close.
- [x] Added a historical dividend-basis switch between trailing 365-day yield
  and a completed-fiscal-year purchase reference that excludes special
  dividends and avoids mechanical rolling-window exits.
- [x] Backfilled 242 trading-session closes for the rolling window and added
  on-demand selectable trend charts with 360/390 px browser QA.
- [x] Store production JSON in a one-commit orphan `data` branch. Weekend,
  holiday, and unchanged runs make no commit. Changed data replaces that commit
  with `--force-with-lease` without rebuilding or deploying Pages.
- [x] Added GitHub Pages and scheduled data workflows using the Nix toolchain;
  Pages deploys only on `main`, while production fetches the `data` branch
  directly and local development continues to use ignored `.data` files.
- [x] Consolidated all site source and frontend build configuration under
  `frontend/` while keeping every root Justfile recipe operational.
- [x] Reduced dividend requests to once per market date and added bounded
  incremental EOD catch-up without changing the explicit backfill/publish split.
- [x] Added a secret-free GitHub Actions Nix binary cache shared by Pages and
  scheduled data workflows.
- [x] Enabled grouped weekly Dependabot updates for pnpm and GitHub Actions;
  vulnerability alerts and security updates are enabled, and read-only PR checks
  run the full Nix validation without deploying Pages.
- [x] Limited GitHub merges to squash/rebase, validated every PR title with the
  repository gitlint rules, and normalized Dependabot title punctuation.
- [ ] Review provider attribution/redistribution terms before public launch.

Current stage: the static vertical slice is deployed with a rolling EOD data
branch. Next work is provider-terms review and any product refinements requested
after real-device use.

## Working rules

- Preserve GPL-3.0; never commit credentials or local build artifacts.
- Never construct or push a `data` branch commit by hand. Local and CI publishing
  both run `just publish-data`, which delegates comparison and commit creation to
  `scripts/publish-data-branch`; it lists every actually changed JSON through
  `scripts/data-commit-message`.
- Test parsers with fixtures, not live calls. Add regression tests for defects.
- Keep commits focused; use `type: lowercase summary.` (72 characters max).
- GitHub PRs must pass the same gitlint title rule. Squash Dependabot PRs so the
  normalized PR title becomes the commit; rebase only conforming commit series.
- Run narrow and repository-wide checks. Update this progress section after each
  material stage.
