# JAR → HNMOD

A Next.js web app for inspecting Minecraft Java mod JARs and preparing native Horizon conversions.

## Run locally
1. Install Node.js 20+
2. Run `npm install`
3. Copy `.env.example` to `.env.local` and fill in the AI Gateway settings (optional for archive analysis)
4. Run `npm run dev`
5. Open http://localhost:3000

## Current functionality
- Drag-and-drop JAR upload
- 25 MB upload limit, archive entry and expanded-size limits
- ZIP path traversal checks
- Fabric metadata, dependency, entrypoint and mixin discovery
- Downloadable JSON analysis report
- Optional AI migration plan based on the scan metadata

## Configure the AI planner
Create an AI Gateway API key in your Vercel account, then set these environment variables in Vercel Project Settings → Environment Variables (or in local `.env.local`):

- `AI_GATEWAY_API_KEY`: your private AI Gateway key
- `AI_GATEWAY_MODEL`: a currently supported model ID in `provider/model` format

The key is used only by the server-side `/api/ai-plan` route. Never put it in a `NEXT_PUBLIC_*` variable or browser code. AI requests go through Vercel AI Gateway's OpenAI-compatible Chat Completions endpoint. The route includes a best-effort per-instance request limit, but that is not a complete production abuse shield. Before making the site public, configure a Vercel Firewall rate limit and an AI Gateway spend budget.

## Important limitations
The app still does **not** translate arbitrary Java bytecode or mixin behavior into correct Rust native hooks, and it does **not** generate an HNMOD. The AI planner receives archive metadata only, not the Java source or bytecode, so it can propose an inspection and migration plan but cannot verify behavior or produce a working native port. Uploaded Java code is never executed. Native mods can have game-level privileges, so generated source must be reviewed and tested before use.

## Deployment
Import this repository into Vercel and deploy using the default Next.js settings. Add the two AI Gateway environment variables to enable the AI planner. Archive analysis works without them.
