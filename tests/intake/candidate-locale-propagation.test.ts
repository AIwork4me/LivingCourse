import { describe, expect, it } from "vitest";
import {
  buildCourseSpecCandidate,
  renderCourseReviewPackage,
  resolveKnowledgeDrafts,
  type CoursePlanDraft
} from "@livingcourse/generation";
import { makeMaterial } from "./semantic-test-helpers.js";

describe("candidate locale propagation", () => {
  it("uses the requested locale for narration and composes narration only from linked candidates", () => {
    const material = makeMaterial({ id: "zh-safety", blocks: [{ content: "进入训练区前必须佩戴护目镜。" }] });
    const block = material.units[0]?.blocks[0];
    const [knowledge] = resolveKnowledgeDrafts([{
      claim: "进入训练区前必须佩戴护目镜。",
      category: "safety",
      sourceHints: [{ materialId: material.material.id, blockId: block!.id }],
      confidence: 0.9
    }], [material]);
    const coursePlan: CoursePlanDraft = {
      title: "合成设备入门",
      learningObjectives: ["识别进入训练区前的防护要求"],
      slides: [{
        title: "进入前完成防护",
        purpose: "帮助员工识别进入训练区前的防护要求。",
        candidateIds: [knowledge!.id],
        proposedSlideType: "safety_focus",
        narrationDraft: "这段由课程设计模型写出的额外事实绝不能进入旁白。"
      }]
    };

    const candidate = buildCourseSpecCandidate({
      title: coursePlan.title,
      audience: "新员工",
      purpose: "安全入门培训",
      locale: "zh-CN",
      materials: [material],
      knowledgeCandidates: [knowledge!],
      conflicts: [],
      groundingRequirements: [],
      groundingGaps: [],
      authorityGaps: [],
      coursePlan
    });

    expect(candidate.draft.slides[0]?.narration).toMatchObject({ language: "zh-CN", script: knowledge!.claim });
    expect(candidate.draft.slides[0]?.narration.script).not.toContain("额外事实");
    expect(renderCourseReviewPackage(candidate)).toContain("# 课程审核包");
  });
});
