# AGENTS.md

## Product

`dividendi` is a mobile-first Simplified Chinese static site showing:

1. Discount and daily discount points for every traded contract of each configured CFFEX stock-index futures product.
1. Gross dividend yield for configured A-shares, using either cash dividends paid in the preceding 365 calendar days or regular dividends from the latest completed fiscal year.

UI and public README text must be Simplified Chinese. This is personal research, not investment advice.

## Invariants

- `config/instruments.json` is the only futures, underlying, and stock catalog. Python and TypeScript validate and iterate it; never duplicate codes, names, or order. Fiscal years come from collected data, never hard-coded UI.
- `贴水 = 指数 - 期货`; positive means discount. `日化贴水 = 贴水 / 剩余交易日`. Intraday includes today; EOD starts with the next session.
- CFFEX expiry is the third Friday, postponed to the next trading session.
- `股息率 = 过去365天已派发每股现金分红 / 最近不复权价`. Use payment dates; exclude unpaid plans, tax, reinvestment, and forecasts.
- `购买参考股息率 = 最近完整派息财年的常规每股现金分红 / 当日不复权收盘价`. A fiscal year completes only after its annual dividend is paid. Include its regular annual, interim, and quarterly payouts; exclude special dividends and look-ahead data.
- Public financial decimals are JSON strings and are recomputed by Python and TypeScript. Publish only complete, common-date data.
- `schema/public-data-v1.schema.json` is the only public JSON structure. Dev, test, typecheck, contract, and build commands generate untracked validators from it, then run handwritten numeric and semantic checks. For a new schema version, deploy a dual-version reader before changing the collector.
- Publish only `history.json`; it replaces the same date and retains exactly `(newest - 365 days, newest]` of EOD trading-session closes. Never publish or write back intraday data.
- The browser loads the newest history snapshot as its basis, downloads Eastmoney quotes, contracts, and published A-share closures, and persists the last valid computed snapshot only in local storage. Poll hourly only while visible, online, and within the China-market window, with a shared five-minute minimum gap.
- One weekday 19:23 Shanghai job updates only `history.json`; there are no hourly Actions jobs.
- Data commits use Shanghai timestamps and list only JSON files whose bytes changed; unchanged runs create no commit.
- EOD may fill at most 10 trailing missing sessions. Larger gaps require a locally reviewed `just backfill`; multi-request collection uses randomized delays.

## Architecture

- React + TypeScript + Vite with lazy ECharts; static GitHub Pages only. No runtime backend, accounts, database, browser Python, C++, WASM, or SSR.
- Keep site source, tests, and frontend configuration under `frontend/`; keep root Node manifests for Nix and pnpm.
- Browser adapters cover Eastmoney's delayed quotes, contract catalog, and holiday calendar. Python adapters cover CNInfo dividends, official CFFEX closes, BaoStock history, and the SSE calendar.
- `main` never tracks generated JSON. Ignored `.data` supports local development through `DIVIDENDI_DATA_DIR` and `.env.development`.
- Production reads the one-commit orphan `data` branch through `.env.production`; data updates do not rebuild Pages. Preserve last-good data and allow for the raw-file CDN's five-minute cache.
- Use the pnpm lockfile with Nixpkgs `fetchPnpmDeps`. Python and tools come from pinned Nixpkgs; put missing packages in `nix/overlay.nix`. Do not add uv, pip environments, or node2nix.
- GitHub workflows share the repository Magic Nix Cache with GitHub cache enabled and FlakeHub/diagnostics disabled.
- Dependabot checks pnpm and GitHub Actions weekly; pnpm lock changes require a new `fetchPnpmDeps` hash. It cannot update flake inputs.
- Native systems: `aarch64-darwin`, `aarch64-linux`, `x86_64-linux`.

## Mobile UX

- Design at 360/390 px first. No horizontal page scroll, hover-only content, chart-only facts, or targets below 44 px; support safe areas and reduced motion.
- Default to dark mode with a persistent light toggle and synchronized chart colors.
- Put Chinese summaries and market/fetch time before charts; provide loading, error, empty, and last-good states.
- Label dividends as currency per share with two decimal places.
- Historical charts use the metric on the left axis and same-day stock or futures close on the right.

## Commands

- Setup/build: `nix develop`; `just setup`; `just build`
- Quality: `just check`; `just test`; `just ci`
- Data: `just history`; `just backfill`; `just validate`; `just publish-data`
- Optional codegen: `just generate-data-validator`

## Status

- [x] Pinned Nix/pnpm toolchain, checks, tests, and static Pages build.
- [x] Shared instrument catalog, formulas, sessions, provider adapters, schema validation, generated frontend validators, and bounded incremental collection.
- [x] Chinese mobile UI, default-dark theme, current tables/charts, and selectable dual-axis history with fiscal-year transition markers.
- [x] Rolling EOD data in a one-commit `data` branch; idempotent scheduled publication is decoupled from Pages and works locally through `.data`.
- [x] Browser-side delayed quotes and local persistence; a weekday EOD workflow publishes only rolling history.
- [x] Provider parsing, refresh orchestration, history transforms, UI modules, and styles are separated and tested.
- [x] Magic Nix Cache, grouped Dependabot updates, read-only PR checks, squash/rebase policy, and final squash-title validation.
- [ ] Review provider attribution and redistribution terms before public launch.

Current stage: the static vertical slice is deployed. Next work is the provider-terms review and refinements from real-device use.

## Working rules

- Preserve GPL-3.0; never commit credentials or local build artifacts.
- Never hand-build or push the `data` branch. `just publish-data` must use `scripts/publish-data-branch` and `scripts/data-commit-message`, listing only JSON files whose bytes changed.
- Test parsers with fixtures, not live calls; add regression tests for defects.
- Keep commits focused: `type: lowercase summary.` with a 72-character maximum.
- PR titles use the same gitlint rule. Dependabot PR titles must omit `(#N)`; validation adds the current PR number and enforces the final 72-character squash title. Rebase only conforming commit series.
- Run narrow and repository-wide checks, and update this status after material work.
