{
  git-hooks,
  pkgs,
  src,
}:

{
  pre-commit-check = git-hooks.lib.${pkgs.stdenv.hostPlatform.system}.run {
    inherit src;

    hooks = {
      # Nix
      deadnix.enable = true;
      nixfmt.enable = true;
      statix.enable = true;

      # Commit messages and GitHub Actions
      gitlint.enable = true;
      actionlint.enable = true;

      # Documentation
      mdformat = {
        package = pkgs.mdformat.withPlugins (
          ps: with ps; [
            mdformat-myst
            mdformat-gfm
          ]
        );
        enable = true;
      };

      # JavaScript/TypeScript/JSX/TSX/JSON
      biome = {
        enable = true;
        excludes = [ "^flake\\.lock$" ];
      };

      # Python data collector
      ruff.enable = true;
      ruff-format.enable = true;
    };
  };
}
