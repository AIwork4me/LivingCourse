import type { CompilerContext } from "./types.js";

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
  ...overrides
});
