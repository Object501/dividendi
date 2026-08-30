{
  pkgs,
  pre-commit-check,
}:

{
  default = pkgs.mkShellNoCC {
    name = "dividendi-dev";

    packages = [
      pkgs.git
      pkgs.just
      pkgs.nodejs_24
      pkgs.pnpm_11
      pkgs.dividendi-python
    ];

    shellHook = pre-commit-check.shellHook + ''
      export DIVIDENDI_DATA_DIR="$PWD/.data"
    '';
  };
}
