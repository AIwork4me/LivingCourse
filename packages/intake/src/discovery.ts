import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { SourceClass } from "@livingcourse/core";
import type { DocumentInput, MaterialAuthority } from "./types.js";

const mediaTypes: Readonly<Record<string, string>> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".md": "text/markdown",
  ".txt": "text/plain"
};

export const REQUIRED_INTAKE_MEDIA_TYPES = [...new Set(Object.values(mediaTypes))].sort();

export interface SourceMetadata {
  sourceClass?: SourceClass;
  authority?: string | null;
  version?: string | null;
  effectiveDate?: string | null;
}

const authority = (metadata: SourceMetadata | undefined): MaterialAuthority => ({
  sourceClass: metadata?.sourceClass ?? "unknown",
  authority: metadata?.authority ?? null,
  version: metadata?.version ?? null,
  effectiveDate: metadata?.effectiveDate ?? null
});

export const discoverDocumentInputs = async (
  folder: string,
  metadata: Readonly<Record<string, SourceMetadata>> = {}
): Promise<DocumentInput[]> => {
  const root = path.resolve(folder);
  const entries = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && mediaTypes[path.extname(entry.name).toLowerCase()] !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name));
  const discovered: DocumentInput[] = [];
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    const bytes = await readFile(absolute);
    const sha = createHash("sha256").update(bytes).digest("hex");
    const stableSourceIdentity = createHash("sha256").update(entry.name.normalize("NFC").toLocaleLowerCase()).digest("hex");
    const fileStat = await stat(absolute);
    discovered.push({
      materialId: `material-${stableSourceIdentity.slice(0, 24)}`,
      path: absolute,
      originalName: entry.name,
      mediaType: mediaTypes[path.extname(entry.name).toLowerCase()] ?? "application/octet-stream",
      sha256: sha,
      sizeBytes: fileStat.size,
      authority: authority(metadata[entry.name])
    });
  }
  return discovered;
};
