# JAR → HNMOD

A Next.js service for inspecting Minecraft Java mod JARs and preparing native Horizon bundles.

## Run locally

1. Install Node.js 20+
2. Run `npm install`
3. Run `npm run dev`
4. Open http://localhost:3000

## Current functionality

- Drag-and-drop JAR upload (25 MB limit)
- ZIP path traversal, entry-count and expanded-size checks
- Fabric, Quilt, Forge, NeoForge and legacy Forge identification
- Fabric metadata, dependency, entrypoint and Mixin discovery
- JVM class-file and bytecode inspection
- A deliberately narrow Java-to-Rust micro-translator for pure static integer methods
- A reviewed AppleSkin native Rust implementation, packaged as a Horizon `.hnmod` candidate

## Current Horizon .hmod asset conversion

The site now has a separate content-only conversion path for Fabric/Quilt JARs that contain passive `assets/` files and no Java classes, mixins, entrypoints or `data/` files. It writes a Horizon `.hmod` ZIP with a `horizon-mod.toml` manifest and the original asset paths.

This is deliberately not a Java gameplay converter. It does not translate code, Mixin behavior, data-driven gameplay or dependencies. It rejects those archives rather than silently dropping their behavior. The package format follows the current Horizon content-mod layout; it is separate from the legacy Starling 0.9.0 `.hnmod` AppleSkin candidate below.

## Starling 0.9.0 target

Starling 0.9.0 still imports Horizon native mods as `.hnmod` bundles, but it uses a newer Horizon native-mod API. Bundles must target matching Horizon and Horizon Mixins revisions. Starling documents compatibility adaptation for supported older hook names.

The AppleSkin bundle is now pinned to the Starling 0.9.0 Horizon revision and uses the current Horizon Mixins revision. This is a compatibility retarget, not proof of a successful native build. It must still pass the full native build and an in-game Starling 0.9.0 test before it can be called working.

## Horizon Porter integration

We have identified [Horizon Porter](https://github.com/kevinbonomi2-bit/horizon-porter) as the stronger upstream conversion engine. Its Rust crates cover Java mod analysis, content conversion, Mixin mapping, native bundle generation and optional AI-assisted method translation. Integration requirements and compatibility gates are documented in [docs/HORIZON-PORTER-INTEGRATION.md](docs/HORIZON-PORTER-INTEGRATION.md).

This is an integration plan, not a claim that the Porter is already running on this website. The current Cloudflare Worker cannot execute its native Rust/Java/Cargo pipeline. A separate Rust job runner and a verified Starling 0.9.0 API target are required before generated downloads can be enabled.

## Deterministic conversion policy

There is no AI service, external model call, API key, or paid conversion dependency.

The service only emits a bundle when it has a real native Rust implementation for that exact mod build. Other JARs receive a clear explanation that no verified port exists yet. The service does not rename a JAR, create empty Rust stubs, or label metadata inspection as gameplay conversion.

A general Java-to-Rust translator still needs real mappings for Minecraft APIs, Fabric/Forge entrypoints, Mixin injection behavior, resources, dependencies and game lifecycle. Arbitrary Java mods cannot be guaranteed to convert automatically when Horizon does not expose equivalent behavior.

## Cloudflare Workers

The app uses the OpenNext Cloudflare adapter.

- `npm run build:worker` builds and adapts the app for Workers.
- `npm run preview:worker` builds and previews the Worker locally.
- `npm run deploy:worker` builds and deploys to the authenticated Cloudflare account.
- `npm run cf-typegen` generates Cloudflare binding types.

Before deploying, authenticate Wrangler with `npx wrangler login`. Alternatively, connect this repository in Cloudflare Workers Builds and configure the build command as `npm run build:worker` and the deploy command as `npx wrangler deploy`.

Do not commit Cloudflare API tokens, account credentials, or local `.dev.vars` files. Production secrets belong in Cloudflare Worker settings.

## Deployment status

Cloudflare configuration is prepared in this repository. A code push is not proof of a successful production deployment; verify the Worker build and deployment logs before treating a change as live.
