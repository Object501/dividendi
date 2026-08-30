default:
    @just --list

# Run every configured formatting and static-analysis check.
check:
    pre-commit run --all-files

# Run the Nix checks used by CI.
ci:
    nix flake check --print-build-logs
