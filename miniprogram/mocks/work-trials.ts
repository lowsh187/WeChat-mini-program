import type { TrialDefinition, TrialResultView } from "../models/frontend";
import { MOCK_NOTICE } from "../config/runtime";
import { backendContent } from "../config/backend-content";

// All materials are fictional. ui-* IDs and text are frontend content drafts.
// No Rubric or score is defined here; professional review and B confirmation remain pending.
export const workTrials: TrialDefinition[] = [
  {
    source: "mock",
    localId: "ui-trial-data",
    localRoleId: "ui-data",
    roleName: "数据分析",
    durationSeconds: 240,
    scenario:
      "你是校园活动工具的数据分析实习生。负责人看到本周报名下降，请你根据简化数据提出调查方向。",
    materials: [
      { label: "上周", content: "访问 1000 人；开始报名 200 人；完成报名 160 人。" },
      { label: "本周", content: "访问 1000 人；开始报名 210 人；完成报名 84 人。" },
      {
        label: "变更信息",
        content: "周一增加了一个报名必填项，同时调整了推广渠道；暂时没有设备和渠道拆分数据。",
      },
    ],
    fields: [
      {
        localId: "ui-anomaly",
        label: "最明显的异常",
        placeholder: "比较哪个环节发生了变化，引用材料中的事实。",
      },
      {
        localId: "ui-hypothesis",
        label: "可能原因",
        placeholder: "写出可能原因，并区分事实与猜测。",
      },
      {
        localId: "ui-next-data",
        label: "下一步补充什么数据？",
        placeholder: "说明需要什么数据，以及如何验证判断。",
      },
    ],
    supplementaryPrompt: "可选补充：如果只能先检查一组数据，你会选什么？为什么？",
  },
  {
    source: "mock",
    localId: "ui-trial-operations",
    localRoleId: "ui-operations",
    roleName: "产品运营",
    durationSeconds: 240,
    scenario:
      "你负责校园读书活动。200 人看到活动，40 人报名，12 人实际参加。请用有限资源改善下一场体验。",
    materials: [
      { label: "反馈 1", content: "“我看到推文时，报名已经快截止了。”" },
      { label: "反馈 2", content: "“我不知道现场要做什么，担心一个人参加很尴尬。”" },
      { label: "反馈 3", content: "“报名后没收到提醒，当天忘记了。”" },
      {
        label: "三个备选方案",
        content:
          "A 增加海报曝光；B 提前说明现场流程并邀请结伴；C 给已报名者发送活动前提醒。只能先选一个。",
      },
    ],
    fields: [
      {
        localId: "ui-problem",
        label: "主要问题是什么？",
        placeholder: "引用反馈，区分曝光、报名和到场问题。",
      },
      {
        localId: "ui-priority",
        label: "优先执行哪个方案？",
        placeholder: "选择 A/B/C 中一个，说明理由与取舍。",
      },
      {
        localId: "ui-validation",
        label: "如何验证效果？",
        placeholder: "安排一个小行动，并写出观察指标。",
      },
    ],
    supplementaryPrompt: "可选补充：方案实施后仍无改善，你会先向谁了解什么？",
  },
  {
    source: "mock",
    localId: "ui-trial-research",
    localRoleId: "ui-research",
    roleName: "用户研究",
    durationSeconds: 240,
    scenario: "你在调研校园自习室工具。阅读五条访谈片段，为团队归纳需求，并提出一个可验证的问题。",
    materials: [
      { label: "访谈 1", content: "“我走到自习室才发现没座位，只能再去别的楼。”" },
      { label: "访谈 2", content: "“空位显示有延迟，去了不一定能坐下。”" },
      { label: "访谈 3", content: "“我会问刚去过的同学，信息比较新。”" },
      { label: "访谈 4", content: "“如果能知道哪个区域安静，我会少跑几趟。”" },
      { label: "访谈 5", content: "“我不一定要预约，只想出发前心里有数。”" },
    ],
    fields: [
      {
        localId: "ui-needs",
        label: "共同需求",
        placeholder: "归纳一个共同需求，引用具体访谈片段。",
      },
      {
        localId: "ui-facts",
        label: "事实与假设",
        placeholder: "各写一条已知事实和还需验证的假设。",
      },
      {
        localId: "ui-question",
        label: "下一步验证问题",
        placeholder: "提出一个开放、具体且不诱导回答的问题。",
      },
    ],
    supplementaryPrompt: "可选补充：五位同学的反馈可能有哪些局限？你还想了解谁的经历？",
  },
];

// Explicit mapping: B's proposed legacyUiId values do not match A's actual IDs.
const formalTrialIds: Record<string, string> = {
  "ui-trial-data": "trial_data_signup_drop_v1",
  "ui-trial-operations": "trial_operations_reading_event_v1",
  "ui-trial-research": "trial_research_study_room_v1",
};
for (const trial of workTrials) {
  const official = backendContent.trials.find(
    (item) => item.trialId === formalTrialIds[trial.localId],
  );
  if (!official) throw new Error("Missing backend trial display configuration");
  trial.trialId = official.trialId;
  trial.roleId = official.roleId;
  trial.questionIds = official.questions.map((item) => item.questionId);
  trial.fields = official.questions
    .filter((item) => item.required)
    .map((item) => ({
      localId: item.questionId,
      label: item.prompt,
      placeholder: "结合材料回答，区分事实与假设。最多 1200 字。",
    }));
  trial.supplementaryPrompt = official.questions.find((item) => !item.required)?.prompt || "";
}

export function createTrialResult(localTrialId: string): TrialResultView | null {
  const trial = workTrials.find((item) => item.localId === localTrialId);
  if (!trial) return null;
  const examples: Record<string, { answer: string; evidence: TrialResultView["evidence"] }> = {
    "ui-trial-data": {
      answer:
        "示例作答：访问持平，开始报名略增，但完成报名从 160 降到 84；先调查开始到完成之间的流失。新增必填项只是候选原因，需按设备、渠道和步骤拆分验证。",
      evidence: [
        {
          dimensionLabel: "信息提炼",
          exampleEvidence: "示例回答指出访问持平、完成报名下降，定位了报名后段。",
          examplePerformance: "示例表现：引用了相关事实。",
          improvement: "进一步比较各环节转化，避免只看总人数。",
        },
        {
          dimensionLabel: "逻辑分析",
          exampleEvidence: "示例回答将新增字段称为候选原因，并提出按设备与渠道拆分。",
          examplePerformance: "示例表现：区分事实与待验证原因。",
          improvement: "补充字段报错与加载耗时，排查其他解释。",
        },
      ],
    },
    "ui-trial-operations": {
      answer:
        "示例作答：反馈显示报名后缺少提醒可能影响到场。先试 C，对已报名者发送流程与时间提醒，比较到场率；当前样本不足以断定提醒是唯一原因。",
      evidence: [
        {
          dimensionLabel: "用户洞察",
          exampleEvidence: "示例回答引用“当天忘记了”，区分报名与到场环节。",
          examplePerformance: "示例表现：把用户反馈与具体环节联系起来。",
          improvement: "同时了解对流程与结伴的顾虑，避免忽略其他反馈。",
        },
        {
          dimensionLabel: "执行规划",
          exampleEvidence: "示例回答明确给谁发提醒，并提出比较到场率。",
          examplePerformance: "示例表现：行动与验证方式相连。",
          improvement: "补充发送时间与可比活动，降低样本差异影响。",
        },
      ],
    },
    "ui-trial-research": {
      answer:
        "示例作答：共同需求是出发前获得可信的座位与环境信息。事实是有人到场后找不到座位；“需要预约”是待验证假设。下一问：最近一次找自习位置时，你怎样决定去哪里？",
      evidence: [
        {
          dimensionLabel: "用户洞察",
          exampleEvidence: "示例回答从跑空与问同学的片段归纳出对可信信息的需求。",
          examplePerformance: "示例表现：没有直接把需求等同于预约功能。",
          improvement: "分别了解时间、座位和安静程度的优先级。",
        },
        {
          dimensionLabel: "表达沟通",
          exampleEvidence: "示例回答分开陈述事实、假设与开放问题。",
          examplePerformance: "示例表现：说明结构清楚，问题不预设结论。",
          improvement: "注明片段来源，扩大样本后再验证共性。",
        },
      ],
    },
  };
  const example = examples[localTrialId];
  if (!example) return null;
  return {
    source: "mock",
    localTrialId,
    roleName: trial.roleName,
    notice: MOCK_NOTICE,
    exampleAnswer: example.answer,
    evidence: example.evidence.map((item) => ({ ...item })),
  };
}
