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

  python-tests =
    pkgs.runCommand "dividendi-python-tests"
      {
        nativeBuildInputs = [
          pkgs.bash
          pkgs.dividendi-python
          pkgs.git
        ];
      }
      ''
        cp -r ${src} source
        chmod -R u+w source
        cd source

        python3 -m unittest discover -s collector/tests
        touch "$out"
      '';
}
