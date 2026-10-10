import { FollowupQuestion } from '../models/frontend';
// Fixed frontend demo sequence, NOT AI selection or frozen question IDs.
export const followupQuestions: FollowupQuestion[] = [
  { localId: 'ui-followup-1', title: '说说你如何从材料中发现问题', dimensionLabel: '信息提炼', prompt: '回想一次课程、社团或日常任务：你看到哪些事实？怎样找出值得优先处理的问题？可以写一个小例子，也可以说明暂时没有相关经历。' },
  { localId: 'ui-followup-2', title: '你会如何验证自己的判断？', dimensionLabel: '执行规划', prompt: '如果只有一天时间和少量资源，你会先采取什么行动、向谁了解情况、如何判断行动是否有效？不需要填写姓名或联系方式。' },
];
