import type { NormalizedRegion, SlideSpec } from "@livingcourse/core";
import type { CompilerState, PresentationElement } from "../types.js";
import { presentationElementId } from "../element-ids.js";
import { resolveLayoutRegion } from "../layout-profile.js";

const textElement = (
  id: string,
  text: string,
  geometry: NormalizedRegion,
  readingOrder: number,
  styleRole: PresentationElement["styleRole"]
): PresentationElement => ({ id, kind: styleRole === "disclosure" ? "disclosure" : "text", text, geometry, readingOrder, styleRole });

const resolveHero = (slide: SlideSpec): PresentationElement[] => {
  const visual = slide.presentation.visualIntent.requirements[0];
  const elements: PresentationElement[] = [];
  if (visual?.assetRef) elements.push({ id: presentationElementId(slide.id, "visual", visual.id), kind: "image", assetRef: visual.assetRef, altText: visual.subject, geometry: resolveLayoutRegion(slide, "visual"), readingOrder: 3, styleRole: "visual" });
  elements.push(textElement(presentationElementId(slide.id, "role", "title"), slide.presentation.title, resolveLayoutRegion(slide, "title"), 1, "title"));
  if (slide.presentation.subtitle) elements.push(textElement(presentationElementId(slide.id, "role", "subtitle"), slide.presentation.subtitle, resolveLayoutRegion(slide, "subtitle"), 2, "subtitle"));
  return elements;
};

const resolveStepProcess = (slide: SlideSpec): PresentationElement[] => {
  const elements: PresentationElement[] = [textElement(presentationElementId(slide.id, "role", "title"), slide.presentation.title, resolveLayoutRegion(slide, "title"), 1, "title")];
  const process = resolveLayoutRegion(slide, "processBand");
  const cellWidth = process.width / Math.max(1, slide.knowledge.items.length);
  const markerY = process.y + process.height * 0.64;
  if (slide.knowledge.items.length > 1) elements.push({
    id: presentationElementId(slide.id, "connector", "process"),
    kind: "shape",
    shape: "line",
    colorRole: "line",
    geometry: { x: process.x + cellWidth * 0.5, y: markerY, width: process.width - cellWidth, height: 0.006 },
    readingOrder: 2,
    styleRole: "accent"
  });
  for (const [index, item] of slide.knowledge.items.entries()) {
    const requirement = slide.presentation.visualIntent.requirements.find((candidate) => candidate.id === item.visualRequirementRef);
    const cellX = process.x + cellWidth * index;
    elements.push({
      id: presentationElementId(slide.id, "marker", item.id),
      kind: "shape",
      shape: "circle",
      colorRole: index === slide.knowledge.items.length - 1 ? "secondary" : "primary",
      geometry: { x: cellX + cellWidth * 0.5 - 0.007, y: markerY - 0.012, width: 0.014, height: 0.024 },
      readingOrder: index * 2 + 3,
      styleRole: "accent"
    });
    if (requirement?.assetRef) elements.push({
      id: presentationElementId(slide.id, "visual", requirement.id),
      kind: "image",
      assetRef: requirement.assetRef,
      altText: requirement.subject,
      geometry: { x: cellX + cellWidth * 0.08, y: process.y, width: cellWidth * 0.84, height: process.height * 0.56 },
      readingOrder: index * 2 + 3,
      styleRole: "visual"
    });
    elements.push(textElement(presentationElementId(slide.id, "knowledge", item.id), item.text, { x: cellX, y: process.y + process.height * 0.7, width: cellWidth, height: process.height * 0.16 }, index * 2 + 4, "body"));
  }
  const guide = slide.presentation.visualIntent.requirements.find((candidate) => candidate.kind === "guide_character");
  if (guide?.assetRef) elements.push({ id: presentationElementId(slide.id, "visual", guide.id), kind: "image", assetRef: guide.assetRef, altText: guide.subject, geometry: resolveLayoutRegion(slide, "guide"), readingOrder: 2, styleRole: "guide" });
  return elements;
};

const resolveSafetyFocus = (slide: SlideSpec): PresentationElement[] => {
  const synthetic = slide.presentation.visualIntent.requirements.find((requirement) => requirement.pocOnly && requirement.assetRef !== null);
  const elements: PresentationElement[] = [textElement(presentationElementId(slide.id, "role", "title"), slide.presentation.title, resolveLayoutRegion(slide, "title"), 1, "title")];
  if (synthetic?.assetRef) elements.push({ id: presentationElementId(slide.id, "visual", synthetic.id), kind: "image", assetRef: synthetic.assetRef, altText: synthetic.subject, geometry: resolveLayoutRegion(slide, "visual"), readingOrder: 2, styleRole: "visual" });
  const anchor = slide.grounding.anchor;
  const visualRegion = resolveLayoutRegion(slide, "visual");
  if (anchor?.status === "approved_for_poc_only" && anchor.bounds) elements.push({
    id: presentationElementId(slide.id, "role", "spotlight"),
    kind: "shape",
    shape: "circle",
    colorRole: "secondary",
    geometry: {
      x: visualRegion.x + anchor.bounds.x * visualRegion.width,
      y: visualRegion.y + anchor.bounds.y * visualRegion.height,
      width: anchor.bounds.width * visualRegion.width,
      height: anchor.bounds.height * visualRegion.height
    },
    readingOrder: 3,
    styleRole: "accent"
  });
  if (slide.knowledge.safetyRule) elements.push(textElement(presentationElementId(slide.id, "role", "key-message"), slide.knowledge.safetyRule, resolveLayoutRegion(slide, "warning"), 3, "warning"));
  const actions = resolveLayoutRegion(slide, "actions");
  const itemHeight = actions.height / Math.max(1, slide.knowledge.items.length);
  for (const [index, item] of slide.knowledge.items.entries()) {
    elements.push(textElement(presentationElementId(slide.id, "knowledge", item.id), item.text, { x: actions.x, y: actions.y + itemHeight * index, width: actions.width, height: itemHeight }, index + 4, "body"));
  }
  if (slide.knowledge.disclosure) elements.push(textElement(presentationElementId(slide.id, "role", "simulation-disclosure"), slide.knowledge.disclosure, resolveLayoutRegion(slide, "disclosure"), 8, "disclosure"));
  return elements;
};

export const resolveLayoutPass = (state: CompilerState): CompilerState => {
  const elements = new Map<string, PresentationElement[]>();
  for (const slide of state.course.slides) {
    const resolved = slide.type === "hero" ? resolveHero(slide) : slide.type === "step_process" ? resolveStepProcess(slide) : resolveSafetyFocus(slide);
    elements.set(slide.id, resolved.sort((left, right) => left.readingOrder - right.readingOrder || left.id.localeCompare(right.id)));
  }
  return { ...state, elements };
};
