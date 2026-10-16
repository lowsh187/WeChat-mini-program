import { backendContent } from "../config/backend-content";
import type { BaseQuestion, Choice } from "../models/frontend";

// Text and local UI IDs are drafts. No dimension mapping, points or weights.
export const currentStates: Choice[] = [
  { id: "ui-student", label: "在校探索" },
  { id: "ui-internship", label: "准备实习" },
  { id: "ui-graduate", label: "准备求职" },
];
export const goals: Choice[] = [
  { id: "ui-discover", label: "认识不同岗位" },
  { id: "ui-try", label: "找到想体验的方向" },
  { id: "ui-action", label: "明确下一步行动" },
];
export const preferences: Choice[] = [
  { id: "ui-facts", label: "从事实和材料入手" },
  { id: "ui-people", label: "从人的需求入手" },
  { id: "ui-practice", label: "从动手尝试入手" },
  { id: "ui-unsure", label: "还不确定，想先体验" },
];

export const baseQuestions: BaseQuestion[] = backendContent.questions.map((question) => ({
  ...question,
  options: question.options.map((option) => ({ ...option })),
}));
