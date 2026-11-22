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

The project currently stops after inspection. It does not yet generate an `.hnmod`. The next milestone is a tested translator for one small, clearly bounded mod behavior, not a fake universal converter. AppleSkin's working HNMOD can serve as a comparison fixture, but it is not a generic conversion rule.


## Pinned Horizon hook catalog

The analyzer also exposes the 13 named native hooks from Horizon revision
`ba6344a59cb9e755b730dcf02285fc0d33b97d3c`. The catalog is copied into
`lib/horizon-hooks.ts` and the same revision is shown in each scan report.
These hooks are verified native extension points, not inferred mappings from
Java mixin names. A future translator must prove that a Java behavior matches a
hook's signature, timing, and data contract before generating an injection.
