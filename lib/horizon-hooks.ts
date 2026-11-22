/**
 * Horizon's named native hook catalog from horizon-rust/horizon at
 * ba6344a59cb9e755b730dcf02285fc0d33b97d3c.
 * Keep this list pinned to the same revision used by generated bundles.
 */
export const HORIZON_REVISION = "ba6344a59cb9e755b730dcf02285fc0d33b97d3c";

export const HORIZON_HOOKS = [
  { name: "frame", version: 1, target: "horizon_client::game::native_hooks::Game<'_>::native_frame" },
  { name: "tick", version: 1, target: "horizon_client::game::native_hooks::Game<'_>::native_tick" },
  { name: "world_lifecycle", version: 1, target: "horizon_client::game::native_hooks::Game<'_>::native_world_lifecycle" },
  { name: "hud", version: 1, target: "horizon_client::game::native_hooks::Game<'_>::native_hud" },
  { name: "key", version: 1, target: "horizon_client::game::native_hooks::Game<'_>::native_key" },
  { name: "wheel", version: 1, target: "horizon_client::game::native_hooks::Game<'_>::native_wheel" },
  { name: "command", version: 1, target: "horizon_client::game::native_hooks::Game<'_>::native_command" },
  { name: "zoom", version: 1, target: "horizon_client::game::native_hooks::Game<'_>::native_zoom" },
  { name: "minimap", version: 1, target: "horizon_client::game::native_hooks::Game<'_>::native_minimap" },
  { name: "mods", version: 1, target: "horizon_client::game::native_hooks::Game<'_>::native_mods" },
  { name: "settings", version: 1, target: "horizon_client::game::native_hooks::Game<'_>::native_settings" },
  { name: "settings_click", version: 1, target: "horizon_client::game::native_hooks::Game<'_>::native_settings_click" },
  { name: "panel_event", version: 1, target: "horizon_client::game::native_hooks::Game<'_>::native_panel_event" }
] as const;
