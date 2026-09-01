import { access, constants, mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

export type DoctorStatus = "PASS" | "WARN" | "FAIL";
export interface DoctorCheck { id: string; label: string; status: DoctorStatus; detail: string }
export interface DoctorReport { status: DoctorStatus; checks: DoctorCheck[] }

const commandAvailable = (command: string): boolean => {
  const lookup = process.platform === "win32" ? spawnSync("where.exe", [command], { encoding: "utf8" }) : spawnSync("which", [command], { encoding: "utf8" });
  return lookup.status === 0;
};

const rank = (status: DoctorStatus): number => status === "FAIL" ? 2 : status === "WARN" ? 1 : 0;

export const runDoctor = async (options: { workspaceRoot: string; generationRequired?: boolean }): Promise<DoctorReport> => {
  const checks: DoctorCheck[] = [];
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({ id: "node", label: "Node.js", status: nodeMajor >= 20 ? "PASS" : "FAIL", detail: `Detected ${process.versions.node}; requires >=20.` });
  checks.push({ id: "pnpm", label: "pnpm", status: commandAvailable("pnpm") ? "PASS" : "FAIL", detail: commandAvailable("pnpm") ? "Available on PATH." : "Install pnpm and add it to PATH." });
  checks.push({ id: "ffmpeg", label: "FFmpeg", status: commandAvailable("ffmpeg") ? "PASS" : "FAIL", detail: commandAvailable("ffmpeg") ? "Available on PATH." : "Missing from PATH; clean-machine media diagnostics are incomplete." });
  checks.push({ id: "ffprobe", label: "FFprobe", status: commandAvailable("ffprobe") ? "PASS" : "FAIL", detail: commandAvailable("ffprobe") ? "Available on PATH." : "Missing from PATH; external media verification is unavailable." });
  const fontCandidates = process.platform === "win32"
    ? ["C:\\Windows\\Fonts\\msyh.ttc", "C:\\Windows\\Fonts\\msyhbd.ttc"]
    : ["/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"];
  let fontFound = false;
  for (const candidate of fontCandidates) {
    try { await access(candidate, constants.R_OK); fontFound = true; break; } catch { /* continue */ }
  }
  checks.push({ id: "fonts", label: "Required fonts", status: fontFound ? "PASS" : "WARN", detail: fontFound ? "A supported CJK font is available." : "No preferred CJK font found; fallback rendering may differ." });
  const require = createRequire(import.meta.url);
  for (const dependency of ["pptxgenjs", "@remotion/renderer", "@remotion/bundler"]) {
    let available = true;
    try { require.resolve(dependency); } catch { available = false; }
    checks.push({ id: `dependency:${dependency}`, label: dependency, status: available ? "PASS" : "FAIL", detail: available ? "Renderer dependency resolves." : "Run pnpm install." });
  }
  const providerConfigured = Boolean(process.env.LIVINGCOURSE_PROVIDER_CONFIG);
  checks.push({
    id: "provider-config",
    label: "Provider configuration",
    status: options.generationRequired ? (providerConfigured ? "PASS" : "FAIL") : (providerConfigured ? "PASS" : "WARN"),
    detail: options.generationRequired ? (providerConfigured ? "Configured for requested generation." : "Generation is planned but no provider config is present.") : "Not required for approved-asset reuse."
  });
  const credentialConfigured = Boolean(process.env.LIVINGCOURSE_PROVIDER_CREDENTIAL);
  checks.push({
    id: "credentials",
    label: "Provider credentials",
    status: options.generationRequired ? (credentialConfigured ? "PASS" : "FAIL") : "PASS",
    detail: options.generationRequired ? (credentialConfigured ? "Credential is present (value not displayed)." : "Generation is planned but credentials are absent.") : "Not checked because this build needs no provider calls."
  });
  const probeDir = path.join(path.resolve(options.workspaceRoot), `.livingcourse-doctor-${process.pid}-${os.hostname()}`);
  try {
    await mkdir(probeDir, { recursive: false });
    const probeFile = path.join(probeDir, "write-test");
    await writeFile(probeFile, "ok", "utf8");
    await access(probeFile, constants.R_OK | constants.W_OK);
    checks.push({ id: "filesystem", label: "Filesystem permissions", status: "PASS", detail: "Workspace is readable and writable." });
  } catch (error) {
    checks.push({ id: "filesystem", label: "Filesystem permissions", status: "FAIL", detail: (error as Error).message });
  } finally {
    await rm(probeDir, { recursive: true, force: true });
  }
  const status = checks.reduce<DoctorStatus>((current, check) => rank(check.status) > rank(current) ? check.status : current, "PASS");
  return { status, checks };
};
