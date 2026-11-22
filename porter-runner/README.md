# Horizon Porter job runner

This is a separate Docker service because Cloudflare Workers cannot run Horizon Porter's native Rust/Java toolchain.

## Deploy

Create a Render Blueprint from this repository and select `render.yaml`. Render builds the pinned Horizon Porter CLI and runs it behind a token-protected HTTP endpoint. The free instance can sleep and has limited CPU/RAM; first requests may be slow or fail for large mods.

After deployment:
1. Copy the generated `RUNNER_API_TOKEN` from the Render service environment.
2. Set `HORIZON_PORTER_RUNNER_URL` on the website to the service base URL (no trailing slash).
3. Set `HORIZON_PORTER_RUNNER_TOKEN` on the website to the same token.
4. Redeploy the website.

The runner returns a ZIP containing actual Porter-produced `.hnmod` and/or `.hmod` packages plus `PORTING.md`. It does not run AI translation. Native behavior may still be TODO stubs, so output is a candidate, not a verified working port. Do not remove the status file or claim all Java behavior was converted.

The public endpoint accepts JARs up to 25 MB and runs the pinned CLI with a temporary per-request workspace. No uploaded JARs are intentionally retained after the request.
