import path from "node:path";
import { discoverDocumentInputs, materialIrContentHash, validateMaterialIR } from "@livingcourse/intake";
import { MineruCloudProvider, MINERU_CLOUD_TRANSPORT_VERSION } from "@livingcourse/providers";

const tokenPresent = Boolean(process.env.MINERU_API_TOKEN?.trim());

if (!tokenPresent) {
  console.log("REAL MINERU CLOUD SMOKE TEST = NOT EXECUTED");
  process.exit(0);
}

const startedAt = Date.now();
const fixtureRoot = path.resolve("tests/fixtures/raw-manufacturing-course");
const metadata = {
  "sop.pdf": {
    sourceClass: "synthetic" as const,
    authority: "LivingCourse fixture generator",
    version: "2.0",
    effectiveDate: "2026-09-01"
  }
};
const discovered = await discoverDocumentInputs(fixtureRoot, metadata);
const input = discovered.find((document) => document.originalName === "sop.pdf");
if (!input) throw new Error("LC-MINERU-CLOUD-SMOKE-001: synthetic sop.pdf fixture was not discovered.");
const rediscovered = (await discoverDocumentInputs(fixtureRoot, metadata)).find((document) => document.originalName === "sop.pdf");
if (rediscovered?.materialId !== input.materialId) throw new Error("LC-MINERU-CLOUD-SMOKE-002: material id is not stable.");

const provider = new MineruCloudProvider();
const health = await provider.health();
if (health.status !== "available") throw new Error(`LC-MINERU-CLOUD-SMOKE-003: ${health.detail}`);
const result = await provider.parse({ input, profile: "balanced", parsedAt: new Date().toISOString() });
const validation = validateMaterialIR(result.materialIr);
if (!validation.valid) throw new Error("LC-MINERU-CLOUD-SMOKE-004: normalized MaterialIR is invalid.");
const blocks = result.materialIr.units.flatMap((unit) => unit.blocks);
if (result.materialIr.units.length === 0 || blocks.length === 0) throw new Error("LC-MINERU-CLOUD-SMOKE-005: normalized result contains no units or blocks.");
if (blocks.some((block) => !block.location.unitId || block.location.unitIndex < 0)) throw new Error("LC-MINERU-CLOUD-SMOKE-006: a block has no valid Evidence location.");
const knownText = blocks.map((block) => block.content.replace(/\s+/gu, " ")).some((content) => content.includes("Synthetic training pressure setting = B"));
if (!knownText) throw new Error("LC-MINERU-CLOUD-SMOKE-007: known synthetic fixture text was not extracted.");
if (result.materialIr.provenance.provider !== "mineru-cloud"
  || result.materialIr.provenance.processingMode !== "remote"
  || result.materialIr.provenance.endpointClassification !== "public_remote") {
  throw new Error("LC-MINERU-CLOUD-SMOKE-008: cloud provenance is incorrect.");
}

console.log(JSON.stringify({
  result: "PASS",
  provider: "mineru-cloud",
  transport: MINERU_CLOUD_TRANSPORT_VERSION,
  sourceSha256: input.sha256,
  materialIrHash: materialIrContentHash(result.materialIr),
  blockCount: blocks.length,
  unitCount: result.materialIr.units.length,
  durationMs: Date.now() - startedAt,
  knownFixtureTextExtracted: true
}, null, 2));
