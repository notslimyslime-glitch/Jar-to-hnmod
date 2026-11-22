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

## Horizon Porter conversion engine

The repository now includes a separate Docker job runner in `porter-runner/`. It builds the pinned [Horizon Porter](https://github.com/kevinbonomi2-bit/horizon-porter) CLI, decompiles JARs with Vineflower, generates a Horizon port, and packages the actual `.hnmod` and/or `.hmod` files. The website's one-click `/api/convert-auto` route calls this runner when its URL and token are configured.

**Important:** Porter’s deterministic pass can generate native scaffolding and a porting checklist, but it does not automatically translate every Java method. The runner deliberately does not call a paid AI model. Its ZIP includes `PORTING.md` and a status note explaining that generated native logic may still contain TODO stubs. Treat the result as a candidate, not a guaranteed working mod.

### Connect the runner

1. Open the repository's `render.yaml` as a Render Blueprint and deploy the `jar-to-hnmod-porter` service.
2. Copy the generated `RUNNER_API_TOKEN` from that service's environment settings.
3. In the website's Cloudflare Worker environment, set `HORIZON_PORTER_RUNNER_URL` to the Render service URL (without a trailing slash).
4. Set `HORIZON_PORTER_RUNNER_TOKEN` to the same token, then redeploy the Worker.

The Render free service can sleep, has limited memory and may struggle with large mods. The runner accepts JARs up to 25 MB and uses temporary storage per conversion. Do not expose the runner without its token.

See [porter-runner/README.md](porter-runner/README.md) and [the integration notes](docs/HORIZON-PORTER-INTEGRATION.md) for details.

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
