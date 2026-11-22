import JSZip from "jszip";
import { NextResponse } from "next/server";
import { packageAssetHmod } from "@/lib/hmod-content-packager";

export const runtime = "nodejs";
const MAX_FILE = 25 * 1024 * 1024;
const MAX_ENTRIES = 5000;
const MAX_EXPANDED = 100 * 1024 * 1024;
const SAFE_ID = /^[a-z0-9_]{1,64}$/;
const SAFE_VERSION = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const item = form.get("file");
    if (!(item instanceof File)) return NextResponse.json({ error: "Choose a JAR file first." }, { status: 400 });
    if (!item.name.toLowerCase().endsWith(".jar")) return NextResponse.json({ error: "Only .jar files are accepted." }, { status: 400 });
    if (item.size > MAX_FILE) return NextResponse.json({ error: "File exceeds the 25 MB limit." }, { status: 413 });

    const zip = await JSZip.loadAsync(Buffer.from(await item.arrayBuffer()), { checkCRC32: true });
    const entries = Object.values(zip.files).filter(entry => !entry.dir);
    if (entries.length > MAX_ENTRIES) return NextResponse.json({ error: "Archive contains too many files." }, { status: 400 });

    let expanded = 0;
    for (const entry of entries) {
      const normalized = entry.name.replace(/\\/g, "/");
      if (normalized.startsWith("/") || normalized.split("/").some(part => part === ".." || part === "." || part === "")) {
        return NextResponse.json({ error: "Archive contains an unsafe path." }, { status: 400 });
      }
      const meta = entry as unknown as { _data?: { uncompressedSize?: number } };
      expanded += meta._data?.uncompressedSize ?? 0;
      if (expanded > MAX_EXPANDED) return NextResponse.json({ error: "Expanded archive is too large." }, { status: 413 });
    }

    const names = entries.map(entry => entry.name);
    const metadataFile = zip.file("fabric.mod.json") ?? zip.file("quilt.mod.json");
    if (!metadataFile) {
      return NextResponse.json({ error: "This conversion path needs Fabric or Quilt metadata. Forge/NeoForge and metadata-free archives are not supported here." }, { status: 422 });
    }
    const metadataText = await metadataFile.async("string");
    if (metadataText.length > 1024 * 1024) return NextResponse.json({ error: "Mod metadata is too large." }, { status: 400 });
    let metadata: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(metadataText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid metadata.");
      metadata = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Mod metadata is invalid JSON." }, { status: 400 });
    }

    const quiltLoader = metadata.quilt_loader && typeof metadata.quilt_loader === "object"
      ? metadata.quilt_loader as Record<string, unknown>
      : null;
    const quiltMetadata = quiltLoader?.metadata && typeof quiltLoader.metadata === "object"
      ? quiltLoader.metadata as Record<string, unknown>
      : null;
    const id = typeof metadata.id === "string" ? metadata.id : typeof quiltLoader?.id === "string" ? quiltLoader.id : "";
    const version = typeof metadata.version === "string" ? metadata.version : typeof quiltLoader?.version === "string" ? quiltLoader.version : "";
    const name = typeof metadata.name === "string" ? metadata.name : typeof quiltMetadata?.name === "string" ? quiltMetadata.name : id;
    const description = typeof metadata.description === "string" ? metadata.description : typeof quiltMetadata?.description === "string" ? quiltMetadata.description : "";
    if (!SAFE_ID.test(id) || !SAFE_VERSION.test(version) || !name.trim()) {
      return NextResponse.json({ error: "The mod metadata needs a valid id, version and name before it can be packaged." }, { status: 422 });
    }

    const hasClasses = names.some(path => path.toLowerCase().endsWith(".class"));
    const hasMixinConfig = names.some(path => /\.mixins?\.json$/i.test(path));
    const hasEntrypoints = Boolean(metadata.entrypoints && typeof metadata.entrypoints === "object" && Object.keys(metadata.entrypoints as object).length);
    const hasData = names.some(path => path.startsWith("data/"));
    if (hasClasses || hasMixinConfig || hasEntrypoints || hasData) {
      return NextResponse.json({
        error: "This JAR contains gameplay code, mixins, entrypoints or data files. This safe .hmod path only converts passive assets (textures, models, sounds and language files); it does not translate Java behavior.",
        detected: { classes: hasClasses, mixins: hasMixinConfig, entrypoints: hasEntrypoints, data_files: hasData },
        conversion: "No output was generated."
      }, { status: 422 });
    }

    const assetEntries = entries.filter(entry => entry.name.startsWith("assets/"));
    if (!assetEntries.length) {
      return NextResponse.json({ error: "No assets/ files were found. There is nothing this content-only converter can package." }, { status: 422 });
    }
    const files = [];
    for (const entry of assetEntries) {
      const path = entry.name.replace(/\\/g, "/");
      const parts = path.split("/");
      if (parts.length < 3 || parts.some(part => !/^[a-z0-9_.-]+$/.test(part))) {
        return NextResponse.json({ error: `Unsafe resource path: ${path}` }, { status: 400 });
      }
      files.push({ path, bytes: await entry.async("uint8array") });
    }

    const bundle = await packageAssetHmod({ id, name, version, description, files });
    return new Response(new Uint8Array(bundle.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${bundle.fileName}"`,
        "Content-Length": String(bundle.bytes.byteLength),
        "X-Conversion-Status": "hmod-passive-assets",
        "X-Conversion-Assets": String(bundle.assetCount),
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "This JAR could not be converted.",
      conversion: "No output was generated."
    }, { status: 422 });
  }
}
