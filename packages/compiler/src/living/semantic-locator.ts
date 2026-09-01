import type { CourseSpec } from "@livingcourse/core";
import type { ChangeSet } from "./change-set.js";

export interface KnowledgeItemTextLocator {
  slideId: string;
  section: "knowledge";
  itemId: string;
  field: "text";
}

export interface SemanticReplaceRequest {
  id: string;
  locator: KnowledgeItemTextLocator;
  old: string;
  new: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
}

export class SemanticLocatorError extends Error {
  override readonly name = "SemanticLocatorError";

  constructor(readonly code: "LC-LOCATOR-001" | "LC-LOCATOR-002" | "LC-LOCATOR-003", message: string) {
    super(message);
  }
}

export const resolveKnowledgeItemTextLocator = (
  course: CourseSpec,
  locator: KnowledgeItemTextLocator
): string => {
  const slideMatches = course.slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide }) => slide.id === locator.slideId);

  if (slideMatches.length === 0) {
    throw new SemanticLocatorError("LC-LOCATOR-001", `Slide '${locator.slideId}' does not exist.`);
  }
  if (slideMatches.length > 1) {
    throw new SemanticLocatorError("LC-LOCATOR-003", `Slide '${locator.slideId}' is ambiguous.`);
  }

  const slideMatch = slideMatches[0];
  if (slideMatch === undefined) {
    throw new SemanticLocatorError("LC-LOCATOR-001", `Slide '${locator.slideId}' does not exist.`);
  }
  const itemMatches = slideMatch.slide.knowledge.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.id === locator.itemId);

  if (itemMatches.length === 0) {
    throw new SemanticLocatorError(
      "LC-LOCATOR-002",
      `Knowledge item '${locator.itemId}' does not exist on slide '${locator.slideId}'.`
    );
  }
  if (itemMatches.length > 1) {
    throw new SemanticLocatorError(
      "LC-LOCATOR-003",
      `Knowledge item '${locator.itemId}' is ambiguous on slide '${locator.slideId}'.`
    );
  }

  const itemMatch = itemMatches[0];
  if (itemMatch === undefined) {
    throw new SemanticLocatorError(
      "LC-LOCATOR-002",
      `Knowledge item '${locator.itemId}' does not exist on slide '${locator.slideId}'.`
    );
  }
  return `/slides/${slideMatch.index}/knowledge/items/${itemMatch.index}/${locator.field}`;
};

export const createSemanticReplaceChangeSet = (
  course: CourseSpec,
  request: SemanticReplaceRequest
): ChangeSet => ({
  id: request.id,
  operations: [{
    op: "replace",
    path: resolveKnowledgeItemTextLocator(course, request.locator),
    old: request.old,
    new: request.new
  }],
  reason: request.reason,
  requestedBy: request.requestedBy,
  requestedAt: request.requestedAt
});
