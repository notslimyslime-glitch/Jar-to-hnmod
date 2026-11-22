import { NextResponse } from "next/server";
import { POST as convertNative } from "../convert/route";
import { POST as convertAssets } from "../convert-content/route";

export const runtime = "nodejs";

/**
 * One-click dispatcher. It tries only real, verified conversion paths:
 * reviewed native ports first, then passive-asset packaging.
 * It never renames a JAR or claims Java gameplay was translated.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const item = form.get("file");
    if (!(item instanceof File)) {
      return NextResponse.json({ error: "Choose a JAR file first." }, { status: 400 });
    }
    if (!item.name.toLowerCase().endsWith(".jar")) {
      return NextResponse.json({ error: "Only .jar files are accepted." }, { status: 400 });
    }

    const nativeForm = new FormData();
    nativeForm.append("file", item, item.name);
    const nativeResponse = await convertNative(new Request("http://internal/api/convert", {
      method: "POST", body: nativeForm
    }));
    if (nativeResponse.ok) {
      const headers = new Headers(nativeResponse.headers);
      const disposition = headers.get("Content-Disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/i)?.[1] || item.name.replace(/\\.jar$/i, ".hnmod");
      headers.set("X-Output-Filename", filename);
      return new Response(nativeResponse.body, { status: nativeResponse.status, headers });
    }

    const assetForm = new FormData();
    assetForm.append("file", item, item.name);
    const assetResponse = await convertAssets(new Request("http://internal/api/convert-content", {
      method: "POST", body: assetForm
    }));
    if (assetResponse.ok) {
      const headers = new Headers(assetResponse.headers);
      headers.set("X-Output-Filename", item.name.replace(/\.jar$/i, ".hmod"));
      return new Response(assetResponse.body, { status: assetResponse.status, headers });
    }

    const nativeError = await nativeResponse.json().catch(() => ({})) as { error?: string };
    const assetError = await assetResponse.json().catch(() => ({})) as { error?: string };
    return NextResponse.json({
      error: "This mod does not have an implemented automatic conversion path yet. No fake .hnmod was created.",
      details: [
        nativeError.error || "No reviewed native port matched this JAR.",
        assetError.error || "Passive asset packaging was not possible."
      ],
      next_step: "A full gameplay port needs Horizon API mapping and native Rust implementation. This service does not pretend that analysis is conversion."
    }, { status: 422 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Automatic conversion failed.",
      conversion: "No output was generated."
    }, { status: 422 });
  }
}
