/**
 * Detects common Minecraft mod-loader formats from archive metadata.
 * Detection is identification only; it does not imply conversion support.
 */
export type ModPlatform = "Fabric" | "Quilt" | "Forge" | "NeoForge" | "Legacy Forge" | "Unknown";

export function detectModPlatform(input: {
  names: string[];
  manifest?: string | null;
}): ModPlatform {
  const normalized = new Set(input.names.map(name => name.replaceAll("\\", "/").toLowerCase()));
  if (normalized.has("fabric.mod.json")) return "Fabric";
  if (normalized.has("quilt.mod.json")) return "Quilt";
  if (normalized.has("meta-inf/neoforge.mods.toml")) return "NeoForge";
  if (normalized.has("meta-inf/mods.toml")) return "Forge";
  if (/fmlcoreplugin|modside|tweakclass/i.test(input.manifest ?? "")) return "Legacy Forge";
  return "Unknown";
}
