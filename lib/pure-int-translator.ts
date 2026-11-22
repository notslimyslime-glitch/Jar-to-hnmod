import type { ClassSummary, BytecodeInstruction } from "./classfile";

export type PureIntTranslation = {
  class_name: string;
  java_method: string;
  java_descriptor: string;
  rust_name: string;
  rust_source: string;
  instruction_count: number;
  status: "translated";
};

const STATIC = 0x0008;

function rustIdentifier(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_]/g, "_").replace(/^[^A-Za-z_]/, "_$&");
  return cleaned || "unnamed";
}

/**
 * Translates a deliberately tiny, semantics-preserving JVM subset:
 * static methods taking 0-4 int arguments and returning int, with only
 * integer loads/constants, wrapping add/subtract/multiply/negate and ireturn.
 * Branches, calls, fields, exceptions and all unknown instructions fail closed.
 */
export function translatePureIntMethod(cls: ClassSummary, method: ClassSummary["methods"][number]): PureIntTranslation | null {
  if ((method.access & STATIC) === 0 || method.name.startsWith("<")) return null;
  const descriptor = /^\((I{0,4})\)I$/.exec(method.descriptor);
  if (!descriptor || method.instructions.length === 0 || method.instructions.length > 256) return null;
  const argumentCount = descriptor[1].length;
  const stack: string[] = [];
  const instructions = method.instructions;
  let returned = false;

  for (let index = 0; index < instructions.length; index++) {
    const instruction = instructions[index];
    const load = /^iload_([0-3])$/.exec(instruction.mnemonic);
    const constant = /^iconst_(-1|[0-5])$/.exec(instruction.mnemonic);
    if (load) {
      const argumentIndex = Number(load[1]);
      if (argumentIndex >= argumentCount || returned) return null;
      stack.push(`arg${argumentIndex}`);
      continue;
    }
    if (constant) {
      if (returned) return null;
      stack.push(constant[1]);
      continue;
    }
    if (["iadd", "isub", "imul"].includes(instruction.mnemonic)) {
      if (returned || stack.length < 2) return null;
      const right = stack.pop()!;
      const left = stack.pop()!;
      const operation = instruction.mnemonic === "iadd" ? "wrapping_add" : instruction.mnemonic === "isub" ? "wrapping_sub" : "wrapping_mul";
      stack.push(`((${left}).${operation}(${right}))`);
      continue;
    }
    if (instruction.mnemonic === "ineg") {
      if (returned || stack.length < 1) return null;
      stack.push(`(${stack.pop()!}).wrapping_neg()`);
      continue;
    }
    if (instruction.mnemonic === "ireturn") {
      if (returned || index !== instructions.length - 1 || stack.length !== 1) return null;
      returned = true;
      continue;
    }
    return null;
  }

  if (!returned || stack.length !== 1) return null;
  const classPart = rustIdentifier(cls.name.replaceAll(".", "_"));
  const methodPart = rustIdentifier(method.name);
  const rustName = `java_${classPart}_${methodPart}_${argumentCount}`;
  const args = Array.from({ length: argumentCount }, (_, i) => `arg${i}: i32`).join(", ");
  const rustSource = `// Translated from ${cls.name}::${method.name}${method.descriptor}.\n// Generated only from the verified straight-line integer bytecode subset.\npub fn ${rustName}(${args}) -> i32 {\n    ${stack[0]}\n}\n`;

  return {
    class_name: cls.name,
    java_method: method.name,
    java_descriptor: method.descriptor,
    rust_name: rustName,
    rust_source: rustSource,
    instruction_count: instructions.length,
    status: "translated"
  };
}

export function translatePureIntMethods(classes: ClassSummary[]): PureIntTranslation[] {
  return classes.flatMap(cls => cls.methods
    .map(method => translatePureIntMethod(cls, method))
    .filter((item): item is PureIntTranslation => item !== null))
    .slice(0, 100);
}
