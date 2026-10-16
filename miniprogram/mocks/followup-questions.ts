import type { FollowupQuestion } from "../models/frontend";
import { backendContent } from "../config/backend-content";
// Two fixed demo selections from B's 12-question bank, not AI inference.
export const followupQuestions: FollowupQuestion[] = backendContent.followups
  .slice(0, 2)
  .map((question, index) => ({
    localId: "ui-followup-" + (index + 1),
    title: question.questionText,
    dimensionLabel: "信息提炼",
    prompt:
      "可以结合课程、小组作业、社团或生活经历回答；没有相关经历，也可以说明你会怎么做。建议 50～200 字，最多 800 字。",
  }));
