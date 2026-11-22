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
- Fabric metadata, dependency, entrypoint and mixin discovery
- Downloadable JSON analysis report

## Important limitation
This first version analyzes JARs only. It does not translate arbitrary Java bytecode or mixin behavior into correct Rust native hooks, and it does not generate an HNMOD yet. Uploaded Java code is never executed. Native mods can have game-level privileges, so future generated source must be reviewed and tested.

## Deployment
Import this repository into Vercel and deploy using the default Next.js settings. No environment variables are required for the analyzer-only version.
