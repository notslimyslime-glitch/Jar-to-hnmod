import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type ScanReport = {
  file?: string;
  size_bytes?: number;
  detected?: {
    platform?: string;
    mod_id?: string | null;
    version?: string | null;
    minecraft?: string | null;
    dependencies?: string[];
    entrypoints?: Record<string, string[]>;
    mixin_configs?: string[];
    mixin_classes?: number;
    class_files?: number;
    assets?: number;
  };
  flags?: { level?: string; code?: string; message?: string }[];
  conversion?: { status?: string; hnmod_generated?: boolean; reason?: string; next_step?: string };
};

function shortText(value: unknown, max = 500): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export async function POST(request: Request) {
  if (!process.env.AI_GATEWAY_API_KEY || !process.env.AI_GATEWAY_MODEL) {
    return NextResponse.json(
      { error: "AI is not configured yet. Add AI_GATEWAY_API_KEY and AI_GATEWAY_MODEL in your Vercel project environment variables." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json() as { report?: ScanReport };
    const input = body?.report;
    if (!input || typeof input !== "object" || !input.detected) {
      return NextResponse.json({ error: "A valid scan report is required." }, { status: 400 });
    }

    const detected = input.detected;
    const safeReport = {
      file: shortText(input.file, 120),
      size_bytes: Number.isFinite(input.size_bytes) ? input.size_bytes : 0,
      detected: {
        platform: shortText(detected.platform, 40),
        mod_id: shortText(detected.mod_id, 100),
        version: shortText(detected.version, 100),
        minecraft: shortText(detected.minecraft, 100),
        dependencies: Array.isArray(detected.dependencies) ? detected.dependencies.slice(0, 80).map(x => shortText(x, 100)) : [],
        entrypoints: detected.entrypoints && typeof detected.entrypoints === "object" ? Object.fromEntries(Object.entries(detected.entrypoints).slice(0, 30).map(([key, value]) => [shortText(key, 80), Array.isArray(value) ? value.slice(0, 30).map(x => shortText(x, 160)) : []])) : {},
        mixin_configs: Array.isArray(detected.mixin_configs) ? detected.mixin_configs.slice(0, 50).map(x => shortText(x, 180)) : [],
        mixin_classes: Number.isFinite(detected.mixin_classes) ? detected.mixin_classes : 0,
        class_files: Number.isFinite(detected.class_files) ? detected.class_files : 0,
        assets: Number.isFinite(detected.assets) ? detected.assets : 0
      },
      flags: Array.isArray(input.flags) ? input.flags.slice(0, 40).map(flag => ({
        level: shortText(flag.level, 20), code: shortText(flag.code, 80), message: shortText(flag.message, 300)
      })) : []
    };

    const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.AI_GATEWAY_MODEL,
        temperature: 0.2,
        max_tokens: 1600,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You are the migration-planning assistant for a Minecraft Java-to-Horizon native mod project.",
              "You receive archive metadata only, not Java source code or bytecode. Never claim to have inspected implementation logic.",
              "Do not generate Rust source, fake hook names, or claim a conversion is complete.",
              "Separate facts directly visible in the report from hypotheses that need source inspection.",
              "If the report has mixins or Java entrypoints, explain that each behavior needs inspection and mapping to a real Horizon hook.",
              "Return only valid JSON with keys: title (string), summary (string), confidence (low|medium), supportedAreas (string array), needsInspection (string array), blockers (string array), implementationPlan (string array), nextAction (string).",
              "Keep the plan concise, practical, and honest. Never use high confidence because source code was not supplied."
            ].join(" ")
          },
          {
            role: "user",
            content: "Create a cautious native-port planning report from this scan metadata:\n" + JSON.stringify(safeReport)
          }
        ]
      }),
      signal: AbortSignal.timeout(25000)
    });

    if (!response.ok) {
      return NextResponse.json({ error: "The AI service could not complete the request. Check your AI Gateway key, model name, and usage limits." }, { status: 502 });
    }

    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return NextResponse.json({ error: "The AI service returned an unexpected response." }, { status: 502 });
    }

    const plan = JSON.parse(content);
    const allowedConfidence = plan.confidence === "medium" ? "medium" : "low";
    return NextResponse.json({
      plan: {
        title: shortText(plan.title, 120) || "Native migration plan",
        summary: shortText(plan.summary, 700),
        confidence: allowedConfidence,
        supportedAreas: Array.isArray(plan.supportedAreas) ? plan.supportedAreas.slice(0, 8).map((x: unknown) => shortText(x, 220)) : [],
        needsInspection: Array.isArray(plan.needsInspection) ? plan.needsInspection.slice(0, 10).map((x: unknown) => shortText(x, 220)) : [],
        blockers: Array.isArray(plan.blockers) ? plan.blockers.slice(0, 10).map((x: unknown) => shortText(x, 220)) : [],
        implementationPlan: Array.isArray(plan.implementationPlan) ? plan.implementationPlan.slice(0, 10).map((x: unknown) => shortText(x, 220)) : [],
        nextAction: shortText(plan.nextAction, 300)
      }
    });
  } catch {
    return NextResponse.json({ error: "Could not create an AI plan. Please try again." }, { status: 500 });
  }
}
