# Conversion engine roadmap

## What the analyzer does today

The upload path treats JAR files as untrusted ZIP archives and never executes their code. It checks archive limits and paths, reads Fabric metadata, and now performs a bounded JVM class-file inspection. The class reader extracts class names, inheritance, method names/descriptors, referenced types and string constants.

This is **static evidence gathering**, not decompilation and not Java-to-Rust translation. A list of methods or strings cannot safely recreate a mod's behavior.

## Why conversion is staged

A Horizon `.hnmod` is a native source-mixin bundle. It contains Rust source and a `horizon-mixin.toml` that injects modules/hooks into a specific Horizon revision. Copying Java bytecode, assets, or metadata into that archive does not create a working native mod.

A general Java-to-Rust translator cannot be honestly promised as a one-shot feature. Minecraft mods can depend on different loader APIs, mappings, mixins, runtime events, networking, rendering, and third-party libraries. Each behavior needs an equivalent supported Horizon API and a tested hook.

## Planned pipeline

1. **Inspect:** safely parse archive metadata, class structures, dependencies, mixins and resources.
2. **Classify:** identify loader/API families and separate resources from executable behavior.
3. **Translate supported patterns:** add small, versioned translators with fixtures. Unknown patterns remain unsupported.
4. **Map hooks:** select real Horizon targets and typed bindings from the pinned source revision.
5. **Generate:** write Rust modules and the native mixin manifest.
6. **Validate:** run formatting, mixin planning, compilation and tests in an isolated build worker.
7. **Package:** emit a reproducible `.hnmod` only after validation. Any incomplete draft must be labelled as a scaffold, never a converted mod.

## Current limitation

The project now has an experimental metadata-only `.hnmod` path. It is not yet a gameplay converter. The next milestone is to validate that tiny output against the exact pinned Horizon Mixins toolchain, then build a translator for one small, clearly bounded gameplay behavior. AppleSkin's working HNMOD can serve as a comparison fixture, but it is not a generic conversion rule.


## Pinned Horizon hook catalog

The analyzer also exposes the 13 named native hooks from Horizon revision
`ba6344a59cb9e755b730dcf02285fc0d33b97d3c`. The catalog is copied into
`lib/horizon-hooks.ts` and the same revision is shown in each scan report.
These hooks are verified native extension points, not inferred mappings from
Java mixin names. A future translator must prove that a Java behavior matches a
hook's signature, timing, and data contract before generating an injection.


## API-surface inspection

The class reader now also extracts field and method references stored in JVM
constant pools. The analyzer groups these by Minecraft, Fabric API, Mixin, Java
standard library, Kotlin, and other library namespaces. These are static
references only: they are not a control-flow trace and do not prove that a
referenced member is called at runtime. This helps prioritize translator work
without pretending to understand arbitrary Java behavior.


## Method-level behavior evidence

The analyzer groups Mixin annotations and observed Minecraft/Fabric call and
field instructions by their containing Java method. This gives translator work
a concrete evidence bundle instead of unrelated lists. Each group is explicitly
labelled `evidence_only`: it does not establish control flow, runtime execution,
semantic equivalence, or a Horizon hook match. No Rust is generated from these
groups until a versioned translator has a verified fixture and validation.


## Typed native hook contracts

The hook catalog separates each named hook's `native-hooks.json` contract
version from the overall Horizon native-hooks API version in which the hook
was introduced. For example, `world_lifecycle` has hook contract v1 and was
introduced in Horizon API v3; `panel_event` has hook contract v1 and was
introduced in Horizon API v2. A future translation rule must match the hook
contract version, signature, event timing and parameter meaning. A Java method
name or Mixin target name alone is never sufficient evidence for selecting a
native hook.


## Translator coverage registry

`lib/translation-rules.ts` is the single source of truth for detected Java patterns and their current translation status:

- `supported`: reserved for a pattern with an implemented Rust generator and passing behavior-equivalence fixtures.
- `needs_manual_review`: recognizable Java/Mixin evidence exists, but semantic equivalence and Horizon hook compatibility are not established.
- `unsupported`: the platform integration has no translator.

The current registry intentionally contains no `supported` rules. The analyzer reports matched evidence and explains why each pattern is blocked. This is deliberate: a detected annotation is not a converted behavior, and generating placeholder Rust would create a misleading HNMOD.

The next implementation milestone is a tiny end-to-end fixture: a known Java pattern, a reviewed mapping to one pinned Horizon hook, generated Rust, and a compile/test check. Only after that fixture passes should its registry entry become `supported`.

## Native HNMOD packaging boundary

The engine now has a deterministic source-bundle packager in `lib/hnmod-packager.ts`. It follows the public Horizon native-mod template's archive layout:

- `horizon-native.json` at the archive root, with schema, mod id/version, game version, and pinned Horizon/Horizon Mixins revisions. Its JSON keys are sorted to match the official template packager.
- One `mixins/<mod-id>/horizon-mixin.toml` manifest.
- Only explicitly supplied `.rs` and `.toml` source files under that bundle directory.

Before writing an archive, the packager checks the lowercase mod id, version, exact pinned revisions, manifest identity/revision, safe source filenames, non-empty source contents, size limits, and that every `source`/`helper` named by the manifest exists. It caps total source content at 5 MB, then re-opens the finished ZIP with CRC checking and verifies every expected path and file byte before returning it. It uses fixed ZIP timestamps and sorted entries for repeatable output.

**Important:** packaging is not translation. The packager refuses an empty source bundle and does not invent Rust code. It is the final packaging stage that a future verified translator can call. The current Java/Mixin rules remain unverified, so this addition does not make arbitrary JARs convertible yet.

## First bounded translator: Fabric metadata bridge

`lib/fabric-metadata-translator.ts` implements a deliberately narrow first conversion: a Fabric JAR with no `.class` files, no declared Mixin configs, no entrypoints, and no files under `assets/` or `data/` can become a native Mods-list registration. It carries only the Fabric id, version, display name and description into a small Rust helper injected through Horizon's versioned `mods` hook (`hook_version = 1`), resolved from the pinned workspace's `native-hooks.json`.

The `/api/convert` endpoint re-reads the uploaded archive with CRC checking, enforces the existing archive size/path limits, rejects Java/Mixin behavior and resource-bearing JARs, and packages the generated source through the validated HNMOD packager. The scan counts both `assets/` and `data/` resources so the UI hides this path when it would silently drop files.

This is **not a gameplay port**. It does not carry over assets, data files, dependencies, settings or Java behavior. The output is marked experimental and must not be called a supported conversion until the generated helper and injection pass the pinned Horizon Mixins plan/apply and Rust compile tests. The manifest uses the named hook contract rather than a raw function path, so an incompatible hook version is rejected during planning.

## Named-hook packaging preflight

Before writing a bundle, the packager checks each named injection against the pinned `HORIZON_HOOKS` catalog. Unknown hook names, missing versions, mismatched contract versions, and mixing a named hook with a raw target are rejected early. This is a local catalog consistency check only; it does not replace Horizon Mixins `plan`, `apply`, or Rust compilation.
The same preflight also rejects raw `target` paths that are not listed in that pinned catalog. This prevents a manifest from quietly pointing at a renamed or unrelated Horizon method. It remains a catalog guard, not a semantic compatibility proof.



## Pinned native bridge compile fixture

The repository now includes `fixtures/native-bridge`, a tiny Rust workspace that mirrors the exact type shape used by the metadata bridge: a `Game::native_mods` hook and Horizon's `NativeMod` record. Its named-hook catalog and compatibility stamp are pinned to the same Horizon and Horizon Mixins revisions as the packager.

CI checks the fixture twice with the pinned Horizon Mixins 0.6.0 CLI: first it builds a plan from the named hook, then it stages and compiles the injected helper with `check --trust-native-mods`. This proves the adapter's Rust signature, binding, manifest and packaging assumptions against the pinned mixin engine in a controlled fixture. It does **not** prove conversion of arbitrary Fabric code or gameplay behavior, and it does not replace a full build against Horizon's complete game workspace.


## First Java bytecode -> Rust translator

`lib/pure-int-translator.ts` implements the first actual Java-to-Rust translation rule. It accepts only static methods with 0-4 integer parameters and an integer return value, using a straight-line bytecode subset: `iload_0..3`, `iconst_m1` / `iconst_0..5`, `iadd`, `isub`, `imul`, `ineg`, and a final `ireturn`. Arithmetic is emitted with Rust wrapping operations to preserve JVM 32-bit overflow behavior.

It rejects instance methods, branches, calls, field access, unsupported opcodes, oversized instruction sequences, invalid stack use, and methods whose return is not the final instruction. It does not attempt control-flow reconstruction or infer gameplay semantics. The analyzer displays generated Rust for methods in this exact subset.

CI runs a TypeScript-level translator test with positive and negative cases, plus Rust tests for the emitted arithmetic's overflow behavior. This is a genuine but intentionally tiny bytecode translator. Its output is currently a standalone Rust helper preview, not yet wired to a Minecraft event or packaged as a gameplay mod.
