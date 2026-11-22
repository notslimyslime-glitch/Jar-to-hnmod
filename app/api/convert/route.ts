import JSZip from "jszip";
import { NextResponse } from "next/server";
import { HORIZON_MIXINS_REVISION } from "@/lib/hnmod-packager";
import { HORIZON_REVISION } from "@/lib/horizon-hooks";
import { packageNativeBundle } from "@/lib/hnmod-packager";
import { translateFabricMetadata } from "@/lib/fabric-metadata-translator";

export const runtime = "nodejs";
const MAX_FILE = 25 * 1024 * 1024;
const MAX_ENTRIES = 5000;
const MAX_EXPANDED = 100 * 1024 * 1024;

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
      if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
        return NextResponse.json({ error: "Archive contains an unsafe path." }, { status: 400 });
      }
      const meta = entry as unknown as { _data?: { uncompressedSize?: number } };
      expanded += meta._data?.uncompressedSize ?? 0;
      if (expanded > MAX_EXPANDED) return NextResponse.json({ error: "Expanded archive is too large." }, { status: 413 });
    }

    const metadataFile = zip.file("fabric.mod.json");
    if (!metadataFile) return NextResponse.json({ error: "This first translator only supports Fabric JARs with fabric.mod.json." }, { status: 400 });
    const raw = await metadataFile.async("string");
    if (raw.length > 2 * 1024 * 1024) return NextResponse.json({ error: "Fabric metadata is too large." }, { status: 400 });
    const metadata: unknown = JSON.parse(raw);
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return NextResponse.json({ error: "fabric.mod.json must contain a JSON object." }, { status: 400 });
    }
    const data = metadata as Record<string, unknown>;
    const entrypoints = data.entrypoints && typeof data.entrypoints === "object" && !Array.isArray(data.entrypoints)
      ? data.entrypoints as Record<string, unknown>
      : {};
    const entrypointCount = Object.values(entrypoints).reduce<number>((sum, value) => sum + (Array.isArray(value) ? value.length : value ? 1 : 0), 0);
    const names = entries.map(entry => entry.name);
    const mixinConfigs = names.filter(name => name.toLowerCase().endsWith(".mixins.json") || name.toLowerCase().endsWith(".mixin.json"));
    const declaredMixins = Array.isArray(data.mixins) ? data.mixins.length : 0;
    const classFiles = names.filter(name => name.endsWith(".class")).length;

    const translated = translateFabricMetadata({
      metadata: data,
      classFiles,
      mixinConfigs: Math.max(mixinConfigs.length, declaredMixins),
      entrypointCount
    });

    const bundle = await packageNativeBundle({
      id: translated.id,
      version: translated.version,
      horizonRevision: HORIZON_REVISION,
      mixinsRevision: HORIZON_MIXINS_REVISION,
      mixinManifest: translated.manifest,
      sources: translated.sources
    });

    return new Response(new Uint8Array(bundle.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${bundle.fileName}"`,
        "Content-Length": String(bundle.bytes.byteLength),
        "X-Conversion-Status": "experimental-metadata-only",
        "X-Conversion-SHA256": bundle.sha256,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "This JAR could not be converted by the metadata-only translator.",
      conversion: "No output was generated."
    }, { status: 422 });
  }
}
