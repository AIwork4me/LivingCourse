import { sha256 } from "@livingcourse/core";
import type { MaterialIR } from "@livingcourse/intake";
import type { KnowledgeCandidate } from "./capabilities.js";

export interface ResolutionAction {
  id: string;
  label: string;
  acceptedEvidence: "controlled_sop_or_wi" | "manufacturer_manual" | "site_equipment_photo" | "confirmed_operation_region" | "authority_selection";
}

export interface GroundingRequirement {
  id: string;
  candidateId: string;
  risk: KnowledgeCandidate["category"];
  releaseScope: "author_review" | "production";
  requiredEvidence: ResolutionAction["acceptedEvidence"][];
}

export interface GroundingGap {
  id: string;
  candidateId: string;
  status: "gap" | "blocked";
  explanation: string;
  resolutionActions: ResolutionAction[];
}

const actions: ResolutionAction[] = [
  { id: "provide-controlled-procedure", label: "Provide an approved SOP or work instruction.", acceptedEvidence: "controlled_sop_or_wi" },
  { id: "provide-manufacturer-manual", label: "Provide the manufacturer equipment manual.", acceptedEvidence: "manufacturer_manual" },
  { id: "provide-site-photo", label: "Upload a current on-site equipment photo.", acceptedEvidence: "site_equipment_photo" },
  { id: "confirm-operation-region", label: "Confirm the exact operation region on the approved image.", acceptedEvidence: "confirmed_operation_region" }
];

const materialFor = (candidate: KnowledgeCandidate, materials: readonly MaterialIR[]): MaterialIR[] => {
  const ids = new Set(candidate.evidenceRefs.map((ref) => ref.materialId));
  return materials.filter((material) => ids.has(material.material.id));
};

export const resolveGrounding = (
  candidates: readonly KnowledgeCandidate[],
  materials: readonly MaterialIR[]
): { candidates: KnowledgeCandidate[]; requirements: GroundingRequirement[]; gaps: GroundingGap[] } => {
  const requirements: GroundingRequirement[] = [];
  const gaps: GroundingGap[] = [];
  const statusByCandidate = new Map<string, KnowledgeCandidate["groundingStatus"]>();
  for (const candidate of candidates) {
    if (candidate.category !== "device_operation") continue;
    const requirement: GroundingRequirement = {
      id: `grounding-requirement-${sha256(candidate.id).slice(0, 16)}`,
      candidateId: candidate.id,
      risk: candidate.category,
      releaseScope: "production",
      requiredEvidence: actions.map((action) => action.acceptedEvidence)
    };
    requirements.push(requirement);
    const sources = materialFor(candidate, materials);
    const hasControlledProcedure = sources.some((source) => source.material.sourceClass === "controlled_internal" && /pdf|wordprocessing|text\//u.test(source.material.mediaType));
    const hasSiteImage = sources.some((source) => source.material.sourceClass === "controlled_internal" && source.material.mediaType.startsWith("image/") && source.units.some((unit) => unit.blocks.some((block) => block.location.anchor)));
    if (!hasControlledProcedure || !hasSiteImage) {
      const id = `grounding-gap-${sha256({ candidateId: candidate.id, hasControlledProcedure, hasSiteImage }).slice(0, 16)}`;
      gaps.push({
        id,
        candidateId: candidate.id,
        status: "gap",
        explanation: "This claim concerns real equipment operation but lacks a complete controlled procedure plus a confirmed real-device anchor. It may enter author review, but production remains blocked.",
        resolutionActions: actions.map((action) => ({ ...action }))
      });
      statusByCandidate.set(candidate.id, "gap");
    }
  }
  return {
    candidates: candidates.map((candidate) => ({ ...candidate, groundingStatus: statusByCandidate.get(candidate.id) ?? "satisfied" })),
    requirements,
    gaps
  };
};
