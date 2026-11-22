"use client";

import { useCallback, useRef, useState } from "react";

type Report = {
  file: string; size_bytes: number; sha256: string;
  detected: {
    platform: string; mod_id: string | null; version: string | null; minecraft: string | null;
    dependencies: string[]; entrypoints: Record<string, string[]>; mixin_configs: string[];
    mixin_classes: number; class_files: number; assets: number;
  };
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
      </div>
      <div className="report-grid"><div className="report-card"><h3>DETECTED DEPENDENCIES</h3>{report.detected.dependencies.length ? report.detected.dependencies.map(x => <span className="tag" key={x}>{x}</span>) : <p>None detected</p>}</div>
      <div className="report-card"><h3>ENTRYPOINTS</h3>{Object.entries(report.detected.entrypoints).map(([k,v]) => <p key={k}><b>{k}</b> · {v.join(", ")}</p>)}{!Object.keys(report.detected.entrypoints).length && <p>None detected</p>}</div></div>
      <div className="notice"><span>ⓘ</span><div><b>Conversion is not generated yet</b><p>{report.conversion.reason} {report.conversion.next_step}</p></div></div>
      {report.flags.map(f => <div className="flag" key={f.code}><b>{f.code}</b><span>{f.message}</span></div>)}
    </section>}
    <footer><span>HORIZON TOOL LAB</span><span>BUILT FOR NATIVE MODDING <b>✳</b></span></footer>
  </main>;
}