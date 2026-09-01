import type { NormalizedRegion, SlideSpec, SlideType } from "@livingcourse/core";

interface LayoutProfile {
  regions: Readonly<Record<string, NormalizedRegion>>;
  safeAreas: readonly NormalizedRegion[];
}

export const DEFAULT_LAYOUT_PROFILES: Readonly<Record<SlideType, LayoutProfile>> = {
  hero: {
    regions: {
      title: { x: 0.06, y: 0.18, width: 0.42, height: 0.16 },
      subtitle: { x: 0.06, y: 0.39, width: 0.4, height: 0.1 },
      visual: { x: 0, y: 0, width: 1, height: 1 }
    },
    safeAreas: [{ x: 0, y: 0, width: 0.5, height: 1 }]
  },
  step_process: {
    regions: {
      title: { x: 0.06, y: 0.08, width: 0.72, height: 0.14 },
      processBand: { x: 0.06, y: 0.28, width: 0.72, height: 0.58 },
      guide: { x: 0.8, y: 0.34, width: 0.15, height: 0.46 }
    },
    safeAreas: [{ x: 0.05, y: 0.05, width: 0.74, height: 0.88 }]
  },
  safety_focus: {
    regions: {
      title: { x: 0.06, y: 0.07, width: 0.86, height: 0.14 },
      visual: { x: 0.05, y: 0.24, width: 0.58, height: 0.68 },
      warning: { x: 0.67, y: 0.29, width: 0.28, height: 0.25 },
      actions: { x: 0.67, y: 0.6, width: 0.28, height: 0.25 },
      disclosure: { x: 0.67, y: 0.88, width: 0.28, height: 0.07 }
    },
    safeAreas: [{ x: 0.65, y: 0.24, width: 0.32, height: 0.68 }]
  }
};

export const resolveLayoutRegion = (slide: SlideSpec, key: string): NormalizedRegion => {
  const resolved = slide.presentation.layout.regions?.[key] ?? DEFAULT_LAYOUT_PROFILES[slide.presentation.layout.kind].regions[key];
  if (!resolved) throw new Error(`Layout '${slide.presentation.layout.kind}' has no region '${key}'.`);
  return structuredClone(resolved);
};

export const resolveLayoutSafeAreas = (slide: SlideSpec): NormalizedRegion[] =>
  (slide.presentation.layout.safeAreas ?? DEFAULT_LAYOUT_PROFILES[slide.presentation.layout.kind].safeAreas)
    .map((area) => structuredClone(area));
