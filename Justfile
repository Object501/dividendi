default:
    @just --list

# Install the locked JavaScript dependencies for local development.
setup:
    pnpm install --frozen-lockfile

# Run formatting, lint, type, and unit checks.
check:
    pre-commit run --all-files
    pnpm typecheck
    pnpm test

# Build the static website locally.
build:
    pnpm build

# Run unit tests.
test:
    pnpm test

# Run the Nix checks used by CI.
ci:
    nix flake check --print-build-logs
