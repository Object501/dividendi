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
      pkgs.nodejs
      pkgs.pnpm
      pkgs.python3
    ];

    inherit (pre-commit-check) shellHook;
  };
}
