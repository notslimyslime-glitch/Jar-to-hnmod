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
- Reviewed, exact-version AppleSkin native port packaging
- Optional Gemini-assisted native Rust draft generation for other JARs (unverified until compiled and runtime-tested)

## Loader coverage versus conversion coverage

The analyzer can identify common Fabric, Quilt, Forge and NeoForge archive formats. AppleSkin has one reviewed, exact-version native port. Other JARs can use the optional Gemini-assisted draft path: the service inspects class-file structure, sends bounded metadata/bytecode summaries to Gemini, and asks it for a candidate Rust helper targeting a known Horizon hook. This is a best-effort draft generator, not a universal Java-to-Rust compiler. It can refuse a mod, and any generated bundle remains unverified until it compiles and passes a Starling runtime test.

## Important conversion limitation

This project does not translate arbitrary Java bytecode or Minecraft mod behavior into equivalent Rust. A JAR is never executed. Unsupported gameplay behavior must be reported as unsupported or require a verified, version-specific translator. Generated output must not be presented as a working gameplay conversion unless it has passed the native build and runtime checks.

## Optional Gemini-assisted conversion

The AI draft path uses Google's Gemini Developer API (gemini-2.5-flash). It is disabled unless the server has a GEMINI_API_KEY secret.

- For local development, put GEMINI_API_KEY=... in an ignored local .env.local file.
- For Cloudflare Workers, add GEMINI_API_KEY as a runtime secret in the Worker settings. Never put the key in client-side code, a NEXT_PUBLIC_* variable, or Git.
- The API's free tier has quotas and can change. A 429 response means the free-tier limit was reached.
- The AI receives bounded class-file summaries and mod metadata, not the original JAR as an executable or uploaded binary. Google's free-tier terms state submitted content may be used to improve Google products, so do not send private or proprietary mods through this path.
- The output is explicitly marked unverified-ai-draft. The packager checks archive structure and known hook names, but does not compile the generated Rust or prove behavior. Treat it as a starting point for review, not a working conversion.
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
