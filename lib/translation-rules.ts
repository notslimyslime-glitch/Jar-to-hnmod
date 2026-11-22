/**
 * Explicit translator coverage registry.
 *
 * No Java pattern is marked supported until a Rust generator and fixture test
 * prove equivalent behavior against a pinned Horizon API revision.
 */
export type TranslationRuleStatus = "supported" | "needs_manual_review" | "unsupported";

export type TranslationRule = {
  id: string;
  label: string;
  status: TranslationRuleStatus;
  evidence: string;
  reason: string;
};

export const TRANSLATION_RULES: TranslationRule[] = [
  {
    id: "mixin-inject",
    label: "Mixin @Inject",
    status: "needs_manual_review",
    evidence: "Lorg/spongepowered/asm/mixin/injection/Inject;",
    reason: "Injection target, point, cancellation, callback arguments and method semantics must be reviewed together."
  },
  {
    id: "mixin-redirect",
    label: "Mixin @Redirect",
    status: "needs_manual_review",
    evidence: "Lorg/spongepowered/asm/mixin/injection/Redirect;",
    reason: "Redirecting a Java call requires a behavior-preserving native implementation, not a name-only hook match."
  },
  {
    id: "mixin-modify",
    label: "Mixin @Modify*",
    status: "needs_manual_review",
    evidence: "Lorg/spongepowered/asm/mixin/injection/Modify",
    reason: "The modified value and surrounding control flow must be understood before native translation."
  },
  {
    id: "mixin-overwrite",
    label: "Mixin @Overwrite",
    status: "needs_manual_review",
    evidence: "Lorg/spongepowered/asm/mixin/Overwrite;",
    reason: "Replacing a whole Java method needs a complete native equivalent and version-specific behavior checks."
  },
  {
    id: "mixin-accessor",
    label: "Mixin @Accessor / @Invoker",
    status: "needs_manual_review",
    evidence: "Lorg/spongepowered/asm/mixin/gen/",
    reason: "Access transformations have no automatic native equivalent without a verified exposed API."
  },
  {
    id: "fabric-entrypoints",
    label: "Fabric Java entrypoints",
    status: "needs_manual_review",
    evidence: "fabric.mod.json entrypoints",
    reason: "Entrypoint lifecycle and all registered callbacks need explicit Rust implementations."
  },
  {
    id: "forge-platform",
    label: "Forge / NeoForge integration",
    status: "unsupported",
    evidence: "Forge or NeoForge metadata",
    reason: "No Forge/NeoForge-to-Horizon translator is implemented."
  }
];

export type TranslationReadiness = {
  supported_rules: number;
  manual_review_rules: number;
  unsupported_rules: number;
  matched_rules: TranslationRule[];
  status: "no_verified_translation" | "manual_review_required" | "unsupported_platform";
  explanation: string;
};

export function assessTranslationReadiness(input: {
  platform: string;
  entrypoints: Record<string, unknown>;
  mixinAnnotations: { annotation: string }[];
}): TranslationReadiness {
  const descriptors = input.mixinAnnotations.map(item => item.annotation);
  const matched = TRANSLATION_RULES.filter(rule => {
    if (rule.id === "fabric-entrypoints") return Object.keys(input.entrypoints).length > 0;
    if (rule.id === "forge-platform") return /forge|neoforge/i.test(input.platform);
    return descriptors.some(descriptor => descriptor.includes(rule.evidence));
  });
  const supported = matched.filter(rule => rule.status === "supported").length;
  const manual = matched.filter(rule => rule.status === "needs_manual_review").length;
  const unsupported = matched.filter(rule => rule.status === "unsupported").length;
  const status = unsupported ? "unsupported_platform" : manual ? "manual_review_required" : "no_verified_translation";
  return {
    supported_rules: supported,
    manual_review_rules: manual,
    unsupported_rules: unsupported,
    matched_rules: matched,
    status,
    explanation: supported
      ? "At least one verified translator rule matched. Each generated output still requires validation."
      : unsupported
        ? "This platform currently has no translator. The archive can be inspected, but it cannot be converted by this engine."
        : manual
          ? "Potentially relevant Java patterns were found, but none has a verified automatic Rust translation yet."
          : "No implemented translator rule matches this archive. Static analysis alone is not enough to generate a working native mod."
  };
}
