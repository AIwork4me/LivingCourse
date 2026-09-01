import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const toolPath = process.env.LIVINGCOURSE_ARTIFACT_TOOL_PATH;
if (!toolPath) {
  throw new Error("Set LIVINGCOURSE_ARTIFACT_TOOL_PATH to the bundled artifact_tool.mjs path.");
}

const { Presentation, PresentationFile } = await import(pathToFileURL(toolPath).href);
const root = process.cwd();
const fixture = path.join(root, "tests", "fixtures", "semantic-manufacturing-course");
const qa = path.join(root, ".livingcourse", "fixture-qa", "semantic-archived-training");
await fs.mkdir(fixture, { recursive: true });
await fs.mkdir(qa, { recursive: true });

const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const addText = (slide, name, value, position, style = {}) => {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = value;
  shape.text.style = { fontFace: "Arial", color: "#111111", ...style };
  return shape;
};

const addChrome = (slide, number) => {
  addText(slide, "archive-label", "ARCHIVED TRAINING · SYNTHETIC FIXTURE", { left: 64, top: 42, width: 650, height: 28 }, { fontSize: 16, bold: true, color: "#3D8DFF" });
  addText(slide, "page", String(number), { left: 1170, top: 662, width: 46, height: 22 }, { fontSize: 13, alignment: "right", color: "#59636E" });
};

const cover = presentation.slides.add();
cover.background.fill = "#FFFFFF";
addChrome(cover, 1);
addText(cover, "title", "Synthetic Press\nOperator Training", { left: 64, top: 150, width: 710, height: 190 }, { fontSize: 58, bold: true });
addText(cover, "subtitle", "Superseded reference — never treat as current authority", { left: 64, top: 392, width: 760, height: 54 }, { fontSize: 25, color: "#59636E" });
const panel = cover.shapes.add({ geometry: "rect", name: "archive-panel", position: { left: 900, top: 136, width: 300, height: 360 }, fill: "#EDEDED", line: { style: "solid", fill: "#B8BCC4", width: 1 } });
addText(cover, "archive-year", "2023", { left: 940, top: 218, width: 220, height: 72 }, { fontSize: 54, bold: true, alignment: "center", color: "#59636E" });
addText(cover, "archive-status", "ARCHIVED\nRevision 1.4", { left: 940, top: 326, width: 220, height: 90 }, { fontSize: 23, alignment: "center", color: "#59636E" });

const settings = presentation.slides.add();
settings.background.fill = "#FFFFFF";
addChrome(settings, 2);
addText(settings, "title", "Archived operating reminder", { left: 64, top: 98, width: 910, height: 54 }, { fontSize: 38, bold: true });
addText(settings, "conflict", "Synthetic training pressure setting = 0.65 MPa", { left: 64, top: 220, width: 1110, height: 84 }, { fontSize: 36, bold: true, color: "#9B1C1C" });
addText(settings, "duplicate", "Wear splash goggles and safety shoes before entering the practice zone.", { left: 64, top: 350, width: 1110, height: 74 }, { fontSize: 27 });
addText(settings, "negation", "Do not open the guard door while the synthetic machine is running.", { left: 64, top: 468, width: 1110, height: 74 }, { fontSize: 27, bold: true });
addText(settings, "warning", "Conflict fixture only: the controlled SOP contains a different numeric value.", { left: 64, top: 594, width: 1060, height: 34 }, { fontSize: 17, color: "#59636E" });

const metadata = presentation.slides.add();
metadata.background.fill = "#FFFFFF";
addChrome(metadata, 3);
addText(metadata, "title", "Revision history", { left: 64, top: 98, width: 900, height: 54 }, { fontSize: 38, bold: true });
addText(metadata, "revision", "Revision 1.4 — formatting refresh\nRevision 1.3 — copyright notice updated\nRevision 1.2 — trainer biography updated", { left: 64, top: 205, width: 860, height: 210 }, { fontSize: 26, color: "#59636E" });
addText(metadata, "copyright", "© 2023 Synthetic Fixture Works. Internal archive copy.", { left: 64, top: 532, width: 920, height: 40 }, { fontSize: 20, color: "#59636E" });
addText(metadata, "irrelevant", "This slide intentionally contains no course fact.", { left: 64, top: 590, width: 920, height: 34 }, { fontSize: 17, italic: true, color: "#59636E" });

for (const [index, slide] of presentation.slides.items.entries()) {
  const stem = `slide-${String(index + 1).padStart(2, "0")}`;
  const png = await presentation.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(path.join(qa, `${stem}.png`), new Uint8Array(await png.arrayBuffer()));
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(path.join(qa, `${stem}.layout.json`), await layout.text(), "utf8");
}

const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
await fs.writeFile(path.join(qa, "montage.webp"), new Uint8Array(await montage.arrayBuffer()));
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(path.join(fixture, "archived-training.pptx"));
