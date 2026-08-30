{
  pkgs,
  src,
}:

let
  pnpm = pkgs.pnpm_11;
in
pkgs.stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "dividendi";
  version = "0.1.0";

  src = pkgs.lib.cleanSourceWith {
    inherit src;
    filter =
      path: type:
      let
        name = baseNameOf path;
      in
      !(
        (
          type == "directory"
          && builtins.elem name [
            ".cache"
            ".direnv"
            ".git"
            ".ruff_cache"
            ".venv"
            "coverage"
            "dist"
            "node_modules"
          ]
        )
        || (type == "regular" && pkgs.lib.hasSuffix ".tsbuildinfo" name)
      );
  };

  nativeBuildInputs = [
    pkgs.nodejs_24
    pnpm
    pkgs.pnpmConfigHook
    pkgs.pnpmBuildHook
  ];

  pnpmDeps = pkgs.fetchPnpmDeps {
    inherit (finalAttrs) pname version src;
    inherit pnpm;
    fetcherVersion = 4;
    hash = "sha256-tBA+5kS2IKrt37/CTlW/ujFbz7s49ahDdaSXJIuGaAs=";
  };

  doCheck = true;
  checkPhase = ''
    runHook preCheck

    pnpm test

    runHook postCheck
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p "$out"
    cp -r dist/. "$out/"

    runHook postInstall
  '';
})
