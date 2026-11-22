import JSZip from "jszip";
import { NextResponse } from "next/server";
import { HORIZON_MIXINS_REVISION, packageNativeBundle } from "@/lib/hnmod-packager";
import { HORIZON_REVISION } from "@/lib/horizon-hooks";
import { APPLESKIN_SOURCES } from "@/known-ports/appleskin/sources";
import { createAiNativeDraft } from "@/lib/ai-native-draft";
import { detectModPlatform } from "@/lib/mod-platform";

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

    const names = entries.map(entry => entry.name);
    const metadataPath = ["fabric.mod.json", "quilt.mod.json", "META-INF/neoforge.mods.toml", "META-INF/mods.toml"]
      .find(path => zip.file(path));
    const manifestFile = zip.file("META-INF/MANIFEST.MF");
    const manifestText = manifestFile ? await manifestFile.async("string").catch(() => "") : "";
    const platform = detectModPlatform({ names, manifest: manifestText });
    let metadataText = metadataPath ? await zip.file(metadataPath)!.async("string") : "";
    if (metadataText.length > 1024 * 1024) return NextResponse.json({ error: "Mod metadata is too large." }, { status: 400 });
    if (!metadataText) metadataText = manifestText.slice(0, 12000);
    const metadata: Record<string, unknown> = {};
    if (metadataPath?.endsWith(".json")) {
      try {
        const parsed: unknown = JSON.parse(metadataText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Metadata root must be an object.");
        Object.assign(metadata, parsed);
      } catch {
        return NextResponse.json({ error: "Mod metadata is invalid JSON." }, { status: 400 });
      }
    }

    // Exact known-port mapping: reviewed native implementation, not generated Java translation.
    if (metadata.id === "appleskin") {
      const version = typeof metadata.version === "string" ? metadata.version : "";
      const hasAppleSkinClasses = names.some(name => name.startsWith("squeek/appleskin/") && name.endsWith(".class"));
      const mixinConfigs = names.filter(name => name.toLowerCase().endsWith(".mixins.json") || name.toLowerCase().endsWith(".mixin.json"));
      const hasMixinConfig = mixinConfigs.some(name => name.toLowerCase().includes("appleskin"));
      if (version !== "3.0.10+mc26.3" || !hasAppleSkinClasses || !hasMixinConfig) {
        return NextResponse.json({
          error: "AppleSkin was detected, but this file is not the exact supported Fabric build (3.0.10+mc26.3).",
          supported_build: "AppleSkin Fabric 3.0.10+mc26.3",
          conversion: "No output was generated."
        }, { status: 422 });
      }
      const { ["horizon-mixin.toml"]: mixinManifest, ...sources } = APPLESKIN_SOURCES;
      const bundle = await packageNativeBundle({
        id: "appleskin",
        version: "0.1.3",
        horizonRevision: "02c8607ee8ebd216f2f535c1eb7b62b572830df2",
        mixinsRevision: "cb1ad23022392d88f006cf94cbf6552a73f5df12",
        mixinManifest,
        sources,
        knownPort: "appleskin"
      });
      return new Response(new Uint8Array(bundle.bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${bundle.fileName}"`,
          "Content-Length": String(bundle.bytes.byteLength),
          "X-Conversion-Status": "known-native-port",
          "X-Conversion-SHA256": bundle.sha256,
          "Cache-Control": "no-store"
        }
      });
    }

    // Best-effort Gemini path for other loaders and mods. Output is always marked
    // as an unverified draft until native compilation and Starling testing exist.
    const draft = await createAiNativeDraft({
      zip,
      names,
      metadataText: metadataText || JSON.stringify({ file: item.name, note: "No loader metadata found." }),
      platform,
      fallbackId: item.name
    });
    return new Response(new Uint8Array(draft.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${draft.fileName}"`,
        "Content-Length": String(draft.bytes.byteLength),
        "X-Conversion-Status": "unverified-ai-draft",
        "X-Conversion-SHA256": draft.sha256,
        "X-Conversion-Summary": encodeURIComponent(draft.summary.slice(0, 300)),
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
