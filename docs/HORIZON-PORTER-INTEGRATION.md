# Horizon Porter integration plan

## Decision

Reuse Horizon Porter's deterministic conversion pipeline instead of writing a second Java-to-Rust porting engine. Keep this repository as the upload, job-status and download website. Do not copy the desktop Tauri application into the website.

Upstream project: https://github.com/kevinbonomi2-bit/horizon-porter

Horizon Porter is MIT-licensed. Any copied or vendored source must retain its copyright and MIT licence notice. The current upstream licence is included in `THIRD_PARTY_LICENSES/horizon-porter-MIT.txt`.

## What is reusable

Pin an upstream commit before integrating these crates:

- `porter-model`: shared mod scan and port state types.
- `porter-java`: JAR/source inspection, loader metadata, Mixin discovery and Java source parsing.
- `porter-map`: Java/Fabric/Mixin to Horizon API mapping data.
- `porter-content`: deterministic resource/content conversion to `.hmod`.
- `porter-mixin`: conversion of supported Mixin declarations.
- `porter-translate`: native bundle generation and optional method translation.
- `porter-verify`: build/check integration where a compatible Horizon toolchain is available.

The CLI already has a `scan`, `report`, `port`, `translate` and `package` workflow. A data-only mod can become a content `.hmod` without AI or Rust method translation. Mods with Java behavior need native code generation and must report any gaps.

## AI: optional, never a hidden requirement

Horizon Porter's AI pass is in `porter-translate::ai`. It translates individual Java functions that deterministic rules leave unfinished, then feeds compiler errors back for bounded retries.

Supported provider approaches in upstream source:

- Anthropic Claude: requires credentials and has usage charges. The app estimates cost before translation.
- Ollama: runs a model on the user's own computer. The model itself may be free, but it needs installation, storage and suitable hardware.
- A custom command: useful for a locally installed model or a developer-managed provider.

The website must not silently use a paid model, collect a provider key without clear consent, or claim AI is free. The current Cloudflare Worker cannot reach a user's localhost Ollama service. A browser-to-local-agent connection would require a separate local helper and should not be imposed on this user.

Recommended product behavior: deterministic conversion first; AI is an optional, explicit enhancement only after a secure provider path exists. If no provider is configured, preserve generated stubs/checklists as incomplete and never label them as a finished gameplay port.

## Hosting constraint

The current production target is a Cloudflare Worker using OpenNext. Horizon Porter is a native Rust desktop/CLI workspace. Its JAR decompiler downloads and runs Vineflower through a Java runtime; its pipeline writes directories, invokes Cargo/compiler checks and may use the local Horizon launcher. A Worker request handler cannot simply spawn that native toolchain.

Therefore, importing the crates into the Next.js route or adding a Git submodule would not make conversion work. The real integration needs a separate Rust job runner/container with:

1. A pinned Horizon Porter commit and pinned Starling-compatible API/toolchain.
2. A bounded upload/job interface, isolated temporary workspaces and cleanup.
3. Resource/time limits and archive validation before handing a JAR to the porter.
4. A conversion report and real `.hmod` / `.hnmod` outputs, not a renamed JAR or placeholder.
5. AI disabled by default, with explicit opt-in and a disclosed provider/cost if enabled.

Cloudflare remains the website and job API. A separate runner performs the native pipeline. We must confirm a deployable runner and its cost/free limits before connecting the public upload endpoint.

## Starling 0.9.0 compatibility gate

Horizon Porter documents `port --api` as experimental and currently tied to the `arismoko/horizon` fork. Its older horizon-mixins bundle backend and its newer typed-API backend are not interchangeable. Do not assume either output works in Starling 0.9.0 based on a successful ZIP build.

Before enabling downloads for generated native mods:

- Identify the exact Horizon API revision Starling 0.9.0 compiles against.
- Confirm Horizon Porter's generated manifest and glue target that exact API.
- Run a native compile with the Starling toolchain.
- Test the mod in Starling 0.9.0.
- Keep output labelled as a candidate until all checks pass.

Starling's in-game compile step may provide the final device-specific native build, but it does not replace correct source generation or API compatibility.

## Immediate integration sequence

1. Keep this web repository's current safe JAR validation and honest unsupported result.
2. Pin and vendor only the reusable Horizon Porter crates/data, retaining MIT notices, after the API compatibility gate is resolved.
3. Add a native Rust runner outside the Cloudflare Worker.
4. Connect the website to asynchronous jobs and downloadable `.hmod` plus `.hnmod` artifacts.
5. Add the optional AI provider path only when users can choose it knowingly and it can be operated securely.

Until the runner exists, the website must not imply that Horizon Porter has been integrated or that arbitrary mods can be converted.
