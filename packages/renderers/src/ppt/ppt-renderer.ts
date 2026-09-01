import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { PresentationElement, PresentationPlan } from "@livingcourse/compiler";

interface PptSlide {
  background: Record<string, unknown>;
  addShape(shape: string, options: Record<string, unknown>): PptSlide;
  addText(text: string, options: Record<string, unknown>): PptSlide;
  addImage(options: Record<string, unknown>): PptSlide;
  addNotes(notes: string): PptSlide;
}

interface PptPresentation {
  layout: string;
  author: string;
  company: string;
  subject: string;
  title: string;
  revision: string;
  theme: Record<string, unknown>;
  addSlide(): PptSlide;
  writeFile(options: { fileName: string; compression: boolean }): Promise<string>;
}

type PptConstructor = new () => PptPresentation;
const PptxGenJS = createRequire(import.meta.url)("pptxgenjs") as PptConstructor;

const WIDTH = 13.333;
const HEIGHT = 7.5;
const COLORS = {
  background: "F7F8F3",
  text: "1F2A37",
  blue: "2F6FED",
  orange: "F28C28",
  line: "C9D3DF",
  support: "DCEFFD"
} as const;

export interface PptRenderOptions {
  outputPath: string;
  courseRoot: string;
}

export interface PptRenderResult {
  outputPath: string;
  slideCount: number;
  nativeTextCount: number;
}

const geometry = (element: PresentationElement) => ({
  x: element.geometry.x * WIDTH,
  y: element.geometry.y * HEIGHT,
  w: element.geometry.width * WIDTH,
  h: element.geometry.height * HEIGHT
});

const resolveAsset = (courseRoot: string, assetRef: string): string => {
  const root = path.resolve(courseRoot);
  const resolved = path.resolve(root, assetRef);
  if (!resolved.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) {
    throw new Error(`Asset reference escapes the course root: '${assetRef}'.`);
  }
  return resolved;
};

const fontSize = (role: PresentationElement["styleRole"]): number => {
  if (role === "title") return 38;
  if (role === "subtitle") return 24;
  if (role === "warning") return 23;
  if (role === "disclosure") return 12;
  return 19;
};

const addNativeText = (slide: PptSlide, element: PresentationElement): void => {
  if (element.text === undefined) return;
  const box = geometry(element);
  if (element.styleRole === "warning") {
    slide.addShape("rect", {
      ...box,
      fill: { color: COLORS.orange, transparency: 87 },
      line: { color: COLORS.orange, width: 2 },
      radius: 0.08,
      objectName: `${element.id}-warning-panel`
    });
  }
  if (element.styleRole === "disclosure") {
    slide.addShape("line", {
      x: box.x,
      y: box.y - 0.05,
      w: box.w,
      h: 0,
      line: { color: COLORS.line, width: 1.3 },
      objectName: `${element.id}-rule`
    });
  }
  slide.addText(element.text, {
    ...box,
    objectName: element.id,
    fontFace: "Microsoft YaHei",
    fontSize: fontSize(element.styleRole),
    bold: element.styleRole === "title" || element.styleRole === "subtitle" || element.styleRole === "warning",
    color: element.styleRole === "subtitle" || element.styleRole === "disclosure" ? COLORS.blue : COLORS.text,
    margin: element.styleRole === "warning" ? 0.16 : 0,
    breakLine: false,
    fit: "shrink",
    valign: "mid",
    align: element.styleRole === "body" ? "center" : "left"
  });
};

const addImage = (slide: PptSlide, element: PresentationElement, courseRoot: string, layout: string): void => {
  if (element.assetRef === undefined) return;
  const box = geometry(element);
  slide.addImage({
    path: resolveAsset(courseRoot, element.assetRef),
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    sizing: { type: layout === "hero" ? "cover" : "contain", w: box.w, h: box.h },
    altText: element.altText ?? element.id,
    objectName: element.id
  });
};

const addPlanShape = (slide: PptSlide, element: PresentationElement): void => {
  if (element.kind !== "shape" || element.shape === undefined) return;
  const box = geometry(element);
  const color = element.colorRole === "secondary" ? COLORS.orange : element.colorRole === "primary" ? COLORS.blue : COLORS.line;
  if (element.shape === "line") {
    slide.addShape("line", { ...box, line: { color, width: 2 }, objectName: element.id });
    return;
  }
  slide.addShape(element.shape === "circle" ? "ellipse" : "rect", {
    ...box,
    fill: element.shape === "circle" ? { color, transparency: 100 } : { color, transparency: 88 },
    line: { color, width: element.shape === "circle" ? 3 : 1.5 },
    objectName: element.id
  });
};

const addSlideAccents = (slide: PptSlide, title: PresentationElement | undefined): void => {
  if (!title) return;
  const box = geometry(title);
  slide.addShape("line", { x: box.x, y: Math.max(0.12, box.y - 0.14), w: 0.46, h: 0, line: { color: COLORS.orange, width: 4 }, objectName: `${title.id}-accent-orange` });
  slide.addShape("line", { x: box.x + 0.56, y: Math.max(0.12, box.y - 0.14), w: 0.24, h: 0, line: { color: COLORS.blue, width: 4 }, objectName: `${title.id}-accent-blue` });
};

export const renderPresentationPlan = async (
  plan: PresentationPlan,
  options: PptRenderOptions
): Promise<PptRenderResult> => {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "LivingCourse";
  pptx.company = "LivingCourse Open Source";
  pptx.subject = "Reviewable enterprise training course";
  pptx.title = plan.title;
  pptx.revision = "1";
  pptx.theme = {
    headFontFace: "Microsoft YaHei",
    bodyFontFace: "Microsoft YaHei",
    lang: "zh-CN"
  };

  for (const slidePlan of plan.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.background };
    const title = slidePlan.elements.find((element) => element.styleRole === "title");
    const hero = slidePlan.layout === "hero";
    for (const element of slidePlan.elements.filter((candidate) => candidate.kind === "shape" && candidate.shape === "line")) addPlanShape(slide, element);
    for (const element of slidePlan.elements.filter((candidate) => candidate.kind === "image")) addImage(slide, element, options.courseRoot, slidePlan.layout);
    for (const element of slidePlan.elements.filter((candidate) => candidate.kind === "shape" && candidate.shape !== "line")) addPlanShape(slide, element);
    if (hero) {
      slide.addShape("rect", { x: 0, y: 0, w: WIDTH * 0.54, h: HEIGHT, fill: { color: COLORS.background, transparency: 10 }, line: { transparency: 100 }, objectName: `${slidePlan.slideId}-text-scrim` });
    }
    addSlideAccents(slide, title);
    for (const element of slidePlan.elements.filter((candidate) => candidate.kind !== "image" && candidate.kind !== "shape")) addNativeText(slide, element);
    slide.addNotes(slidePlan.speakerNotes);
  }

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await pptx.writeFile({ fileName: options.outputPath, compression: true });
  return {
    outputPath: options.outputPath,
    slideCount: plan.slides.length,
    nativeTextCount: plan.slides.reduce((sum, slide) => sum + slide.nativeText.length, 0)
  };
};
