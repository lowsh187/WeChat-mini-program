// Production builds use the cloud path. Mock scenarios remain available only for
// explicit preview/testing flows and when the WeChat cloud API is unavailable.
export const runtime = { mode: "cloud" as const, mockDelayMs: 350 };
export const MOCK_NOTICE = "Mock 演示数据，非真实 AI 评估";
export const CLOUD_NOTICE = "云端 AI 辅助结果，仅供职业探索参考，不构成专业测评或就业结论";
