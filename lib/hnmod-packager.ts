import JSZip from "jszip";
import { HORIZON_HOOKS } from "@/lib/horizon-hooks";

export const HORIZON_GAME_VERSION = "26.3";
export const HORIZON_REVISION = "ba6344a59cb9e755b730dcf02285fc0d33b97d3c";
export const HORIZON_MIXINS_REVISION = "d9c83d7096b7ea5b83678da2efdfd6161f74997e";

export type NativeBundleInput = {
  id: string;
  version: string;
  horizonRevision: string;
  mixinsRevision: string;
  mixinManifest: string;
  sources: Record<string, string>;
};

export type NativeBundleOutput = {
  fileName: string;
  bytes: Buffer;
  sha256: string;
  entries: string[];
};

const SAFE_ID = /^[a-z0-9_]+$/;
const SAFE_VERSION = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/;
const SAFE_SOURCE = /^[a-zA-Z0-9_-]+\.(rs|toml)$/;
const FIXED_DATE = new Date("2026-01-01T00:00:00.000Z");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/**
 * Preflight named-hook references against the exact pinned Horizon catalog.
 * This catches stale hook names/versions before packaging; it does not replace
 * Horizon Mixins plan/apply or Rust compilation.
 */
export function validateNamedHookReferences(manifest: string): void {
  const blocks = manifest.split(/^\\[\\[injection\\]\\]\\s*$/m).slice(1)
    .map(section => section.split(/^\\[/m, 1)[0]);
  for (const block of blocks) {
    const hook = /^\\s*hook\\s*=\\s*"([^"]+)"\\s*$/m.exec(block)?.[1];
    const versionText = /^\\s*hook_version\\s*=\\s*(\\d+)\\s*$/m.exec(block)?.[1];
    const hasTarget = /^\\s*target\\s*=/m.test(block);
    if (hook && hasTarget) throw new Error("An injection cannot define both a named hook and a raw target.");
    if (!hook && versionText) throw new Error("hook_version requires a named hook.");
    if (hook && !versionText) throw new Error(`Named hook "${hook}" requires hook_version.`);
    if (hook) {
      const expected = HORIZON_HOOKS.find(item => item.name === hook);
      if (!expected) throw new Error(`Unknown Horizon hook "${hook}" in the pinned hook catalog.`);
      if (Number(versionText) !== expected.version) {
        throw new Error(`Horizon hook "${hook}" requires contract version ${expected.version}, not ${versionText}.`);
      }
    }
  }
}

function readTomlString(source: string, section: string, key: string): string | null {
  const escapedSection = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionMatch = new RegExp(`(?:^|\\n)\\[${escapedSection}\\]\\s*\\n([\\s\\S]*?)(?=\\n\\[|$)`).exec(source);
  if (!sectionMatch) return null;
  const keyMatch = new RegExp(`(?:^|\\n)\\s*${key}\\s*=\\s*"([^"\\n]*)"`).exec(sectionMatch[1]);
  return keyMatch?.[1] ?? null;
}

/**
 * Builds the source-only archive format consumed by Horizon's native-mod registry.
 * This is deliberately a packager, not a Java-to-Rust translator: callers must
 * provide real, reviewed Rust sources and a matching Horizon Mixins manifest.
 */
export async function packageNativeBundle(input: NativeBundleInput): Promise<NativeBundleOutput> {
  assert(SAFE_ID.test(input.id), "Mod id must use lowercase letters, digits and underscores.");
  assert(SAFE_VERSION.test(input.version), "Mod version contains unsupported characters.");
  assert(input.horizonRevision === HORIZON_REVISION, "Horizon revision does not match the pinned template.");
  assert(input.mixinsRevision === HORIZON_MIXINS_REVISION, "Horizon Mixins revision does not match the pinned template.");
  assert(input.mixinManifest.trim().length > 0, "A horizon-mixin.toml manifest is required.");
  assert(readTomlString(input.mixinManifest, "mod", "id") === input.id, "Manifest mod.id does not match the bundle id.");
  assert(readTomlString(input.mixinManifest, "mod", "version") === input.version, "Manifest mod.version does not match the bundle version.");
  assert(readTomlString(input.mixinManifest, "compatibility", "horizon_revision") === input.horizonRevision, "Manifest Horizon revision does not match the pinned revision.");
  validateNamedHookReferences(input.mixinManifest);

  const sourceEntries = Object.entries(input.sources);
  assert(sourceEntries.length > 0, "A native bundle must contain generated source files.");
  const sourceNames = new Set<string>();
  for (const [name, source] of sourceEntries) {
    assert(SAFE_SOURCE.test(name), `Unsafe or unsupported source filename: ${name}`);
    assert(!sourceNames.has(name), `Duplicate source filename: ${name}`);
    assert(typeof source === "string" && source.trim().length > 0, `Source file ${name} is empty.`);
    assert(Buffer.byteLength(source, "utf8") <= 1024 * 1024, `Source file ${name} exceeds 1 MB.`);
    sourceNames.add(name);
  }

  const referencedSources = [
    ...[...input.mixinManifest.matchAll(/^\s*source\s*=\s*"([^"]+)"\s*$/gm)].map(match => match[1]),
    ...[...input.mixinManifest.matchAll(/^\s*helper\s*=\s*"([^"]+)"\s*$/gm)].map(match => match[1])
  ];
  assert(referencedSources.length > 0, "Manifest must declare at least one module source or injection helper.");
  for (const name of referencedSources) {
    assert(SAFE_SOURCE.test(name), `Manifest references an unsafe source filename: ${name}`);
    assert(sourceNames.has(name), `Manifest references missing source file: ${name}`);
  }

  // Match tools/package.py in the official template: JSON keys are sorted.
  const nativeManifest = Object.fromEntries(Object.entries({
    schema: 1,
    id: input.id,
    version: input.version,
    game: HORIZON_GAME_VERSION,
    horizon: input.horizonRevision,
    mixins: input.mixinsRevision
  }).sort(([left], [right]) => left.localeCompare(right)));

  const files: Record<string, string> = {
    "horizon-native.json": JSON.stringify(nativeManifest, null, 2) + "\n",
    [`mixins/${input.id}/horizon-mixin.toml`]: input.mixinManifest.trimEnd() + "\n"
  };
  for (const [name, source] of sourceEntries) files[`mixins/${input.id}/${name}`] = source.endsWith("\n") ? source : source + "\n";

  const zip = new JSZip();
  for (const name of Object.keys(files).sort()) {
    zip.file(name, files[name], { date: FIXED_DATE, unixPermissions: 0o100644, createFolders: false });
  }
  const totalSourceBytes = Object.values(files).reduce((sum, source) => sum + Buffer.byteLength(source, "utf8"), 0);
  assert(totalSourceBytes <= 5 * 1024 * 1024, "Generated native bundle exceeds the 5 MB source limit.");

  const bytes = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "UNIX"
  });

  // Re-open the archive before returning it. A successful ZIP write alone does
  // not prove the bundle has the exact paths and bytes the Horizon loader expects.
  const verified = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const actualEntries = Object.values(verified.files).filter(entry => !entry.dir).map(entry => entry.name).sort();
  const expectedEntries = Object.keys(files).sort();
  assert(JSON.stringify(actualEntries) === JSON.stringify(expectedEntries), "Generated archive entry list failed verification.");
  for (const name of expectedEntries) {
    const entry = verified.file(name);
    assert(entry, `Generated archive is missing ${name}.`);
    const actual = await entry.async("string");
    assert(actual === files[name], `Generated archive content mismatch for ${name}.`);
  }

  const { createHash } = await import("node:crypto");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return {
    fileName: `${input.id}-${input.version}.hnmod`,
    bytes,
    sha256,
    entries: Object.keys(files).sort()
  };
}
