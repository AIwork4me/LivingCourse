import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BuildFingerprints } from "@livingcourse/compiler";
import { sha256 } from "@livingcourse/core";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));

const filesBelow = async (target: string): Promise<string[]> => {
  const entries = await readdir(target, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(child));
    else files.push(child);
  }
  return files.sort();
};

const contentFingerprint = async (targets: readonly string[]): Promise<string> => {
  const records: Array<{ path: string; sha256: string }> = [];
  for (const target of targets) {
    const absolute = path.join(repositoryRoot, target);
    const files = (await stat(absolute)).isDirectory() ? await filesBelow(absolute) : [absolute];
    for (const file of files) {
      records.push({
        path: path.relative(repositoryRoot, file).replaceAll("\\", "/"),
        sha256: createHash("sha256").update(await readFile(file)).digest("hex")
      });
    }
  }
  return sha256(records.sort((left, right) => left.path.localeCompare(right.path)));
};

export const resolveWorkflowBuildFingerprints = async (): Promise<BuildFingerprints> => ({
  presentationRendererFingerprint: await contentFingerprint(["packages/renderers/src/ppt"]),
  videoRendererFingerprint: await contentFingerprint(["packages/renderers/src/remotion"]),
  vocabularyFingerprint: await contentFingerprint(["packages/core/src/types.ts", "packages/core/src/schema", "packages/core/src/policies"]),
  profileFingerprint: await contentFingerprint(["profiles/visual", "profiles/captions", "profiles/characters"]),
  compilerFingerprint: await contentFingerprint(["packages/compiler/src"])
});
