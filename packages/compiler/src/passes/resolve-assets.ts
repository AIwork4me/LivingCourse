import { sha256 } from "@livingcourse/core";
import type { CompilerContext, CompilerState, ResolvedAsset } from "../types.js";

export const resolveAssetsPass = (state: CompilerState, context: CompilerContext): CompilerState => {
  const assets = new Map<string, ResolvedAsset[]>();
  const diagnostics = [...state.diagnostics];
  for (const [slideIndex, slide] of state.course.slides.entries()) {
    const resolved = slide.presentation.visualIntent.requirements.map((requirement, assetIndex): ResolvedAsset => {
      if (requirement.assetRef === null) {
        diagnostics.push({
          code: "LC-ASSET-001",
          path: `/slides/${slideIndex}/presentation/visualIntent/requirements/${assetIndex}/assetRef`,
          message: `Asset '${requirement.id}' is unresolved.`,
          severity: requirement.pocOnly ? "error" : "blocking"
        });
        return { ...requirement, exists: false, approved: false, sha256: null };
      }
      const probed = context.assetProbe.probe(requirement.assetRef);
      if (!probed.exists) {
        diagnostics.push({
          code: "LC-ASSET-001",
          path: `/slides/${slideIndex}/presentation/visualIntent/requirements/${assetIndex}/assetRef`,
          message: `Asset '${requirement.assetRef}' does not exist.`,
          severity: "blocking"
        });
      }
      return {
        ...requirement,
        ...probed,
        sha256: probed.sha256 ?? (probed.exists ? sha256(requirement.assetRef) : null)
      };
    });
    assets.set(slide.id, resolved);
  }
  return { ...state, assets, diagnostics };
};
