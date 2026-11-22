# JAR → HNMOD

A Next.js web app for inspecting Minecraft Java mod JARs and preparing native Horizon conversions.

## Run locally

1. Install Node.js 20+
2. Run `npm install`
3. Run `npm run dev`
4. Open http://localhost:3000

## Current functionality

- Drag-and-drop JAR upload
- 25 MB upload limit, archive entry and expanded-size limits
- ZIP path traversal checks
- Multi-loader archive identification for Fabric, Quilt, Forge, NeoForge and legacy Forge
- Fabric metadata, dependency, entrypoint and mixin discovery
- JVM class-file and bytecode inspection
- Experimental, deliberately narrow Java-to-Rust translation
- Native HNMOD packaging checks for supported metadata-only cases

## Loader coverage versus conversion coverage

The analyzer can identify common Fabric, Quilt, Forge and NeoForge archive formats. Identification is not conversion: the only gameplay conversion currently implemented is the reviewed, exact-version AppleSkin native port. Other JARs are inspected and classified, then rejected rather than packaged as fake working mods.

## Important conversion limitation

This project does not translate arbitrary Java bytecode or Minecraft mod behavior into equivalent Rust. A JAR is never executed. Unsupported gameplay behavior must be reported as unsupported or require a verified, version-specific translator. Generated output must not be presented as a working gameplay conversion unless it has passed the native build and runtime checks.

## Cloudflare Workers

The app uses the OpenNext Cloudflare adapter so its Next.js pages and API route handlers can run on Cloudflare Workers.

- `npm run build:worker` builds the Next.js app and adapts it for Workers.
- `npm run preview:worker` builds and previews the Worker locally.
- `npm run deploy:worker` builds and deploys to the authenticated Cloudflare account.
- `npm run cf-typegen` generates Cloudflare binding types.

Before deploying, authenticate Wrangler with `npx wrangler login`. Alternatively, connect this GitHub repository in Cloudflare Workers Builds and configure the build command as `npm run build:worker` and the deploy command as `npx wrangler deploy`.

Do not commit Cloudflare API tokens, account credentials, or local `.dev.vars` files. Production secrets belong in Cloudflare's Worker settings.

## Deployment status

Cloudflare configuration is prepared in this repository. It is not deployed until a Cloudflare account is connected and a successful Worker deployment is verified.
