"use client";

import { useCallback, useRef, useState } from "react";

type Report = {
  file: string; size_bytes: number; sha256: string;
  detected: {
    platform: string; mod_id: string | null; version: string | null; minecraft: string | null;
    dependencies: string[]; entrypoints: Record<string, string[]>; mixin_configs: string[];
    mixin_classes: number; mixin_config_details: { file: string; package: string | null; required: boolean | null; compatibility_level: string | null; refmap: string | null; plugin: string | null; common: string[]; client: string[]; server: string[]; error?: string }[]; class_files: number; assets: number;
    bytecode_inspection: { inspected_classes: number; skipped_or_unreadable: number; methods_seen: number; referenced_types: string[]; member_references_seen: number; bytecode_instructions_seen: number; invocation_sites_seen: number; field_access_sites_seen: number; common_instructions: { mnemonic: string; count: number }[]; invocation_samples: { class_name: string; method_name: string; method_descriptor: string; offset: number; opcode: number; mnemonic: string; member?: { owner: string; name: string; descriptor: string; kind: string } }[]; field_access_samples: { class_name: string; method_name: string; method_descriptor: string; offset: number; opcode: number; mnemonic: string; member?: { owner: string; name: string; descriptor: string; kind: string } }[]; api_surface: { name: string; references: number; examples: string[] }[]; mixin_annotations: { class_name: string; method_name: string | null; method_descriptor: string | null; annotation: string; values: Record<string, unknown> }[]; behavior_evidence: { class_name: string; method_name: string; method_descriptor: string; evidence_status: string; mixin_annotations: { type: string; values: Record<string, unknown> }[]; calls: { owner: string; name: string; descriptor: string; instruction: string; offset: number }[]; fields: { owner: string; name: string; descriptor: string; instruction: string; offset: number }[] }[]; class_samples: { name: string; super_name: string | null; java_version: number; methods: { name: string; descriptor: string }[]; strings: string[] }[] };
  };
  horizon: { revision: string; hooks: { name: string; version: number; target: string }[] };
  flags: { level: string; code: string; message: string }[];
  conversion: { status: string; hnmod_generated: boolean; reason: string; next_step: string };
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const choose = useCallback((f?: File) => {
    if (!f) return;
    setError(""); setReport(null);
    if (!f.name.toLowerCase().endsWith(".jar")) { setFile(null); setError("Please choose a .jar file."); return; }
    if (f.size > 25 * 1024 * 1024) { setFile(null); setError("That file is over the 25 MB limit."); return; }
    setFile(f);
  }, []);

  async function analyze() {
    if (!file) return;
    setBusy(true); setError(""); setReport(null);
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch("/api/analyze", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed.");
      setReport(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  function downloadReport() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = (report.detected.mod_id || "mod") + "-conversion-report.json"; a.click();
    URL.revokeObjectURL(url);
  }

  return <main className="shell">
    <nav className="nav"><a className="brand" href="#"><span className="brand-mark">H</span> HORIZON <span className="muted">/ TOOL LAB</span></a><span className="version">EARLY ACCESS · v0.1</span></nav>
    <section className="hero">
      <div className="eyebrow"><span className="pulse" /> JAVA IN, NATIVE OUT</div>
      <h1>Your mods.<br/><span>Beyond Java.</span></h1>
      <p className="intro">Turn Minecraft Java mod ideas into native Horizon mods. Start by scanning a JAR to discover what can be translated.</p>
      <div className="workspace">
        <div className="workspace-head"><div><span className="step">01</span><span className="workspace-title">MOD ANALYZER</span></div><span className="secure">◈ FILES STAY UNEXECUTED</span></div>
        <div className={"dropzone " + (file ? "has-file" : "")}
          onDragOver={e => e.preventDefault()} onDrop={e => {e.preventDefault(); choose(e.dataTransfer.files?.[0]);}}>
          <input ref={input} type="file" accept=".jar,application/java-archive" hidden onChange={e => choose(e.target.files?.[0])}/>
          <div className="upload-icon">↑</div>
          <h2>{file ? file.name : "Drop your .jar in here"}</h2>
          <p>{file ? (file.size / 1024).toFixed(1) + " KB · Ready to inspect" : "or browse files from your device"}</p>
          <button className="browse" onClick={() => input.current?.click()}>CHOOSE JAR <span>↗</span></button>
          <div className="limits">JAR FILES ONLY <i>·</i> MAX 25 MB <i>·</i> NO CODE EXECUTION</div>
        </div>
        {error && <div className="error">{error}</div>}
        <button className="analyze" disabled={!file || busy} onClick={analyze}>{busy ? "SCANNING ARCHIVE…" : "ANALYZE MOD"} <span>→</span></button>
        <p className="fineprint">Analysis checks metadata, dependencies, mixin declarations and archive contents. It does not run the uploaded mod.</p>
      </div>
    </section>
    {report && <section className="results">
      <div className="result-head"><div><div className="eyebrow">SCAN COMPLETE</div><h2>{report.detected.mod_id || report.file}</h2><p>{report.detected.platform} {report.detected.version ? "· " + report.detected.version : ""}</p></div><button className="download" onClick={downloadReport}>DOWNLOAD REPORT ↓</button></div>
      <div className="stats">
        <div><strong>{report.detected.class_files}</strong><span>CLASS FILES</span></div>
        <div><strong>{report.detected.mixin_configs.length}</strong><span>MIXIN CONFIGS</span></div>
        <div><strong>{report.detected.mixin_classes}</strong><span>MIXIN CLASSES</span></div>
        <div><strong>{report.detected.assets}</strong><span>ASSETS</span></div>
        <div><strong>{report.detected.bytecode_inspection?.inspected_classes ?? 0}</strong><span>BYTECODE CLASSES READ</span></div>
        <div><strong>{report.detected.bytecode_inspection?.methods_seen ?? 0}</strong><span>METHODS FOUND</span></div>
      </div>
      <div className="report-grid"><div className="report-card"><h3>DETECTED DEPENDENCIES</h3>{report.detected.dependencies.length ? report.detected.dependencies.map(x => <span className="tag" key={x}>{x}</span>) : <p>None detected</p>}</div>
      <div className="report-card"><h3>ENTRYPOINTS</h3>{Object.entries(report.detected.entrypoints).map(([k,v]) => <p key={k}><b>{k}</b> · {v.join(", ")}</p>)}{!Object.keys(report.detected.entrypoints).length && <p>None detected</p>}</div></div>
      <div className="report-card"><h3>MIXIN CONFIG DISCOVERY</h3>
        <p>Declared targets are grouped by common, client and server config sections. This reads config metadata only; injection annotations and actual method behavior still need deeper inspection.</p>
        {report.detected.mixin_config_details?.length ? report.detected.mixin_config_details.map(config => <div key={config.file}>
          <p><b>{config.file}</b>{config.package ? " · " + config.package : ""}</p>
          {config.error ? <p>{config.error}</p> : <>
            <p>Required: {config.required === null ? "unspecified" : String(config.required)} · Compatibility: {config.compatibility_level || "unspecified"} · Refmap: {config.refmap || "none"}</p>
            {config.plugin && <p>Plugin: {config.plugin}</p>}
            <p>Common: {config.common.join(", ") || "none"}<br/>Client: {config.client.join(", ") || "none"}<br/>Server: {config.server.join(", ") || "none"}</p>
          </>}
        </div>) : <p>No Mixin config details found.</p>}
      </div>
      <div className="report-card"><h3>BYTECODE DISCOVERY</h3>
        <p>Referenced Java types: {report.detected.bytecode_inspection?.referenced_types.slice(0, 12).join(", ") || "None extracted"}</p>
        <p>Skipped or unreadable classes: {report.detected.bytecode_inspection?.skipped_or_unreadable ?? 0}</p>
        {report.detected.bytecode_inspection?.class_samples.slice(0, 8).map(c => <p key={c.name}><b>{c.name}</b> · {c.methods.length} methods · {c.super_name || "no parent"}</p>)}
      </div>
      <div className="report-card"><h3>BYTECODE OPERATIONS</h3>
        <p>{report.detected.bytecode_inspection?.bytecode_instructions_seen ?? 0} JVM instructions decoded from method bodies. Found {report.detected.bytecode_inspection?.invocation_sites_seen ?? 0} invocation sites and {report.detected.bytecode_inspection?.field_access_sites_seen ?? 0} field access sites.</p>
        <p><b>Common operations</b></p>
        {report.detected.bytecode_inspection?.common_instructions?.map(item => <span className="tag" key={item.mnemonic}>{item.mnemonic} · {item.count}</span>)}
        <p><b>Observed method calls</b></p>
        {report.detected.bytecode_inspection?.invocation_samples?.slice(0, 30).map((item, index) => <p key={item.class_name + item.method_name + item.offset + index}><b>{item.mnemonic}</b> · {item.class_name} :: {item.method_name} → {item.member?.owner}.{item.member?.name}{item.member?.descriptor}</p>)}
        <p>Only instruction sites found in decoded class files are shown. Dynamic dispatch, reflection, runtime transformations and control-flow meaning need further analysis.</p>
      </div>
      <div className="report-card"><h3>MIXIN ANNOTATION INSPECTION</h3>
        <p>Annotations found in class and method metadata. These reveal declared targets and injection points, but do not prove that a native equivalent exists.</p>
        {report.detected.bytecode_inspection?.mixin_annotations?.length ? report.detected.bytecode_inspection.mixin_annotations.map((item, index) => <div key={item.class_name + item.annotation + index}>
          <p><b>{item.annotation.split("/").pop()?.replace(";", "")}</b> · {item.class_name}{item.method_name ? " :: " + item.method_name + item.method_descriptor : " · class annotation"}</p>
          <p>{JSON.stringify(item.values)}</p>
        </div>) : <p>No SpongePowered Mixin annotations were found in the inspected classes.</p>}
      </div>
      <div className="report-card"><h3>BEHAVIOR EVIDENCE GROUPS</h3>
        <p>Related Mixin annotations, Minecraft/Fabric method calls and field accesses are grouped by Java method. These are clues for a future translator, not proof of behavior or a native hook match.</p>
        {report.detected.bytecode_inspection?.behavior_evidence?.length ? report.detected.bytecode_inspection.behavior_evidence.slice(0, 80).map((item, index) => <div key={item.class_name + item.method_name + index}>
          <p><b>{item.class_name} :: {item.method_name}</b> · {item.method_descriptor}</p>
          {item.mixin_annotations.map((annotation, i) => <p key={i}>Mixin {annotation.type}: {JSON.stringify(annotation.values)}</p>)}
          {item.calls.slice(0, 8).map((call, i) => <p key={"c" + i}>Call · {call.owner}.{call.name}{call.descriptor}</p>)}
          {item.fields.slice(0, 6).map((field, i) => <p key={"f" + i}>Field · {field.owner}.{field.name} {field.descriptor}</p>)}
        </div>) : <p>No grouped Mixin/Minecraft/Fabric method evidence found.</p>}
      </div>
      <div className="report-card"><h3>JAVA API SURFACE</h3>
        <p>{report.detected.bytecode_inspection?.member_references_seen ?? 0} referenced fields and methods found in class constant pools. These are static references, not proof that every member is executed.</p>
        {report.detected.bytecode_inspection?.api_surface.map(f => <div key={f.name}><p><b>{f.name}</b> · {f.references} references</p><p>{f.examples.join(", ")}</p></div>)}
      </div>
      <div className="report-card"><h3>HORIZON NATIVE HOOK CATALOG</h3>
        <p>These are real extension points from Horizon revision <b>{report.horizon.revision.slice(0, 10)}</b>. They are possible places for a native port to connect, not automatic matches for this Java mod.</p>
        <div className="report-grid">{report.horizon.hooks.map(h => <p key={h.name}><b>{h.name}</b> · v{h.version}</p>)}</div>
      </div>
      <div className="notice"><span>ⓘ</span><div><b>Native translation is still in development</b><p>{report.conversion.reason} {report.conversion.next_step}</p></div></div>
      {report.flags.map(f => <div className="flag" key={f.code}><b>{f.code}</b><span>{f.message}</span></div>)}
    </section>}
    <footer><span>HORIZON TOOL LAB</span><span>BUILT FOR NATIVE MODDING <b>✳</b></span></footer>
  </main>;
}