import type { SlideSpec } from "@livingcourse/core";

export type ElementIdentityKind = "role" | "visual" | "knowledge" | "marker" | "connector";

const segment = (value: string): string => encodeURIComponent(value);

export const presentationElementId = (slideId: string, kind: ElementIdentityKind, localId: string): string =>
  `lc/${segment(slideId)}/${kind}/${segment(localId)}`;

const roleAliases = [
  ["abnormal-area-spotlight", "spotlight"],
  ["simulation-disclosure", "simulation-disclosure"],
  ["process-connector", "process-connector"],
  ["key-message", "key-message"],
  ["subtitle", "subtitle"],
  ["title", "title"]
] as const;

export const resolvePresentationTargetId = (slide: SlideSpec, targetId: string): string => {
  if (targetId.startsWith("lc/")) return targetId;
  if (slide.presentation.visualIntent.requirements.some((requirement) => requirement.id === targetId)) {
    return presentationElementId(slide.id, "visual", targetId);
  }
  if (slide.knowledge.items.some((item) => item.id === targetId)) {
    return presentationElementId(slide.id, "knowledge", targetId);
  }
  for (const [alias, role] of roleAliases) {
    if (targetId === alias || targetId === `${slide.id}:${alias}` || targetId.endsWith(`-${alias}`)) {
      return presentationElementId(slide.id, "role", role);
    }
  }
  return presentationElementId(slide.id, "role", targetId);
};
