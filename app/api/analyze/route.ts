import JSZip from "jszip";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { inspectClass } from "@/lib/classfile";
import { HORIZON_HOOKS, HORIZON_REVISION } from "@/lib/horizon-hooks";
import { assessTranslationReadiness } from "@/lib/translation-rules";

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

    const bytes = Buffer.from(await item.arrayBuffer());
    const zip = await JSZip.loadAsync(bytes, { checkCRC32: false });
    const entries = Object.values(zip.files).filter(x => !x.dir);
    if (entries.length > MAX_ENTRIES) return NextResponse.json({ error: "Archive contains too many files." }, { status: 400 });
    let expanded = 0;
    for (const entry of entries) {
      const name = entry.name.replaceAll("\\", "/");
      if (name.startsWith("/") || name.split("/").includes("..")) return NextResponse.json({ error: "Archive contains an unsafe path." }, { status: 400 });
      const zipMeta = entry as unknown as { _data?: { uncompressedSize?: number } };
      expanded += zipMeta._data?.uncompressedSize ?? 0;
      if (expanded > MAX_EXPANDED) return NextResponse.json({ error: "Expanded archive is too large." }, { status: 413 });
    }

    const names = entries.map(x => x.name);
    let fabric: Record<string, unknown> | null = null;
    if (zip.file("fabric.mod.json")) {
      const raw = await zip.file("fabric.mod.json")!.async("string");
      if (raw.length > 2 * 1024 * 1024) return NextResponse.json({ error: "Fabric metadata is too large." }, { status: 400 });
      try { fabric = JSON.parse(raw); } catch { return NextResponse.json({ error: "fabric.mod.json is invalid JSON." }, { status: 400 }); }
    }
    const metadata = fabric ?? {};
    const depends = (metadata.depends && typeof metadata.depends === "object") ? metadata.depends as Record<string, unknown> : {};
    const entrypoints = (metadata.entrypoints && typeof metadata.entrypoints === "object") ? metadata.entrypoints as Record<string, string[]> : {};
    const mixinsRaw = Array.isArray(metadata.mixins) ? metadata.mixins : [];
    const declaredMixins = mixinsRaw.map((m: unknown) => typeof m === "string" ? m : (m && typeof m === "object" && "config" in m ? String((m as {config: unknown}).config) : "")).filter(Boolean);
    const mixinConfigs = names.filter(n => n.toLowerCase().endsWith(".mixins.json") || n.toLowerCase().endsWith(".mixin.json"));
    const mixinClasses = names.filter(n => /mixin/i.test(n) && n.endsWith(".class"));
    const classes = names.filter(n => n.endsWith(".class"));
    const mixinConfigReports: { file: string; package: string | null; required: boolean | null; compatibility_level: string | null; refmap: string | null; plugin: string | null; common: string[]; client: string[]; server: string[]; error?: string }[] = [];
    const configNames = [...new Set([...mixinConfigs, ...declaredMixins])];
    for (const configName of configNames.slice(0, 40)) {
      const configFile = zip.file(configName);
      if (!configFile) { mixinConfigReports.push({ file: configName, package: null, required: null, compatibility_level: null, refmap: null, plugin: null, common: [], client: [], server: [], error: "Declared config file was not found in the archive." }); continue; }
      try {
        const raw = await configFile.async("string");
        if (raw.length > 1024 * 1024) throw new Error("Config exceeds 1 MB.");
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Config root must be an object.");
        const obj = parsed as Record<string, unknown>;
        const list = (value: unknown) => Array.isArray(value) ? value.map(item => typeof item === "string" ? item : item && typeof item === "object" && "class" in item ? String((item as {class: unknown}).class) : "").filter(Boolean).slice(0, 300) : [];
        mixinConfigReports.push({
          file: configName,
          package: typeof obj.package === "string" ? obj.package : null,
          required: typeof obj.required === "boolean" ? obj.required : null,
          compatibility_level: typeof obj.compatibilityLevel === "string" ? obj.compatibilityLevel : null,
          refmap: typeof obj.refmap === "string" ? obj.refmap : null,
          plugin: typeof obj.plugin === "string" ? obj.plugin : null,
          common: list(obj.mixins), client: list(obj.client), server: list(obj.server)
        });
      } catch (error) {
        mixinConfigReports.push({ file: configName, package: null, required: null, compatibility_level: null, refmap: null, plugin: null, common: [], client: [], server: [], error: error instanceof Error ? error.message : "Invalid mixin config." });
      }
    }
    const classInsights: ReturnType<typeof inspectClass>[] = [];
    let unreadableClasses = 0;
    for (const entry of entries.filter(x => x.name.endsWith(".class")).slice(0, 200)) {
      try {
        const data = await entry.async("uint8array");
        if (data.byteLength > 1024 * 1024) { unreadableClasses++; continue; }
        classInsights.push(inspectClass(data));
      } catch { unreadableClasses++; }
    }
    const mixinAnnotations = classInsights.flatMap(cls => [
      ...cls.annotations.map(annotation => ({ class_name: cls.name, method_name: null, method_descriptor: null, annotation: annotation.descriptor, values: annotation.values })),
      ...cls.methods.flatMap(method => method.annotations.map(annotation => ({ class_name: cls.name, method_name: method.name, method_descriptor: method.descriptor, annotation: annotation.descriptor, values: annotation.values })))
    ]).filter(item => item.annotation.startsWith("Lorg/spongepowered/asm/mixin/")).slice(0, 500);
    const referencedTypes = [...new Set(classInsights.flatMap(x => x.referencedClasses))].slice(0, 100);
    const methodCount = classInsights.reduce((sum, x) => sum + x.methods.length, 0);
    const bytecodeInstructions = classInsights.flatMap(cls => cls.methods.flatMap(method => method.instructions.map(instruction => ({ class_name: cls.name, method_name: method.name, method_descriptor: method.descriptor, ...instruction }))));
    const invocationSites = bytecodeInstructions.filter(item => [182,183,184,185,186].includes(item.opcode) && item.member);
    const fieldAccessSites = bytecodeInstructions.filter(item => [178,179,180,181].includes(item.opcode) && item.member);
    const instructionCounts = new Map<string, number>();
    for (const item of bytecodeInstructions) instructionCounts.set(item.mnemonic, (instructionCounts.get(item.mnemonic) || 0) + 1);
    const commonInstructions = [...instructionCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([mnemonic,count])=>({mnemonic,count}));
    // Keep related mixin declarations and concrete JVM call sites together.
    // This is evidence grouping only, never an automatic Java -> Rust mapping.
    const behaviorEvidence = classInsights.flatMap(cls => cls.methods.map(method => {
      const calls = method.instructions.filter(item => [182,183,184,185,186].includes(item.opcode) && item.member).slice(0, 16);
      const fields = method.instructions.filter(item => [178,179,180,181].includes(item.opcode) && item.member).slice(0, 12);
      const annotations = method.annotations.filter(item => item.descriptor.startsWith("Lorg/spongepowered/asm/mixin/"));
      const relevantCalls = [...calls, ...fields].some(item => item.member?.owner.startsWith("net.minecraft.") || item.member?.owner.startsWith("net.fabricmc."));
      if (!annotations.length && !relevantCalls) return null;
      return {
        class_name: cls.name, method_name: method.name, method_descriptor: method.descriptor,
        evidence_status: "evidence_only",
        mixin_annotations: annotations.map(item => ({ type: item.descriptor.split("/").pop()?.replace(";", "") || item.descriptor, values: item.values })),
        calls: calls.map(item => ({ owner: item.member!.owner, name: item.member!.name, descriptor: item.member!.descriptor, instruction: item.mnemonic, offset: item.offset })),
        fields: fields.map(item => ({ owner: item.member!.owner, name: item.member!.name, descriptor: item.member!.descriptor, instruction: item.mnemonic, offset: item.offset }))
      };
    })).filter((item): item is NonNullable<typeof item> => item !== null).slice(0, 250);
    const memberReferences = classInsights.flatMap(x => x.referencedMembers);
    const apiFamilies = [
      { name: "Minecraft", match: (owner: string) => owner.startsWith("net.minecraft.") },
      { name: "Fabric API", match: (owner: string) => owner.startsWith("net.fabricmc.") },
      { name: "Mixin", match: (owner: string) => owner.startsWith("org.spongepowered.asm.mixin.") },
      { name: "Java standard library", match: (owner: string) => owner.startsWith("java.") || owner.startsWith("javax.") },
      { name: "Kotlin", match: (owner: string) => owner.startsWith("kotlin.") },
      { name: "Other libraries", match: (owner: string) => !owner.startsWith("net.minecraft.") && !owner.startsWith("net.fabricmc.") && !owner.startsWith("org.spongepowered.asm.mixin.") && !owner.startsWith("java.") && !owner.startsWith("javax.") && !owner.startsWith("kotlin.") }
    ];
    const apiSurface = apiFamilies.map(family => ({
      name: family.name,
      references: memberReferences.filter(member => family.match(member.owner)).length,
      examples: [...new Set(memberReferences.filter(member => family.match(member.owner)).map(member => member.owner + "." + member.name))].slice(0, 12)
    })).filter(family => family.references > 0);
    const translationReadiness = assessTranslationReadiness({ platform, entrypoints, mixinAnnotations });
    const assets = names.filter(n => n.startsWith("assets/"));
    const depNames = Object.keys(depends);
    const platform = depNames.some(x => /forge|neoforge/i.test(x)) ? "Forge/NeoForge" : fabric ? "Fabric" : "Unknown";
    const flags: {level:string;code:string;message:string}[] = [];
    if (!fabric) flags.push({ level:"warning", code:"NO_FABRIC_METADATA", message:"No fabric.mod.json found. This may be a Forge, NeoForge, Quilt, or non-Fabric mod." });
    if (mixinConfigs.length || declaredMixins.length) flags.push({ level:"info", code:"MIXINS_FOUND", message:"Mixin behavior needs hook-by-hook mapping to native Horizon hooks." });
    if (Object.keys(entrypoints).length) flags.push({ level:"warning", code:"JAVA_ENTRYPOINTS", message:"Java entrypoints need native Rust implementations; they cannot be copied into an HNMOD." });
    if (!classes.length) flags.push({ level:"warning", code:"NO_CLASS_FILES", message:"No Java class files found. This may be a data/resource-only mod." });

    return NextResponse.json({
      file: item.name, size_bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
      detected: {
        platform, mod_id: typeof metadata.id === "string" ? metadata.id : null,
        version: typeof metadata.version === "string" ? metadata.version : null,
        minecraft: typeof depends.minecraft === "string" ? depends.minecraft : null,
        dependencies: depNames, entrypoints, mixin_configs: [...new Set([...mixinConfigs, ...declaredMixins])],
        mixin_classes: mixinClasses.length, mixin_config_details: mixinConfigReports, class_files: classes.length, assets: assets.length,
        bytecode_inspection: { inspected_classes: classInsights.length, skipped_or_unreadable: unreadableClasses, methods_seen: methodCount, referenced_types: referencedTypes, api_surface: apiSurface, member_references_seen: memberReferences.length, bytecode_instructions_seen: bytecodeInstructions.length, invocation_sites_seen: invocationSites.length, field_access_sites_seen: fieldAccessSites.length, common_instructions: commonInstructions, invocation_samples: invocationSites.slice(0,120), field_access_samples: fieldAccessSites.slice(0,80), mixin_annotations: mixinAnnotations, behavior_evidence: behaviorEvidence, class_samples: classInsights.slice(0, 20).map(x => ({ name: x.name, super_name: x.superName, java_version: x.majorVersion, methods: x.methods.slice(0, 12).map(m => ({ name: m.name, descriptor: m.descriptor })), strings: x.stringConstants.slice(0, 12) })) }
      },
      horizon: { revision: HORIZON_REVISION, hooks: HORIZON_HOOKS },
      flags,
      translation_readiness: translationReadiness,
      conversion: { status:"analysis_only", hnmod_generated:false, reason:"The scanner now inspects JVM method bytecode instructions, call sites, field accesses, class structure and Mixin metadata. These are static clues, not a Java-to-Rust compiler or proof of runtime behavior.", next_step:"Build verified translators for specific Minecraft APIs and map each behavior to supported Horizon hooks. Unsupported code must remain clearly marked instead of being packaged as a working mod." }
    });
  } catch {
    return NextResponse.json({ error: "Could not read this archive. Make sure it is a valid JAR file." }, { status: 400 });
  }
}