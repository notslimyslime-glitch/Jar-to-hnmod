import JSZip from "jszip";

const ID = /^[a-z0-9_]{1,64}$/;
const VERSION = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/;
const FIXED_DATE = new Date("2026-01-01T00:00:00.000Z");

export type ContentFile = { path: string; bytes: Uint8Array };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]/g, " ")}"`;
}

/**
 * Packages passive assets from a Java mod as a Horizon content-only .hmod.
 * It intentionally refuses Java code, mixins and data/ gameplay files.
 */
export async function packageAssetHmod(input: {
  id: string;
  name: string;
  version: string;
  description?: string;
  files: ContentFile[];
}) {
  assert(ID.test(input.id), "The mod id must use lowercase letters, digits and underscores (max 64).");
  assert(VERSION.test(input.version), "The mod version contains unsupported characters.");
  assert(input.files.length > 0, "No supported assets were found.");

  const seen = new Set<string>();
  const zip = new JSZip();
  const manifest = [
    `id = ${tomlString(input.id)}`,
    `name = ${tomlString(input.name)}`,
    `version = ${tomlString(input.version)}`,
    `description = ${tomlString(input.description || "Resource assets converted from a Java mod.")}`,
    'api = "0.2"',
    'side = "client"',
    'capabilities = ["registries"]',
    ""
  ].join("\n");
  zip.file("horizon-mod.toml", manifest, { date: FIXED_DATE, unixPermissions: 0o100644 });

  let total = 0;
  for (const file of input.files) {
    assert(!file.path.includes("\\"), `Unsupported Horizon resource path: ${file.path}`);
    const path = file.path;
    const parts = path.split("/");
    assert(path.startsWith("assets/") && parts.length >= 3, `Unsupported asset path: ${path}`);
    assert(parts[1] === input.id, `Asset namespace "${parts[1]}" does not match mod id "${input.id}".`);
    assert(parts.every(part => part !== "." && part !== ".." && /^[a-z0-9_.-]+$/.test(part)), `Unsupported Horizon resource path: ${path}`);
    assert(!seen.has(path), `Duplicate asset path: ${path}`);
    assert(file.bytes.byteLength > 0, `Empty asset: ${path}`);
    seen.add(path);
    total += file.bytes.byteLength;
    assert(total <= 100 * 1024 * 1024, "Expanded assets exceed the 100 MB limit.");
    zip.file(path, file.bytes, { date: FIXED_DATE, unixPermissions: 0o100644, createFolders: false });
  }

  const bytes = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "UNIX"
  });
  const verified = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const manifestEntry = verified.file("horizon-mod.toml");
  assert(manifestEntry && await manifestEntry.async("string") === manifest, "Generated .hmod manifest failed verification.");
  for (const file of input.files) {
    const actual = verified.file(file.path);
    assert(actual, `Generated .hmod is missing ${file.path}.`);
    const bytesOut = await actual.async("uint8array");
    assert(bytesOut.length === file.bytes.length && bytesOut.every((value, index) => value === file.bytes[index]), `Generated .hmod asset mismatch: ${file.path}`);
  }
  return { bytes, fileName: `${input.id}-assets-${input.version}.hmod`, assetCount: input.files.length };
}
