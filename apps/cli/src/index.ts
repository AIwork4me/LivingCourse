#!/usr/bin/env node
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { applyCourseSpecChangeSet, buildDependencyGraph, planImpact } from "@livingcourse/compiler";
import { validateCourseSpec, type CourseSpec } from "@livingcourse/core";
import {
  diffCourseDocuments,
  executeBuild,
  planBuild,
  recordReviewDecision,
  runDoctor,
  scanPublicPackage,
  validateProductionRelease,
  WorkflowError
} from "@livingcourse/workflow";

const program = new Command();

const loadJson = async <T>(target: string): Promise<T> => JSON.parse(await readFile(path.resolve(target), "utf8")) as T;
const print = (value: unknown): void => console.log(JSON.stringify(value, null, 2));

program.name("livingcourse").description("Compile maintainable training assets from an approved CourseSpec.").version("0.2.0");

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
  else if (error instanceof Error) print({ code: "LC-UNKNOWN-001", whatHappened: error.message, why: "Unexpected failure.", canAutoFix: false, userAction: "Inspect the input and retry.", retryRequiresAi: false });
  process.exitCode = 1;
});
