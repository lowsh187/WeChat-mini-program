import { MOCK_NOTICE } from '../config/runtime';
import { InitialRecommendationView } from '../models/frontend';
import { roles } from './roles';

export function createMockRecommendation(): InitialRecommendationView {
  return {
    source: 'mock', notice: MOCK_NOTICE,
    cards: [
      { ...roles[0], exampleReason: '演示依据：在工作材料中定位异常，并说明还需补充哪些数据。此文案不是对你答案的评价。', focusDimensions: ['信息提炼', '逻辑分析', '表达沟通'] },
      { ...roles[2], exampleReason: '演示依据：从访谈片段中归纳需求，区分事实与假设。此文案不是对你答案的评价。', focusDimensions: ['用户洞察', '信息提炼', '表达沟通'] },
      { ...roles[1], exampleReason: '演示依据：结合反馈安排一个可验证的小行动。此文案不是对你答案的评价。', focusDimensions: ['用户洞察', '执行规划', '创意发散'] },
    ],
  };
}
