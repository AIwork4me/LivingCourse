import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DirectTextProvider } from "@livingcourse/intake";
import { MineruCloudProvider } from "@livingcourse/providers";
import { planIntake } from "@livingcourse/workflow";

const temporaryRoots: string[] = [];
const originalToken = process.env.MINERU_API_TOKEN;

afterEach(async () => {
  if (originalToken === undefined) delete process.env.MINERU_API_TOKEN;
  else process.env.MINERU_API_TOKEN = originalToken;
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const tempCache = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "livingcourse-profile-"));
  temporaryRoots.push(root);
  return root;
};

describe("parser profile truthfulness", () => {
  it("advertises only balanced and blocks high_fidelity before any network request", async () => {
    let fetchCalls = 0;
    const cloud = new MineruCloudProvider({ fetchImplementation: async () => { fetchCalls += 1; throw new Error("network must not be called"); } });
    await expect(cloud.capabilities()).resolves.toMatchObject({ parseProfiles: ["balanced"] });
    process.env.MINERU_API_TOKEN = "fixture-token";

    const plan = await planIntake(path.resolve("tests/fixtures/raw-manufacturing-course"), {
      cacheRoot: await tempCache(),
      profile: "high_fidelity",
      providers: [new DirectTextProvider(), cloud]
    });

    const cloudFiles = plan.files.filter((item) => item.parser === "mineru-cloud");
    expect(cloudFiles.length).toBeGreaterThan(0);
    expect(cloudFiles.every((item) => item.action === "BLOCKED" && item.potentialEscalation === "none")).toBe(true);
    expect(plan.blockers.join("\n")).toContain("Supported profiles: balanced");
    expect(fetchCalls).toBe(0);
  });

  it("does not claim high_fidelity escalation for the balanced Cloud profile", async () => {
    let fetchCalls = 0;
    const cloud = new MineruCloudProvider({
      fetchImplementation: async () => {
        fetchCalls += 1;
        return new Response(JSON.stringify({ code: 0, data: {} }), { status: 200, headers: { "content-type": "application/json" } });
      }
    });
    process.env.MINERU_API_TOKEN = "fixture-token";

    const plan = await planIntake(path.resolve("tests/fixtures/raw-manufacturing-course"), {
      cacheRoot: await tempCache(),
      profile: "balanced",
      providers: [new DirectTextProvider(), cloud]
    });

    const cloudFiles = plan.files.filter((item) => item.parser === "mineru-cloud");
    expect(cloudFiles.every((item) => item.potentialEscalation === "none")).toBe(true);
    expect(fetchCalls).toBe(1);
  });
});
