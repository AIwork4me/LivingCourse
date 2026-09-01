import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildCourseSpecCandidate,
  detectKnowledgeConflicts,
  extractKnowledgeCandidates,
  findAuthorityGaps,
  renderCourseReviewPackage,
  resolveGrounding,
  type CourseSpecCandidate
} from "@livingcourse/generation";
import { executeIntake, planIntake, type IntakeExecutionResult, type IntakePlanResult, type IntakeWorkflowOptions } from "./intake.js";

export interface CreatePlanResult {
  intake: IntakePlanResult;
  aiCallPlan: { knowledgeUnderstanding: number; courseDesign: number; total: number };
  blockers: string[];
}

export interface CreateExecutionResult {
  intake: IntakeExecutionResult;
  candidate: CourseSpecCandidate;
  candidatePath: string;
  reviewPackagePath: string;
  aiCalls: 0;
  manualPromptCount: 0;
  manualJsonEditCount: 0;
}

export interface CreateWorkflowOptions extends IntakeWorkflowOptions {
  title?: string;
  audience?: string;
  purpose?: string;
  locale?: string;
  outputRoot?: string;
}

export const planCreate = async (folder: string, options: CreateWorkflowOptions = {}): Promise<CreatePlanResult> => {
  const intake = await planIntake(folder, options);
  return { intake, aiCallPlan: { knowledgeUnderstanding: 0, courseDesign: 0, total: 0 }, blockers: [...intake.blockers] };
};

export const executeCreate = async (folder: string, options: CreateWorkflowOptions = {}): Promise<CreateExecutionResult> => {
  const intake = await executeIntake(folder, options);
  const conflictAnalysis = detectKnowledgeConflicts(extractKnowledgeCandidates(intake.materials), intake.materials);
  const grounding = resolveGrounding(conflictAnalysis.candidates, intake.materials);
  const candidate = buildCourseSpecCandidate({
    title: options.title ?? path.basename(path.resolve(folder)),
    audience: options.audience ?? "Course audience to confirm during author review",
    purpose: options.purpose ?? "Convert the supplied materials into a reviewable course plan",
    ...(options.locale === undefined ? {} : { locale: options.locale }),
    materials: intake.materials,
    knowledgeCandidates: grounding.candidates,
    conflicts: conflictAnalysis.conflicts,
    groundingRequirements: grounding.requirements,
    groundingGaps: grounding.gaps,
    authorityGaps: findAuthorityGaps(intake.materials)
  });
  const outputRoot = path.resolve(options.outputRoot ?? path.join(options.workspaceRoot ?? process.cwd(), ".livingcourse", "review", candidate.id));
  await mkdir(outputRoot, { recursive: true });
  const candidatePath = path.join(outputRoot, "course-spec-candidate.json");
  const reviewPackagePath = path.join(outputRoot, "COURSE-REVIEW.md");
  await writeFile(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  await writeFile(reviewPackagePath, renderCourseReviewPackage(candidate), "utf8");
  return { intake, candidate, candidatePath, reviewPackagePath, aiCalls: 0, manualPromptCount: 0, manualJsonEditCount: 0 };
};
