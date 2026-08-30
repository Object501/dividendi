default:
    @just --list

# Install the locked JavaScript dependencies for local development.
setup:
    pnpm install --frozen-lockfile

# Regenerate the browser's structural validators from the public JSON Schema.
generate-data-validator:
    pnpm generate:data-validator

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

# Fetch official closes and incrementally update the rolling 365-day history.
history:
    python3 -m collector update-history

# Rebuild the complete trailing 365-calendar-day EOD history locally.
backfill:
    python3 -m collector backfill-history

# Validate both generated JSON documents before publishing.
validate:
    python3 -m collector validate-data
    DIVIDENDI_CONTRACT_DATA_DIR="${DIVIDENDI_DATA_DIR:-.data}" pnpm validate:data-contract

# Replace the remote data branch using the canonical commit-message generator.
publish-data: validate
    scripts/publish-data-branch "${DIVIDENDI_DATA_DIR:-.data}" origin

# Run unit tests.
test:
    pnpm test
    python3 -m unittest discover -s collector/tests

# Run the Nix checks used by CI.
ci:
    nix flake check --print-build-logs
