import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const toolPath = process.env.LIVINGCOURSE_ARTIFACT_TOOL_PATH;
if (!toolPath) throw new Error("Set LIVINGCOURSE_ARTIFACT_TOOL_PATH to the artifact_tool.mjs runtime path.");
const { Presentation, PresentationFile } = await import(pathToFileURL(toolPath).href);

const root = process.cwd();
const fixture = path.join(root, "tests", "fixtures", "raw-manufacturing-course");
const qa = path.join(root, ".livingcourse", "fixture-qa", "training-old");
await fs.mkdir(fixture, { recursive: true });
await fs.mkdir(qa, { recursive: true });

const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });

const addText = (slide, name, value, position, style) => {
  const shape = slide.shapes.add({ geometry: "textbox", name, position, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
  shape.text = value;
  shape.text.style = { fontFace: "Arial", color: "#000000", ...style };
  return shape;
};

const cover = presentation.slides.add();
cover.background.fill = "#FFFFFF";
addText(cover, "fixture-label", "ARCHIVED · SYNTHETIC TEST MATERIAL", { left: 42, top: 38, width: 560, height: 36 }, { fontSize: 18, bold: true, color: "#277EAA" });
addText(cover, "cover-title", "Synthetic Training Machine", { left: 42, top: 96, width: 570, height: 110 }, { fontSize: 48, bold: true });
addText(cover, "cover-body", "Old training deck\nReference source · superseded fixture", { left: 42, top: 250, width: 540, height: 150 }, { fontSize: 28, color: "#344B57" });
const imageBytes = await fs.readFile(path.join(fixture, "equipment-photo.jpg"));
cover.images.add({ blob: imageBytes.buffer.slice(imageBytes.byteOffset, imageBytes.byteOffset + imageBytes.byteLength), contentType: "image/jpeg", alt: "Synthetic diagram of a fictional training machine; not real-device evidence", fit: "cover", geometry: "roundRect", borderRadius: "rounded-xl", position: { left: 658, top: 42, width: 582, height: 588 } });
addText(cover, "page-number", "1", { left: 1184, top: 660, width: 54, height: 24 }, { fontSize: 13, alignment: "right" });

const conflict = presentation.slides.add();
conflict.background.fill = "#FFFFFF";
addText(conflict, "slide-label", "ARCHIVED REFERENCE", { left: 42, top: 40, width: 480, height: 40 }, { fontSize: 20, bold: true, color: "#277EAA" });
addText(conflict, "authority-label", "Superseded · author must resolve", { left: 828, top: 40, width: 410, height: 40 }, { fontSize: 20, color: "#5A6970" });
addText(conflict, "conflicting-setting", "Synthetic training\npressure setting = A", { left: 42, top: 245, width: 1080, height: 250 }, { fontSize: 68, bold: true });
addText(conflict, "fixture-warning", "A is a fictional comparison token, not a real equipment value.", { left: 42, top: 600, width: 880, height: 38 }, { fontSize: 18, color: "#5A6970" });
addText(conflict, "page-number", "2", { left: 1184, top: 660, width: 54, height: 24 }, { fontSize: 13, alignment: "right" });

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
await pptx.save(path.join(fixture, "training-old.pptx"));
