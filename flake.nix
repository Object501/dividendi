{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    git-hooks.url = "github:cachix/git-hooks.nix";
    git-hooks.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs =
    {
      nixpkgs,
      git-hooks,
      ...
    }:
    let
      forSystems = nixpkgs.lib.genAttrs [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      pkgsFor =
        system:
        import nixpkgs {
          inherit system;
          overlays = [ (import ./nix/overlay.nix) ];
        };

      nativeChecks = forSystems (
        system:
        import ./nix/checks.nix {
          inherit git-hooks;
          pkgs = pkgsFor system;
          src = ./.;
        }
      );

      nativePackages = forSystems (system: {
        default = import ./nix/package.nix {
          pkgs = pkgsFor system;
          src = ./.;
        };
        inherit (pkgsFor system) wrangler;
      });
    in
    {
      checks = forSystems (
        system:
        nativeChecks.${system}
        // {
          package = nativePackages.${system}.default;
        }
      );

      devShells = forSystems (
        system:
        import ./nix/dev-shell.nix {
          pkgs = pkgsFor system;
          pre-commit-check = nativeChecks.${system}.pre-commit-check;
        }
      );

      formatter = forSystems (system: (pkgsFor system).nixfmt);
      packages = nativePackages;
    };
}
