/**
 * Minimal, non-executing JVM class-file reader.
 * Extracts structural evidence for a future Java -> Horizon/Rust translator.
 */
export type AnnotationSummary = { descriptor: string; values: Record<string, unknown> };
export type BytecodeInstruction = { offset: number; opcode: number; mnemonic: string; operands?: number[]; member?: { owner: string; name: string; descriptor: string; kind: "field" | "method" | "interface_method" } };
export type ClassSummary = {
  name: string; superName: string | null; majorVersion: number;
  annotations: AnnotationSummary[];
  methods: { name: string; descriptor: string; access: number; annotations: AnnotationSummary[]; instructions: BytecodeInstruction[] }[];
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
  take(n: number) { this.need(n); const value = this.bytes.slice(this.offset, this.offset + n); this.offset += n; return value; }
  skip(n: number) { if (!Number.isSafeInteger(n) || n < 0) throw new Error("Invalid class attribute length"); this.need(n); this.offset += n; }
  private need(n: number) { if (this.offset + n > this.bytes.length) throw new Error("Truncated class file"); }
}

type CpEntry = { tag: number; value?: string | number; a?: number; b?: number } | null;
const OPCODE_NAMES = [
  "nop","aconst_null","iconst_m1","iconst_0","iconst_1","iconst_2","iconst_3","iconst_4","iconst_5","lconst_0","lconst_1","fconst_0","fconst_1","fconst_2","dconst_0","dconst_1",
  "bipush","sipush","ldc","ldc_w","ldc2_w","iload","lload","fload","dload","aload","iload_0","iload_1","iload_2","iload_3","lload_0","lload_1","lload_2","lload_3","fload_0","fload_1","fload_2","fload_3","dload_0","dload_1","dload_2","dload_3","aload_0","aload_1","aload_2","aload_3",
  "iaload","laload","faload","daload","aaload","baload","caload","saload","istore","lstore","fstore","dstore","astore","istore_0","istore_1","istore_2","istore_3","lstore_0","lstore_1","lstore_2","lstore_3","fstore_0","fstore_1","fstore_2","fstore_3","dstore_0","dstore_1","dstore_2","dstore_3","astore_0","astore_1","astore_2","astore_3",
  "iastore","lastore","fastore","dastore","aastore","bastore","castore","sastore","pop","pop2","dup","dup_x1","dup_x2","dup2","dup2_x1","dup2_x2","swap","iadd","ladd","fadd","dadd","isub","lsub","fsub","dsub","imul","lmul","fmul","dmul","idiv","ldiv","fdiv","ddiv","irem","lrem","frem","drem","ineg","lneg","fneg","dneg","ishl","lshl","ishr","lshr","iushr","lushr","iand","land","ior","lor","ixor","lxor","iinc","i2l","i2f","i2d","l2i","l2f","l2d","f2i","f2l","f2d","d2i","d2l","d2f","i2b","i2c","i2s","lcmp","fcmpl","fcmpg","dcmpl","dcmpg","ifeq","ifne","iflt","ifge","ifgt","ifle","if_icmpeq","if_icmpne","if_icmplt","if_icmpge","if_icmpgt","if_icmple","if_acmpeq","if_acmpne","goto","jsr","ret","tableswitch","lookupswitch","ireturn","lreturn","freturn","dreturn","areturn","return","getstatic","putstatic","getfield","putfield","invokevirtual","invokespecial","invokestatic","invokeinterface","invokedynamic","new","newarray","anewarray","arraylength","athrow","checkcast","instanceof","monitorenter","monitorexit","wide","multianewarray","ifnull","ifnonnull","goto_w","jsr_w"
];
function decodeInstructions(code: Uint8Array, cp: CpEntry[], utf: (index: number) => string, className: (index: number) => string): BytecodeInstruction[] {
  const out: BytecodeInstruction[] = [];
  const u1 = (p: number) => code[p] ?? 0;
  const u2 = (p: number) => (u1(p) << 8) | u1(p + 1);
  const s4 = (p: number) => (u1(p) * 0x1000000) + (u1(p + 1) << 16) + (u1(p + 2) << 8) + u1(p + 3);
  const memberAt = (index: number): BytecodeInstruction["member"] => {
    const ref = cp[index];
    if (!ref || ![9,10,11].includes(ref.tag) || !ref.a || !ref.b) return undefined;
    const nt = cp[ref.b];
    if (cp[ref.a]?.tag !== 7 || nt?.tag !== 12 || !nt.a || !nt.b) return undefined;
    const owner = className(ref.a), name = utf(nt.a), descriptor = utf(nt.b);
    if (!owner || !name || !descriptor) return undefined;
    return { owner, name, descriptor, kind: ref.tag === 9 ? "field" : ref.tag === 11 ? "interface_method" : "method" };
  };
  let p = 0;
  while (p < code.length && out.length < 20000) {
    const start = p, opcode = u1(p++);
    let operands = 0;
    if ([16,18,21,22,23,24,25,54,55,56,57,58,169,188].includes(opcode)) operands = 1;
    else if ([17,19,20,132,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,178,179,180,181,182,183,184,187,189,192,193,198,199].includes(opcode)) operands = 2;
    else if (opcode === 185 || opcode === 186 || opcode === 200 || opcode === 201 || opcode === 197) operands = opcode === 197 ? 3 : 4;
    if (opcode === 170) {
      while (p % 4 !== 0) p++;
      if (p + 12 > code.length) break;
      const low = s4(p + 4), high = s4(p + 8);
      const count = high - low + 1;
      if (count < 0 || count > 100000 || p + 12 + count * 4 > code.length) break;
      p += 12 + count * 4;
    } else if (opcode === 171) {
      while (p % 4 !== 0) p++;
      if (p + 8 > code.length) break;
      const pairs = s4(p + 4);
      if (pairs < 0 || pairs > 100000 || p + 8 + pairs * 8 > code.length) break;
      p += 8 + pairs * 8;
    } else if (opcode === 196) {
      const nested = u1(p++);
      p += nested === 132 ? 4 : 2;
    } else p += operands;
    if (p > code.length || p <= start) break;
    const item: BytecodeInstruction = { offset: start, opcode, mnemonic: OPCODE_NAMES[opcode] || "reserved_" + opcode };
    if (opcode === 16) item.operands = [((u1(start + 1) << 24) >> 24)];
    else if (opcode === 17) item.operands = [((u2(start + 1) << 16) >> 16)];
    else if (opcode === 21) item.operands = [u1(start + 1)];
    const cpIndex = [18].includes(opcode) ? u1(start + 1) : [19,20,178,179,180,181,182,183,184,185,186].includes(opcode) ? u2(start + 1) : 0;
    if (cpIndex) {
      const member = memberAt(cpIndex);
      if (member) item.member = member;
      else if (opcode === 186) {
        const dynamic = cp[cpIndex];
        const nt = dynamic?.tag === 18 ? cp[dynamic.b || 0] : null;
        if (nt?.tag === 12 && nt.a && nt.b) item.member = { owner: "<dynamic>", name: utf(nt.a), descriptor: utf(nt.b), kind: "method" };
      }
    }
    out.push(item);
  }
  return out;
}

export function inspectClass(bytes: Uint8Array): ClassSummary {
  const r = new Reader(bytes);
  if (r.u4() !== 0xcafebabe) throw new Error("Invalid JVM class magic");
  r.u2();
  const majorVersion = r.u2();
  const count = r.u2();
  const cp: CpEntry[] = new Array(count).fill(null);
  for (let i = 1; i < count; i++) {
    const tag = r.u1();
    if (tag === 1) { const length = r.u2(); cp[i] = { tag, value: new TextDecoder("utf-8", { fatal: false }).decode(r.take(length)) }; }
    else if (tag === 3 || tag === 4) cp[i] = { tag, value: r.u4() };
    else if (tag === 5 || tag === 6) { const hi = r.u4(), lo = r.u4(); cp[i] = { tag, value: hi * 0x100000000 + lo }; i++; }
    else if ([7,8,16,19,20].includes(tag)) cp[i] = { tag, a: r.u2() };
    else if ([9,10,11,12,17,18].includes(tag)) cp[i] = { tag, a: r.u2(), b: r.u2() };
    else if (tag === 15) cp[i] = { tag, a: r.u1(), b: r.u2() };
    else throw new Error("Unsupported constant-pool tag " + tag);
  }
  const utf = (index: number) => { const e = cp[index]; return e?.tag === 1 && typeof e.value === "string" ? e.value : ""; };
  const className = (index: number): string => { const e = cp[index]; return e?.tag === 7 && e.a ? utf(e.a).replaceAll("/", ".") : ""; };
  const constant = (index: number): unknown => { const e = cp[index]; if (!e) return null; if (e.tag === 8) return e.a ? utf(e.a) : null; if ([3,4,5,6].includes(e.tag)) return e.value ?? null; return null; };
  const readAnnotation = (): AnnotationSummary => {
    const descriptor = utf(r.u2()), pairs = r.u2(), values: Record<string, unknown> = {};
    const readValue = (): unknown => {
      const tag = String.fromCharCode(r.u1());
      if ("BCDFIJSZs".includes(tag)) { const index = r.u2(); return tag === "s" ? utf(index) : constant(index); }
      if (tag === "e") return { enumType: utf(r.u2()), enumName: utf(r.u2()) };
      if (tag === "c") return { class: utf(r.u2()) };
      if (tag === "@") return readAnnotation();
      if (tag === "[") { const n = r.u2(), values: unknown[] = []; for (let i=0;i<n;i++) { const v=readValue(); if(i<512) values.push(v); } return values; }
      throw new Error("Unsupported annotation element tag " + tag);
    };
    for (let i=0;i<pairs;i++) { const key=utf(r.u2()); values[key]=readValue(); }
    return { descriptor, values };
  };
  const readAttributes = (onAnnotations?: (a: AnnotationSummary[]) => void, onCode?: (code: Uint8Array) => void) => {
    const n = r.u2();
    for (let i=0;i<n;i++) {
      const name=utf(r.u2()), length=r.u4(), start=r.position;
      if (name === "RuntimeVisibleAnnotations" || name === "RuntimeInvisibleAnnotations") {
        const total=r.u2(), found: AnnotationSummary[]=[]; for(let j=0;j<total;j++) found.push(readAnnotation()); onAnnotations?.(found);
      } else if (name === "Code") {
        r.u2(); r.u2(); const codeLength=r.u4(); onCode?.(r.take(codeLength));
        const exceptions=r.u2(); r.skip(exceptions*8);
        readAttributes();
      }
      const consumed=r.position-start;
      if(consumed>length) throw new Error("Malformed class attribute length");
      r.skip(length-consumed);
    }
  };
  r.u2();
  const thisClass=r.u2(), superClass=r.u2(), interfaces=r.u2(); r.skip(interfaces*2);
  const fieldCount=r.u2();
  for(let i=0;i<fieldCount;i++){r.u2();r.u2();r.u2();readAttributes();}
  const methodCount=r.u2(), methods: ClassSummary["methods"]=[];
  for(let i=0;i<methodCount;i++){
    const access=r.u2(), name=utf(r.u2()), descriptor=utf(r.u2()), annotations: AnnotationSummary[]=[];
    let instructions: BytecodeInstruction[]=[];
    readAttributes(found=>annotations.push(...found),code=>{instructions=decodeInstructions(code,cp,utf,className);});
    methods.push({name,descriptor,access,annotations,instructions:instructions.slice(0,2000)});
  }
  const annotations: AnnotationSummary[]=[]; readAttributes(found=>annotations.push(...found));
  const refs=new Set<string>();
  for(let i=1;i<cp.length;i++) if(cp[i]?.tag===7){const name=className(i);if(name&&!name.startsWith("["))refs.add(name);}
  const members: NonNullable<ClassSummary["referencedMembers"]>=[];
  for(const e of cp){if(!e||![9,10,11].includes(e.tag)||!e.a||!e.b)continue;const nt=cp[e.b];if(cp[e.a]?.tag!==7||nt?.tag!==12||!nt.a||!nt.b)continue;const owner=className(e.a),name=utf(nt.a),descriptor=utf(nt.b);if(owner&&name&&descriptor)members.push({owner,name,descriptor,kind:e.tag===9?"field":e.tag===11?"interface_method":"method"});}
  const strings=new Set<string>();for(const e of cp)if(e?.tag===8&&e.a){const value=utf(e.a);if(value&&value.length<=240)strings.add(value);}
  return {name:className(thisClass)||"unknown",superName:superClass?className(superClass):null,majorVersion,annotations:annotations.slice(0,100),methods:methods.slice(0,100),referencedClasses:[...refs].slice(0,120),referencedMembers:members.slice(0,240),stringConstants:[...strings].slice(0,80)};
}
