import { sha256, type CourseSpec } from "@livingcourse/core";
import type { BuildPlan, BuildPlanItem } from "../types.js";
import type { ChangeSet } from "./change-set.js";
import type { DependencyGraph, DependencyNode } from "./dependency-graph.js";

export interface ImpactAnalysis {
  changeSetId: string;
  changedNodes: DependencyNode[];
  affectedNodes: DependencyNode[];
  unchangedNodes: DependencyNode[];
  buildPlan: BuildPlan;
  unnecessaryRegeneration: number;
}

const planItem = (node: DependencyNode, kind: BuildPlanItem["kind"], reason: string): BuildPlanItem => ({
  id: node.id,
  kind,
  slideId: node.slideId,
  reason,
  fingerprint: node.contentHash
});

const closure = (starts: readonly DependencyNode[], graph: DependencyGraph): Set<string> => {
  const visited = new Set(starts.map((start) => start.id));
  const queue = [...visited];
  while (queue.length) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const graphEdge of graph.edges.filter((candidate) => candidate.from === current)) {
      if (!visited.has(graphEdge.to)) {
        visited.add(graphEdge.to);
        queue.push(graphEdge.to);
      }
    }
  }
  return visited;
};

export const planImpact = (
  oldCourse: CourseSpec,
  newCourse: CourseSpec,
  changeSet: ChangeSet,
  graph: DependencyGraph
): ImpactAnalysis => {
  const changedPaths = new Set(changeSet.operations.map((operation) => operation.path));
  const changedNodes = graph.nodes.filter((candidate) => candidate.path !== null && changedPaths.has(candidate.path));
  if (changedNodes.length !== changeSet.operations.length) {
    throw new Error(`LC-IMPACT-001: ${changeSet.operations.length - changedNodes.length} change operation(s) have no dependency node.`);
  }
  const impactedIds = closure(changedNodes, graph);
  const changedIds = new Set(changedNodes.map((candidate) => candidate.id));
  const affectedNodes = graph.nodes.filter((candidate) => impactedIds.has(candidate.id) && !changedIds.has(candidate.id));
  const unchangedNodes = graph.nodes.filter((candidate) => !impactedIds.has(candidate.id));
  const regenerate = affectedNodes
    .filter((candidate) => candidate.kind === "visual_asset" || candidate.kind === "audio")
    .map((candidate) => planItem(candidate, candidate.kind === "audio" ? "audio" : "visual", "Affected probabilistic artifact must be regenerated."));
  const rebuild = affectedNodes
    .filter((candidate) => ["presentation_text", "timing", "caption", "cue", "presentation_slide", "video_slide", "course_pptx", "course_video"].includes(candidate.kind))
    .map((candidate) => planItem(candidate, candidate.kind === "course_pptx" ? "pptx" : candidate.kind === "course_video" ? "video" : "plan", "Affected deterministic artifact must be rebuilt."));
  const reuse = unchangedNodes
    .filter((candidate) => candidate.kind === "visual_asset" || candidate.kind === "audio")
    .map((candidate) => planItem(candidate, candidate.kind === "audio" ? "audio" : "visual", "Unchanged approved artifact must be reused."));
  const buildPlan: BuildPlan = {
    version: "0.1.0",
    reuse,
    regenerate,
    rebuild,
    blocked: [],
    aiCalls: {
      llm: 0,
      image: regenerate.filter((candidate) => candidate.kind === "visual").length,
      tts: regenerate.filter((candidate) => candidate.kind === "audio").length
    },
    diagnostics: [{
      code: "LC-IMPACT-INFO",
      path: "/",
      message: `Old ${sha256(oldCourse).slice(0, 12)} → new ${sha256(newCourse).slice(0, 12)}; dependency closure contains ${impactedIds.size} nodes.`,
      severity: "warning"
    }]
  };
  return { changeSetId: changeSet.id, changedNodes, affectedNodes, unchangedNodes, buildPlan, unnecessaryRegeneration: 0 };
};
