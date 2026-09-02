import { cp, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { executeBuild, type WorkflowRenderers } from "@livingcourse/workflow";

/**
 * v0.1.1 production closure: LivingCourse regenerates missing narration audio
 * through a real LivingVoice HTTP server. LivingCourse only ever sends
 * `voice_config_id + text`; provider details stay behind the LivingVoice API.
 */

const fixtureRoot = fileURLToPath(new URL("../fixtures/golden-v0.1", import.meta.url));
const temporaryRoots: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  while (temporaryRoots.length) {
    const root = temporaryRoots.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
  while (servers.length) {
    const server = servers.pop();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

const temporary = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "livingcourse-livingvoice-test-"));
  temporaryRoots.push(root);
  return root;
};

/** A minimal, structurally valid WAV payload (44-byte header + silence). */
const wavBytes = (durationMs: number): Buffer => {
  const sampleRate = 24_000;
  const samples = Math.floor((sampleRate * durationMs) / 1000);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + samples * 2, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(samples * 2, 40);
  return Buffer.concat([header, Buffer.alloc(samples * 2)]);
};

interface LivingVoiceCall { method: string; path: string; body: Record<string, unknown> | null }

const startFakeLivingVoice = async (): Promise<{ url: string; calls: LivingVoiceCall[] }> => {
  const calls: LivingVoiceCall[] = [];
  const server = createServer((req, res) => {
    const requestPath = req.url ?? "/";
    let raw = "";
    req.on("data", (chunk: Buffer) => { raw += chunk.toString(); });
    req.on("end", () => {
      calls.push({ method: req.method ?? "", path: requestPath, body: raw.length > 0 ? JSON.parse(raw) as Record<string, unknown> : null });
      if (req.method === "GET" && requestPath === "/v1/voice-configs/voicecfg_demo_v1") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ voice_config_id: "voicecfg_demo_v1", name: "Demo", version: 1, status: "preferred" }));
        return;
      }
      if (req.method === "POST" && requestPath === "/v1/speech") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ generation_id: `gen_${calls.length}`, voice_config_id: "voicecfg_demo_v1", audio_url: "/v1/audio/fake.wav", format: "wav", duration_ms: 2_000 }));
        return;
      }
      if (req.method === "GET" && requestPath === "/v1/audio/fake.wav") {
        res.writeHead(200, { "Content-Type": "audio/wav" });
        res.end(wavBytes(2_000));
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "not found" } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  return { url: `http://127.0.0.1:${address.port}`, calls };
};

/** Golden course with audio files removed and narration pinned to a LivingVoice config. */
const courseWithoutAudio = async (): Promise<{ courseRoot: string; coursePath: string }> => {
  const courseRoot = await temporary();
  await cp(fixtureRoot, courseRoot, { recursive: true });
  await rm(path.join(courseRoot, "audio"), { recursive: true, force: true });
  const coursePath = path.join(courseRoot, "course-spec.json");
  const original = await readFile(coursePath, "utf8");
  const rewritten = original
    .replaceAll("audio/slide-01.mp3", "audio/slide-01.wav")
    .replaceAll("audio/slide-02.mp3", "audio/slide-02.wav")
    .replaceAll("audio/slide-03.mp3", "audio/slide-03.wav")
    .replaceAll("manufacturing-training-default", "voicecfg_demo_v1");
  await writeFile(coursePath, rewritten, "utf8");
  return { courseRoot, coursePath };
};

const fakeRenderers = (counts: { ppt: number; video: number }): WorkflowRenderers => ({
  renderPpt: async (_plan, outputPath) => {
    counts.ppt += 1;
    await writeFile(outputPath, "deterministic-ppt", "utf8");
  },
  renderVideo: async (_plan, outputPath) => {
    counts.video += 1;
    await writeFile(outputPath, "deterministic-video", "utf8");
  }
});

describe("LivingVoice narration closure (v0.1.1)", () => {
  it("regenerates missing narration audio through LivingVoice and completes the build", async () => {
    const { courseRoot, coursePath } = await courseWithoutAudio();
    const workspaceRoot = await temporary();
    const outputRoot = path.join(workspaceRoot, "out");
    const livingvoice = await startFakeLivingVoice();
    const { LivingVoiceNarrationProvider } = await import("@livingcourse/providers");
    const narration = new LivingVoiceNarrationProvider({ baseUrl: livingvoice.url });
    const counts = { ppt: 0, video: 0 };

    const result = await executeBuild(coursePath, {
      workspaceRoot,
      outputRoot,
      renderers: fakeRenderers(counts),
      narration
    });

    expect(result.status).toBe("complete");
    // Three slides → three synthesized narration files, one speech call each.
    expect(result.aiCalls.tts).toBe(3);
    expect(result.regenerated).toHaveLength(3);
    expect(result.regenerated.some((id) => id.startsWith("audio:slide-01"))).toBe(true);
    const speechCalls = livingvoice.calls.filter((call) => call.path === "/v1/speech");
    expect(speechCalls).toHaveLength(3);
    // LivingCourse only ever sends voice_config_id + text.
    for (const call of speechCalls) {
      expect(Object.keys(call.body ?? {}).sort()).toEqual(["text", "voice_config_id"]);
      expect((call.body as { voice_config_id: string }).voice_config_id).toBe("voicecfg_demo_v1");
    }
    // The synthesized files landed at the declared audioAssetRef paths.
    for (const slide of ["slide-01", "slide-02", "slide-03"]) {
      const info = await stat(path.join(courseRoot, "audio", `${slide}.wav`));
      expect(info.size).toBeGreaterThan(44);
    }
    // The rendered outputs exist through the fake deterministic renderers.
    expect(counts).toEqual({ ppt: 1, video: 1 });

    // Second build reuses everything: zero provider calls.
    const second = await executeBuild(coursePath, {
      workspaceRoot,
      outputRoot,
      renderers: fakeRenderers(counts),
      narration
    });
    expect(second.status).toBe("complete");
    expect(second.aiCalls.tts).toBe(0);
    expect(livingvoice.calls.filter((call) => call.path === "/v1/speech")).toHaveLength(3);
  });

  it("still fails with LC-PROVIDER-001 when narration audio is missing and no capability is configured", async () => {
    const { coursePath } = await courseWithoutAudio();
    const workspaceRoot = await temporary();
    const counts = { ppt: 0, video: 0 };
    await expect(executeBuild(coursePath, {
      workspaceRoot,
      outputRoot: path.join(workspaceRoot, "out"),
      renderers: fakeRenderers(counts)
    })).rejects.toMatchObject({ failure: { code: "LC-PROVIDER-001" } });
    expect(counts).toEqual({ ppt: 0, video: 0 });
  });
});
