import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { planIntake } from "@livingcourse/workflow";

const temporary: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("explicit MinerU Cloud selection", () => {
  it("selects cloud only when explicitly configured and discloses remote processing before upload", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "livingcourse-cloud-selection-"));
    temporary.push(root);
    const source = path.join(root, "fixture.pdf");
    await writeFile(source, "synthetic public-safe PDF bytes", "utf8");
    vi.stubEnv("MINERU_API_TOKEN", "");
    const result = await planIntake(root, { workspaceRoot: root, cacheRoot: path.join(root, "cache"), documentProvider: "mineru-cloud" });
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({
      parser: "mineru-cloud",
      processingMode: "remote",
      endpointClassification: "public_remote",
      action: "BLOCKED",
      confidentialityWarning: "This parser processes source files on a remote service."
    });
  });

  it("fails closed for an unknown configured provider", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "livingcourse-cloud-selection-invalid-"));
    temporary.push(root);
    await writeFile(path.join(root, "fixture.pdf"), "synthetic public-safe PDF bytes", "utf8");
    vi.stubEnv("LIVINGCOURSE_DOCUMENT_PROVIDER", "unexpected-provider");
    await expect(planIntake(root, { workspaceRoot: root, cacheRoot: path.join(root, "cache") })).rejects.toThrow("unsupported document provider");
  });
});
