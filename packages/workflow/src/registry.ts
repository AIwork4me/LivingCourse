import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type { ArtifactRecord, ArtifactRegistryData, WorkflowRunState } from "./types.js";

const emptyRegistry = (): ArtifactRegistryData => ({ version: "0.1.0", artifacts: [] });

const exists = async (target: string): Promise<boolean> => {
  try { await stat(target); return true; } catch { return false; }
};

const atomicJsonWrite = async (target: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, target);
};

export const fileSha256 = async (target: string): Promise<string> =>
  createHash("sha256").update(await readFile(target)).digest("hex");

export class ArtifactRegistry {
  readonly root: string;
  readonly registryPath: string;
  readonly cacheRoot: string;
  readonly runsRoot: string;
  private data: ArtifactRegistryData = emptyRegistry();

  constructor(root: string) {
    this.root = path.resolve(root);
    this.registryPath = path.join(this.root, "registry.json");
    this.cacheRoot = path.join(this.root, "cache");
    this.runsRoot = path.join(this.root, "runs");
  }

  async load(): Promise<void> {
    await mkdir(this.cacheRoot, { recursive: true });
    await mkdir(this.runsRoot, { recursive: true });
    if (!await exists(this.registryPath)) {
      this.data = emptyRegistry();
      await this.save();
      return;
    }
    this.data = JSON.parse(await readFile(this.registryPath, "utf8")) as ArtifactRegistryData;
  }

  async save(): Promise<void> {
    this.data.artifacts.sort((left, right) => left.id.localeCompare(right.id));
    await atomicJsonWrite(this.registryPath, this.data);
  }

  all(): readonly ArtifactRecord[] {
    return structuredClone(this.data.artifacts);
  }

  findReusable(fingerprint: string): ArtifactRecord | null {
    const found = this.data.artifacts.find((artifact) =>
      artifact.generationFingerprint === fingerprint
        && (artifact.reviewStatus === "approved_for_poc_use" || artifact.reviewStatus === "approved_for_release")
    );
    return found ? structuredClone(found) : null;
  }

  async registerSource(record: Omit<ArtifactRecord, "path" | "sha256"> & { sourcePath: string }): Promise<ArtifactRecord> {
    const digest = await fileSha256(record.sourcePath);
    const extension = path.extname(record.sourcePath).toLowerCase();
    const cachePath = path.join(this.cacheRoot, `${digest}${extension}`);
    if (!await exists(cachePath)) await copyFile(record.sourcePath, cachePath);
    const resolved: ArtifactRecord = {
      id: record.id,
      kind: record.kind,
      sha256: digest,
      sourceHash: record.sourceHash,
      generationFingerprint: record.generationFingerprint,
      path: cachePath,
      provider: record.provider,
      model: record.model,
      reviewStatus: record.reviewStatus,
      dependencies: [...record.dependencies]
    };
    this.data.artifacts = [...this.data.artifacts.filter((artifact) => artifact.id !== record.id), resolved];
    await this.save();
    return structuredClone(resolved);
  }

  async readRun(runId: string): Promise<WorkflowRunState | null> {
    const runPath = path.join(this.runsRoot, `${runId}.json`);
    return await exists(runPath) ? JSON.parse(await readFile(runPath, "utf8")) as WorkflowRunState : null;
  }

  async writeRun(state: WorkflowRunState): Promise<void> {
    await atomicJsonWrite(path.join(this.runsRoot, `${state.runId}.json`), state);
  }
}
