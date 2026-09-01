import type { NormalizedRegion, SlideSpec } from "@livingcourse/core";
import type { CompilerState, PresentationElement } from "../types.js";

const region = (slide: SlideSpec, key: string, fallback: NormalizedRegion): NormalizedRegion =>
  structuredClone(slide.presentation.layout.regions[key] ?? fallback);

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
  if (visual?.assetRef) elements.push({ id: visual.id, kind: "image", assetRef: visual.assetRef, altText: visual.subject, geometry: region(slide, "visual", { x: 0, y: 0, width: 1, height: 1 }), readingOrder: 3, styleRole: "visual" });
  elements.push(textElement("slide-01-title", slide.presentation.title, region(slide, "title", { x: 0.06, y: 0.18, width: 0.42, height: 0.16 }), 1, "title"));
  if (slide.presentation.subtitle) elements.push(textElement("slide-01-subtitle", slide.presentation.subtitle, region(slide, "subtitle", { x: 0.06, y: 0.39, width: 0.4, height: 0.1 }), 2, "subtitle"));
  return elements;
};

const resolveStepProcess = (slide: SlideSpec): PresentationElement[] => {
  const elements: PresentationElement[] = [textElement("slide-02-title", slide.presentation.title, region(slide, "title", { x: 0.06, y: 0.08, width: 0.72, height: 0.14 }), 1, "title")];
  const process = region(slide, "processBand", { x: 0.06, y: 0.28, width: 0.72, height: 0.58 });
  const cellWidth = process.width / Math.max(1, slide.knowledge.items.length);
  const markerY = process.y + process.height * 0.64;
  if (slide.knowledge.items.length > 1) elements.push({
    id: `${slide.id}-process-connector`,
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
      id: `${item.id}-marker`,
      kind: "shape",
      shape: "circle",
      colorRole: index === slide.knowledge.items.length - 1 ? "secondary" : "primary",
      geometry: { x: cellX + cellWidth * 0.5 - 0.007, y: markerY - 0.012, width: 0.014, height: 0.024 },
      readingOrder: index * 2 + 3,
      styleRole: "accent"
    });
    if (requirement?.assetRef) elements.push({
      id: requirement.id,
      kind: "image",
      assetRef: requirement.assetRef,
      altText: requirement.subject,
      geometry: { x: cellX + cellWidth * 0.08, y: process.y, width: cellWidth * 0.84, height: process.height * 0.56 },
      readingOrder: index * 2 + 3,
      styleRole: "visual"
    });
    elements.push(textElement(item.id, item.text, { x: cellX, y: process.y + process.height * 0.7, width: cellWidth, height: process.height * 0.16 }, index * 2 + 4, "body"));
  }
  const guide = slide.presentation.visualIntent.requirements.find((candidate) => candidate.kind === "guide_character");
  if (guide?.assetRef) elements.push({ id: guide.id, kind: "image", assetRef: guide.assetRef, altText: guide.subject, geometry: region(slide, "guide", { x: 0.8, y: 0.34, width: 0.15, height: 0.46 }), readingOrder: 2, styleRole: "guide" });
  return elements;
};

const resolveSafetyFocus = (slide: SlideSpec): PresentationElement[] => {
  const synthetic = slide.presentation.visualIntent.requirements.find((requirement) => requirement.pocOnly && requirement.assetRef !== null);
  const elements: PresentationElement[] = [textElement("slide-03-title", slide.presentation.title, region(slide, "title", { x: 0.06, y: 0.07, width: 0.86, height: 0.14 }), 1, "title")];
  if (synthetic?.assetRef) elements.push({ id: synthetic.id, kind: "image", assetRef: synthetic.assetRef, altText: synthetic.subject, geometry: region(slide, "visual", { x: 0.05, y: 0.24, width: 0.58, height: 0.68 }), readingOrder: 2, styleRole: "visual" });
  const anchor = slide.grounding.anchor;
  const visualRegion = region(slide, "visual", { x: 0.05, y: 0.24, width: 0.58, height: 0.68 });
  if (anchor?.status === "approved_for_poc_only" && anchor.bounds) elements.push({
    id: "slide-03-abnormal-area-spotlight",
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
  if (slide.knowledge.safetyRule) elements.push(textElement("slide-03-key-message", slide.knowledge.safetyRule, region(slide, "warning", { x: 0.67, y: 0.29, width: 0.28, height: 0.25 }), 3, "warning"));
  const actions = region(slide, "actions", { x: 0.67, y: 0.6, width: 0.28, height: 0.25 });
  const itemHeight = actions.height / Math.max(1, slide.knowledge.items.length);
  for (const [index, item] of slide.knowledge.items.entries()) {
    elements.push(textElement(item.id, item.text, { x: actions.x, y: actions.y + itemHeight * index, width: actions.width, height: itemHeight }, index + 4, "body"));
  }
  if (slide.knowledge.disclosure) elements.push(textElement("slide-03-simulation-disclosure", slide.knowledge.disclosure, region(slide, "disclosure", { x: 0.67, y: 0.88, width: 0.28, height: 0.07 }), 8, "disclosure"));
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
