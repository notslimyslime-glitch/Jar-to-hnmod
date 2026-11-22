/**
 * Verified native hook contracts from horizon-rust/horizon revision
 * ba6344a59cb9e755b730dcf02285fc0d33b97d3c (NATIVE_HOOKS_API = 3).
 * `version` is the per-hook contract version from native-hooks.json. `api_since` is when Horizon added the hook to its overall API. They are not interchangeable. Signatures are source-level contracts, not auto-mappable Java APIs.
 */
export const HORIZON_REVISION = "ba6344a59cb9e755b730dcf02285fc0d33b97d3c";
export const HORIZON_HOOKS_API = 3;

export const HORIZON_HOOKS = [
  { name: "frame", version: 1, api_since: 1, signature: "(&mut Game, Duration)", timing: "once per frame, in or out of a world", purpose: "Frame-based client updates and overlays", target: "horizon_client::game::native_hooks::Game<'_>::native_frame" },
  { name: "tick", version: 1, api_since: 1, signature: "(&mut Game)", timing: "once per game tick", purpose: "Tick-based updates", target: "horizon_client::game::native_hooks::Game<'_>::native_tick" },
  { name: "world_lifecycle", version: 1, api_since: 3, signature: "(&mut Game, &NativeLifecycleContext, WorldPhase, &str)", timing: "server-side world lifecycle phases", purpose: "World open, close and failure notifications", target: "horizon_client::game::native_hooks::Game<'_>::native_world_lifecycle" },
  { name: "hud", version: 1, api_since: 1, signature: "(&mut Game, &mut HudBatch, &mut Corners)", timing: "HUD pass after minimap; not drawn under F1", purpose: "Draw native HUD overlays", target: "horizon_client::game::native_hooks::Game<'_>::native_hud" },
  { name: "key", version: 1, api_since: 1, signature: "(&mut Game, &str, bool)", timing: "key or mouse button down/up; repeats excluded", purpose: "Receive input events", target: "horizon_client::game::native_hooks::Game<'_>::native_key" },
  { name: "wheel", version: 1, api_since: 1, signature: "(&mut Game, f32, &mut bool)", timing: "mouse wheel steps while playing", purpose: "Observe or claim wheel input", target: "horizon_client::game::native_hooks::Game<'_>::native_wheel" },
  { name: "command", version: 1, api_since: 1, signature: "(&mut Game, &str, &mut bool)", timing: "chat command before server and Horizon commands", purpose: "Handle custom commands", target: "horizon_client::game::native_hooks::Game<'_>::native_command" },
  { name: "zoom", version: 1, api_since: 1, signature: "(&Game, &mut Option<NativeZoom>)", timing: "while playing; spyglass takes priority", purpose: "Request a custom camera zoom", target: "horizon_client::game::native_hooks::Game<'_>::native_zoom" },
  { name: "minimap", version: 1, api_since: 1, signature: "(&Game, &mut Option<NativeMinimap>)", timing: "minimap update", purpose: "Provide minimap configuration", target: "horizon_client::game::native_hooks::Game<'_>::native_minimap" },
  { name: "mods", version: 1, api_since: 1, signature: "(&mut Game, &mut Vec<NativeMod>)", timing: "when Options > Mods rows are built", purpose: "Register native mod information", target: "horizon_client::game::native_hooks::Game<'_>::native_mods" },
  { name: "settings", version: 1, api_since: 1, signature: "(&mut Game, &str, &mut Vec<String>)", timing: "when a mod settings page opens or refreshes", purpose: "Provide settings button labels", target: "horizon_client::game::native_hooks::Game<'_>::native_settings" },
  { name: "settings_click", version: 1, api_since: 1, signature: "(&mut Game, &str, usize)", timing: "when a mod settings button is clicked", purpose: "Handle settings button actions", target: "horizon_client::game::native_hooks::Game<'_>::native_settings_click" },
  { name: "panel_event", version: 1, api_since: 2, signature: "(&mut Game, &str, &NativePanelEvent)", timing: "when the player interacts with a native mod panel", purpose: "Handle panel clicks, searches, keys and recipe actions", target: "horizon_client::game::native_hooks::Game<'_>::native_panel_event" }
] as const;
