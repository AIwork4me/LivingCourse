#!/usr/bin/env node
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { applyCourseSpecChangeSet, buildDependencyGraph, planImpact } from "@livingcourse/compiler";
import { validateCourseSpec, type CourseSpec } from "@livingcourse/core";
import {
  diffCourseDocuments,
  executeCreate,
  executeBuild,
  executeIntake,
  planBuild,
  planCreate,
  recordReviewDecision,
  resolveSemanticCapabilitiesFromEnv,
  runDoctor,
  scanPublicPackage,
  validateProductionRelease,
  WorkflowError
} from "@livingcourse/workflow";

const program = new Command();

const loadJson = async <T>(target: string): Promise<T> => JSON.parse(await readFile(path.resolve(target), "utf8")) as T;
const print = (value: unknown): void => console.log(JSON.stringify(value, null, 2));

program.name("livingcourse").description("Turn raw enterprise materials into reviewable, maintainable training assets.").version("0.3.3");

const discloseRemoteParser = (): void => {
  if (process.env.LIVINGCOURSE_DOCUMENT_PROVIDER === "mineru-cloud") {
    console.error("This parser processes source files on a remote service.");
  }
};

program.command("doctor")
  .option("--generation-required", "Require provider configuration and credentials")
  .action(async (options: { generationRequired?: boolean }) => {
    const report = await runDoctor({ workspaceRoot: process.cwd(), generationRequired: options.generationRequired ?? false });
    print(report);
    if (report.status === "FAIL") process.exitCode = 1;
  });

program.command("validate")
  .argument("<course>")
  .action(async (coursePath: string) => {
    const result = validateCourseSpec(await loadJson<unknown>(coursePath));
    print(result);
    if (!result.valid) process.exitCode = 1;
  });

program.command("intake")
  .argument("<folder>")
  .option("--profile <profile>", "balanced or high_fidelity", "balanced")
  .action(async (folder: string, options: { profile: "balanced" | "high_fidelity" }) => {
    discloseRemoteParser();
    const result = await executeIntake(folder, { workspaceRoot: process.cwd(), profile: options.profile });
    print({
      materialInventory: result.plan.files.map((item) => ({ file: item.input.originalName, mediaType: item.input.mediaType, sha256: item.input.sha256, parser: item.parser, profile: item.profile, status: item.action, processingMode: item.processingMode, endpointClassification: item.endpointClassification })),
      parseStatus: { parserCalls: result.parserCalls, materialRegenerations: result.materialRegenerations, reused: result.reused, parsed: result.parsed },
      materialIr: result.materials,
      diagnostics: result.diagnostics
    });
  });

program.command("create")
  .argument("<folder>")
  .option("--dry-run", "Show files, parser plan, AI call plan, and blockers before any parser or AI call")
  .option("--profile <profile>", "balanced or high_fidelity", "balanced")
  .option("--title <title>")
  .option("--audience <audience>")
  .option("--purpose <purpose>")
  .option("--locale <locale>", "Course and narration locale", "en")
  .action(async (folder: string, options: { dryRun?: boolean; profile: "balanced" | "high_fidelity"; title?: string; audience?: string; purpose?: string; locale: string }) => {
    discloseRemoteParser();
    const semantic = await resolveSemanticCapabilitiesFromEnv();
    const common = {
      workspaceRoot: process.cwd(),
      profile: options.profile,
      locale: options.locale,
      knowledgeUnderstanding: semantic.knowledgeUnderstanding,
      courseDesign: semantic.courseDesign,
      semanticProcessing: { mode: semantic.disclosure.processingMode, provider: semantic.disclosure.provider, model: semantic.disclosure.model },
      ...(options.title === undefined ? {} : { title: options.title }),
      ...(options.audience === undefined ? {} : { audience: options.audience }),
      ...(options.purpose === undefined ? {} : { purpose: options.purpose })
    };
    if (options.dryRun) {
      const result = await planCreate(folder, common);
      print({
        FILES: { detected: result.intake.files.length, inventory: result.intake.files.map((item) => ({ file: item.input.originalName, mediaType: item.input.mediaType })) },
        PARSING: result.intake.files.map((item) => ({ file: item.input.originalName, parser: item.parser, profile: item.profile, potentialEscalation: item.potentialEscalation, processingMode: item.processingMode, endpointClassification: item.endpointClassification, confidentialityWarning: item.confidentialityWarning, plannedAction: item.action })),
        SEMANTIC_AUTHORING: {
          status: semantic.disclosure.status,
          mode: semantic.disclosure.mode,
          provider: semantic.disclosure.provider,
          model: semantic.disclosure.model,
          processingMode: semantic.disclosure.processingMode,
          fallback: semantic.disclosure.fallback,
          note: semantic.disclosure.status === "NOT_CONFIGURED" ? "Course creation remains available, but semantic authoring quality is limited." : null,
          knowledgeUnderstanding: { changedMaterials: result.semantic.changedMaterials, reusedMaterials: result.semantic.reusedMaterials, predictedAiCalls: result.semantic.knowledgeUnderstandingCalls },
          courseDesign: { predictedAiCalls: result.semantic.courseDesignCalls },
          totalPredictedAiCalls: result.aiCallPlan.total
        },
        KNOWLEDGE_UNDERSTANDING: { status: semantic.disclosure.status, mode: result.semantic.understandingMode, provider: semantic.disclosure.provider, model: semantic.disclosure.model, processingMode: semantic.disclosure.processingMode, fallback: semantic.disclosure.fallback, changedMaterials: result.semantic.changedMaterials, reusedMaterials: result.semantic.reusedMaterials, predictedAiCalls: result.semantic.knowledgeUnderstandingCalls },
        COURSE_DESIGN: { status: semantic.disclosure.status, mode: semantic.disclosure.mode, provider: semantic.disclosure.provider, model: semantic.disclosure.model, processingMode: semantic.disclosure.processingMode, fallback: semantic.disclosure.fallback, predictedAiCalls: result.semantic.courseDesignCalls },
        AI_CALL_PLAN: result.aiCallPlan,
        BLOCKERS: result.blockers,
        callsMade: { parser: result.intake.parserCalls, ai: result.intake.aiCalls, semanticAi: 0, tts: 0, image: 0 }
      });
      if (result.blockers.length) process.exitCode = 1;
      return;
    }
    if (semantic.disclosure.processingMode === "remote") {
      console.error("Semantic authoring will send parsed source content to a remote model endpoint.");
    }
    const result = await executeCreate(folder, common);
    print({
      status: "AUTHOR_REVIEW_REQUIRED",
      materialCount: result.intake.materials.length,
      parserCalls: result.intake.parserCalls,
      aiCalls: result.aiCalls,
      semantic: result.semantic,
      semanticProvider: semantic.disclosure,
      manualPromptCount: result.manualPromptCount,
      manualJsonEditCount: result.manualJsonEditCount,
      evidenceCoverage: result.candidate.metrics.evidenceCoverage,
      conflicts: result.candidate.conflicts.length,
      groundingGaps: result.candidate.groundingGaps.length,
      candidatePath: result.candidatePath,
      reviewPackagePath: result.reviewPackagePath
    });
  });

program.command("build")
  .argument("<course>")
  .option("--dry-run", "Print REUSE / REGENERATE / REBUILD / BLOCKED before any provider call")
  .option("--output <directory>", "Output directory")
  .action(async (coursePath: string, options: { dryRun?: boolean; output?: string }) => {
    const common = { workspaceRoot: process.cwd(), ...(options.output === undefined ? {} : { outputRoot: options.output }) };
    if (options.dryRun) {
      const plan = await planBuild(coursePath, common);
      print({ runId: plan.runId, REUSE: plan.buildPlan.reuse, REGENERATE: plan.buildPlan.regenerate, REBUILD: plan.buildPlan.rebuild, BLOCKED: plan.buildPlan.blocked, aiCalls: plan.buildPlan.aiCalls, reviewPackage: plan.reviewPackage });
      return;
    }
    print(await executeBuild(coursePath, common));
  });

program.command("diff")
  .argument("<old>")
  .argument("<new>")
  .action(async (oldPath: string, newPath: string) => {
    print(diffCourseDocuments(await loadJson<unknown>(oldPath), await loadJson<unknown>(newPath)));
  });

program.command("update")
  .argument("<course>")
  .requiredOption("--source <new-source>", "A validated replacement CourseSpec produced from the new source")
  .action(async (coursePath: string, options: { source: string }) => {
    const resolved = path.resolve(coursePath);
    const oldCourse = await loadJson<CourseSpec>(resolved);
    const newCourse = await loadJson<CourseSpec>(options.source);
    const change = diffCourseDocuments(oldCourse, newCourse, { id: "source-update", reason: `Diff against ${path.basename(options.source)}` });
    const patched = applyCourseSpecChangeSet(oldCourse, change);
    const impact = planImpact(oldCourse, patched, change, buildDependencyGraph(oldCourse));
    const temporary = `${resolved}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(patched, null, 2)}\n`, "utf8");
    await rename(temporary, resolved);
    print({ changeSet: change, impact });
  });

program.command("release")
  .argument("<course>")
  .action(async (coursePath: string) => {
    const course = await loadJson<CourseSpec>(coursePath);
    const security = await scanPublicPackage(process.cwd());
    const release = validateProductionRelease(course, security);
    print({ release, security: { passed: security.passed, scannedFiles: security.scannedFiles, findings: security.findings } });
    if (!release.valid) process.exitCode = 1;
  });

const review = program.command("review");
review.command("approve")
  .argument("<course>")
  .argument("<gate-id>")
  .requiredOption("--reviewer <name>")
  .option("--production", "Approve for production release")
  .option("--comments <text>", "Review comments")
  .action(async (coursePath: string, gateId: string, options: { reviewer: string; production?: boolean; comments?: string }) => {
    print(await recordReviewDecision({ coursePath, gateId, reviewer: options.reviewer, decision: options.production ? "approved_for_release" : "approved_for_poc_use", scope: options.production ? "production" : "author_review", ...(options.comments === undefined ? {} : { comments: options.comments }) }));
  });
review.command("reject")
  .argument("<course>")
  .argument("<gate-id>")
  .requiredOption("--reviewer <name>")
  .option("--comments <text>", "Review comments")
  .action(async (coursePath: string, gateId: string, options: { reviewer: string; comments?: string }) => {
    print(await recordReviewDecision({ coursePath, gateId, reviewer: options.reviewer, decision: "rejected", scope: "author_review", ...(options.comments === undefined ? {} : { comments: options.comments }) }));
  });

program.parseAsync().catch((error: unknown) => {
  if (error instanceof WorkflowError) print(error.failure);
  else if (error instanceof Error) {
    const errorCode = "code" in error && typeof error.code === "string" && /^LC-[A-Z0-9-]+$/u.test(error.code) ? error.code : "LC-UNKNOWN-001";
    print({
      code: errorCode,
      whatHappened: error.message.replace(new RegExp(`^${errorCode}:\\s*`, "u"), ""),
      why: errorCode.startsWith("LC-SEMANTIC-") ? "Semantic provider configuration or transport failed safely." : "Unexpected failure.",
      canAutoFix: false,
      userAction: errorCode.startsWith("LC-SEMANTIC-") ? "Check the semantic provider environment and endpoint, then retry." : "Inspect the input and retry.",
      retryRequiresAi: errorCode.startsWith("LC-SEMANTIC-TRANSPORT-")
    });
  }
  process.exitCode = 1;
});
