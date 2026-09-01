import { readFile } from "node:fs/promises";
import JSZip from "jszip";

export interface PptStructuralQa {
  slideCount: number;
  notesCount: number;
  nativeText: string[];
  editable: boolean;
}

const decodeXmlText = (value: string): string => value
  .replace(/&amp;/gu, "&")
  .replace(/&lt;/gu, "<")
  .replace(/&gt;/gu, ">")
  .replace(/&quot;/gu, "\"")
  .replace(/&apos;/gu, "'");

export const inspectPptxStructure = async (pptxPath: string): Promise<PptStructuralQa> => {
  const archive = await JSZip.loadAsync(await readFile(pptxPath));
  const slideNames = Object.keys(archive.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/u.test(name)).sort();
  const noteNames = Object.keys(archive.files).filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/u.test(name)).sort();
  const nativeText: string[] = [];
  for (const name of slideNames) {
    const xml = await archive.file(name)?.async("string");
    if (xml) nativeText.push(...[...xml.matchAll(/<a:t>(.*?)<\/a:t>/gu)].map((match) => decodeXmlText(match[1] ?? "")));
  }
  return {
    slideCount: slideNames.length,
    notesCount: noteNames.length,
    nativeText,
    editable: slideNames.length > 0 && nativeText.length > 0
  };
};
