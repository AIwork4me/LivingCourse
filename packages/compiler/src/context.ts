import type { CompilerContext } from "./types.js";
import { sha256 } from "@livingcourse/core";

export const DEFAULT_BUILD_FINGERPRINTS = {
  presentationRendererFingerprint: sha256({ adapter: "unspecified-presentation-renderer" }),
  videoRendererFingerprint: sha256({ adapter: "unspecified-video-renderer" }),
  vocabularyFingerprint: sha256({ vocabulary: "unspecified-course-vocabulary" }),
  profileFingerprint: sha256({ profile: "unspecified-production-profile" }),
  compilerFingerprint: sha256({ compiler: "livingcourse-deterministic-compiler" })
} as const;

export const createCompilerContext = (overrides: Partial<CompilerContext> = {}): CompilerContext => ({
  assetProbe: {
    probe: () => ({ exists: true, sha256: null, approved: false })
  },
  timingProbe: {
    durationMs: () => null
  },
  reviewDecisionSource: {
    decisions: () => []
  },
  fps: 30,
  narrationStartOffsetMs: 350,
  narrationTailPaddingMs: 600,
  transitionMs: 450,
  buildFingerprints: DEFAULT_BUILD_FINGERPRINTS,
  ...overrides
});
