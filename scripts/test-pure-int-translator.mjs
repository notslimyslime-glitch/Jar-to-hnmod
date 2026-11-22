import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const out = mkdtempSync(join(tmpdir(), "hnmod-translator-"));
try {
  execFileSync("npx", ["tsc", "lib/pure-int-translator.ts", "--target", "ES2021", "--module", "commonjs", "--moduleResolution", "node", "--outDir", out, "--skipLibCheck", "--strict"], { stdio: "inherit" });
  const require = createRequire(import.meta.url);
  const { translatePureIntMethod } = require(join(out, "pure-int-translator.js"));
  const cls = { name: "example.MathMod", methods: [] };
  const method = (name, descriptor, instructions, access = 0x0009) => ({
    name, descriptor, access,
    instructions: instructions.map((item, offset) => typeof item === "string" ? ({ offset, opcode: 0, mnemonic: item }) : ({ offset, opcode: 0, ...item }))
  });

  const add = translatePureIntMethod(cls, method("add", "(II)I", ["iload_0", "iload_1", "iadd", "ireturn"]));
  assert.equal(add?.status, "translated");
  assert.match(add.rust_source, /wrapping_add/);
  assert.match(add.rust_source, /pub fn java_example_MathMod_add_2\(arg0: i32, arg1: i32\) -> i32/);

  const negate = translatePureIntMethod(cls, method("negate", "(I)I", ["iload_0", "ineg", "ireturn"]));
  assert.match(negate.rust_source, /wrapping_neg/);

  const constant = translatePureIntMethod(cls, method("answer", "()I", ["iconst_5", "ireturn"]));
  assert.ok(constant.rust_source.includes("\n    5\n"));

  assert.equal(translatePureIntMethod(cls, method("instance", "(I)I", ["iload_1", "ireturn"], 0x0001)), null);
  assert.equal(translatePureIntMethod(cls, method("branch", "(I)I", ["iload_0", "ifeq", "iconst_0", "ireturn"])), null);
  assert.equal(translatePureIntMethod(cls, method("call", "(I)I", ["iload_0", "invokestatic", "ireturn"])), null);
  const immediates = translatePureIntMethod(cls, method("offset", "(I)I", [
    { mnemonic: "iload", operands: [0] }, { mnemonic: "bipush", operands: [-12] }, "iadd", "ireturn"
  ]));
  assert.equal(immediates?.status, "translated");
  assert.match(immediates.rust_source, /wrapping_add\(-12\)/);
  const shortConstant = translatePureIntMethod(cls, method("wideConstant", "()I", [
    { mnemonic: "sipush", operands: [1200] }, "ireturn"
  ]));
  assert.match(shortConstant.rust_source, /1200/);

  const javaSource = "fixtures/java-bytecode/MathFixture.java";
  const classesDir = join(out, "classes");
  execFileSync("mkdir", ["-p", classesDir]);
  execFileSync("javac", ["-g:none", "-d", classesDir, javaSource], { stdio: "inherit" });
  execFileSync("npx", ["tsc", "lib/classfile.ts", "lib/pure-int-translator.ts", "--target", "ES2021", "--module", "commonjs", "--moduleResolution", "node", "--rootDir", "lib", "--outDir", out, "--skipLibCheck", "--strict"], { stdio: "inherit" });
  const { inspectClass } = require(join(out, "classfile.js"));
  const parsedTranslator = require(join(out, "pure-int-translator.js"));
  const classBytes = readFileSync(join(classesDir, "fixture", "MathFixture.class"));
  const parsedClass = inspectClass(new Uint8Array(classBytes));
  assert.equal(parsedClass.name, "fixture.MathFixture");
  const translatedMethods = parsedTranslator.translatePureIntMethods([parsedClass]);
  assert.ok(translatedMethods.some((item) => item.java_method === "add" && item.rust_source.includes("wrapping_add")));
  assert.ok(translatedMethods.some((item) => item.java_method === "subtractTwelve" && item.rust_source.includes("wrapping_sub(12)")));
  console.log("Synthetic and compiled-Java end-to-end translator tests passed.");

} finally {
  rmSync(out, { recursive: true, force: true });
}
