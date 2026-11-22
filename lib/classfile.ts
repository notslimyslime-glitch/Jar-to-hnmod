/**
 * Minimal, non-executing JVM class-file reader.
 * Extracts structural evidence for a future Java -> Horizon/Rust translator.
 * It deliberately does not execute or decompile uploaded bytecode.
 */
export type AnnotationSummary = { descriptor: string; values: Record<string, unknown> };
export type ClassSummary = {
  name: string;
  superName: string | null;
  majorVersion: number;
  annotations: AnnotationSummary[];
  methods: { name: string; descriptor: string; access: number; annotations: AnnotationSummary[] }[];
  referencedClasses: string[];
  referencedMembers: { owner: string; name: string; descriptor: string; kind: "field" | "method" | "interface_method" }[];
  stringConstants: string[];
};

class Reader {
  private offset = 0;
  constructor(private readonly bytes: Uint8Array) {}
  get position() { return this.offset; }
  u1() { this.need(1); return this.bytes[this.offset++]; }
  u2() { this.need(2); const n = (this.bytes[this.offset] << 8) | this.bytes[this.offset + 1]; this.offset += 2; return n; }
  u4() { this.need(4); const n = (this.bytes[this.offset] * 0x1000000) + (this.bytes[this.offset + 1] << 16) + (this.bytes[this.offset + 2] << 8) + this.bytes[this.offset + 3]; this.offset += 4; return n >>> 0; }
  skip(n: number) { if (!Number.isSafeInteger(n) || n < 0) throw new Error("Invalid class attribute length"); this.need(n); this.offset += n; }
  private need(n: number) { if (this.offset + n > this.bytes.length) throw new Error("Truncated class file"); }
}

type CpEntry = { tag: number; value?: string | number; a?: number; b?: number } | null;

export function inspectClass(bytes: Uint8Array): ClassSummary {
  const r = new Reader(bytes);
  if (r.u4() !== 0xcafebabe) throw new Error("Invalid JVM class magic");
  r.u2();
  const majorVersion = r.u2();
  const count = r.u2();
  const cp: CpEntry[] = new Array(count).fill(null);
  for (let i = 1; i < count; i++) {
    const tag = r.u1();
    if (tag === 1) {
      const length = r.u2();
      const raw = bytes.slice(r.position, r.position + length);
      r.skip(length);
      cp[i] = { tag, value: new TextDecoder("utf-8", { fatal: false }).decode(raw) };
    } else if (tag === 3 || tag === 4) {
      cp[i] = { tag, value: r.u4() };
    } else if (tag === 5 || tag === 6) {
      const hi = r.u4(), lo = r.u4();
      cp[i] = { tag, value: hi * 0x100000000 + lo };
      i++;
    } else if (tag === 7 || tag === 8 || tag === 16 || tag === 19 || tag === 20) {
      cp[i] = { tag, a: r.u2() };
    } else if (tag === 9 || tag === 10 || tag === 11 || tag === 12 || tag === 17 || tag === 18) {
      cp[i] = { tag, a: r.u2(), b: r.u2() };
    } else if (tag === 15) {
      cp[i] = { tag, a: r.u1(), b: r.u2() };
    } else {
      throw new Error("Unsupported constant-pool tag " + tag);
    }
  }
  const utf = (index: number) => {
    const e = cp[index];
    return e?.tag === 1 && typeof e.value === "string" ? e.value : "";
  };
  const className = (index: number): string => {
    const e = cp[index];
    return e?.tag === 7 && e.a ? utf(e.a).replaceAll("/", ".") : "";
  };
  const constant = (index: number): unknown => {
    const e = cp[index];
    if (!e) return null;
    if (e.tag === 8) return e.a ? utf(e.a) : null;
    if ([3, 4, 5, 6].includes(e.tag)) return e.value ?? null;
    return null;
  };
  const readElementValue = (): unknown => {
    const tag = String.fromCharCode(r.u1());
    if ("BCDFIJSZs".includes(tag)) {
      const index = r.u2();
      return tag === "s" ? utf(index) : constant(index);
    }
    if (tag === "e") return { enumType: utf(r.u2()), enumName: utf(r.u2()) };
    if (tag === "c") return { class: utf(r.u2()) };
    if (tag === "@") return readAnnotation();
    if (tag === "[") {
      const n = r.u2();
      const values: unknown[] = [];
      for (let i = 0; i < n && i < 512; i++) values.push(readElementValue());
      for (let i = 512; i < n; i++) readElementValue();
      return values;
    }
    throw new Error("Unsupported annotation element tag " + tag);
  };
  const readAnnotation = (): AnnotationSummary => {
    const descriptor = utf(r.u2());
    const pairs = r.u2();
    const values: Record<string, unknown> = {};
    for (let i = 0; i < pairs; i++) {
      const key = utf(r.u2());
      const value = readElementValue();
      if (key) values[key] = value;
    }
    return { descriptor, values };
  };
  const readAttributes = (onAnnotations?: (annotations: AnnotationSummary[]) => void) => {
    const n = r.u2();
    for (let i = 0; i < n; i++) {
      const name = utf(r.u2());
      const length = r.u4();
      const start = r.position;
      if (name === "RuntimeVisibleAnnotations" || name === "RuntimeInvisibleAnnotations") {
        const count = r.u2();
        const annotations: AnnotationSummary[] = [];
        for (let j = 0; j < count; j++) annotations.push(readAnnotation());
        onAnnotations?.(annotations);
      }
      const consumed = r.position - start;
      if (consumed > length) throw new Error("Malformed class attribute length");
      r.skip(length - consumed);
    }
  };

  r.u2(); // access flags
  const thisClass = r.u2();
  const superClass = r.u2();
  const interfaces = r.u2();
  r.skip(interfaces * 2);

  const skipFields = () => {
    const n = r.u2();
    for (let i = 0; i < n; i++) {
      r.u2(); r.u2(); r.u2();
      readAttributes();
    }
  };
  skipFields();

  const methodCount = r.u2();
  const methods: ClassSummary["methods"] = [];
  for (let i = 0; i < methodCount; i++) {
    const access = r.u2();
    const name = utf(r.u2());
    const descriptor = utf(r.u2());
    const annotations: AnnotationSummary[] = [];
    readAttributes(found => annotations.push(...found));
    methods.push({ name, descriptor, access, annotations });
  }
  const annotations: AnnotationSummary[] = [];
  readAttributes(found => annotations.push(...found));

  const refs = new Set<string>();
  for (let i = 1; i < cp.length; i++) {
    const e = cp[i];
    if (e?.tag === 7) {
      const name = className(i);
      if (name && !name.startsWith("[")) refs.add(name);
    }
  }
  const members: ClassSummary["referencedMembers"] = [];
  for (const e of cp) {
    if (!e || (e.tag !== 9 && e.tag !== 10 && e.tag !== 11) || !e.a || !e.b) continue;
    const nameType = cp[e.b];
    if (cp[e.a]?.tag !== 7 || nameType?.tag !== 12 || !nameType.a || !nameType.b) continue;
    const owner = className(e.a);
    const name = utf(nameType.a);
    const descriptor = utf(nameType.b);
    if (owner && name && descriptor) members.push({
      owner, name, descriptor,
      kind: e.tag === 9 ? "field" : e.tag === 11 ? "interface_method" : "method"
    });
  }
  const strings = new Set<string>();
  for (const e of cp) if (e?.tag === 8 && e.a) {
    const value = utf(e.a);
    if (value && value.length <= 240) strings.add(value);
  }
  return {
    name: className(thisClass) || "unknown",
    superName: superClass ? className(superClass) : null,
    majorVersion,
    annotations: annotations.slice(0, 100),
    methods: methods.slice(0, 100),
    referencedClasses: [...refs].slice(0, 120),
    referencedMembers: members.slice(0, 240),
    stringConstants: [...strings].slice(0, 80),
  };
}
