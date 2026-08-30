default:
    @just --list

# Install the locked JavaScript dependencies for local development.
setup:
    pnpm install --frozen-lockfile

# Run formatting, lint, type, and unit checks.
check:
    pre-commit run --all-files
    pnpm typecheck
    just test

# Build the static website locally.
build:
    pnpm build

# Fetch, validate, and atomically publish the latest website data.
data:
    python3 -m collector refresh-latest

# Add the published end-of-day snapshot to the rolling 365-day history.
history:
    python3 -m collector update-history

# Rebuild the complete trailing 365-day EOD history with polite random delays.
backfill:
    python3 -m collector backfill-history

# Run unit tests.
test:
    pnpm test
    python3 -m unittest discover -s collector/tests

# Run the Nix checks used by CI.
ci:
    nix flake check --print-build-logs
