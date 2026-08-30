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
      pkgs.python3
    ];

    inherit (pre-commit-check) shellHook;
  };
}
