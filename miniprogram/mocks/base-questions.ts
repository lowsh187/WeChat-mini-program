import { BaseQuestion, Choice } from '../models/frontend';

// Text and local UI IDs are drafts. No dimension mapping, points or weights.
export const currentStates: Choice[] = [
  { id: 'ui-student', label: '在校探索' },
  { id: 'ui-internship', label: '准备实习' },
  { id: 'ui-graduate', label: '准备求职' },
];
export const goals: Choice[] = [
  { id: 'ui-discover', label: '认识不同岗位' },
  { id: 'ui-try', label: '找到想体验的方向' },
  { id: 'ui-action', label: '明确下一步行动' },
];
export const preferences: Choice[] = [
  { id: 'ui-facts', label: '从事实和材料入手' },
  { id: 'ui-people', label: '从人的需求入手' },
  { id: 'ui-practice', label: '从动手尝试入手' },
  { id: 'ui-unsure', label: '还不确定，想先体验' },
];

export const baseQuestions: BaseQuestion[] = [
  { id: 'ui-q1', title: '面对一堆活动反馈，你会先做什么？', context: '社团活动结束，群里有几十条意见，明天需要给出复盘。', options: [
    { id: 'a', label: '整理反复出现的问题与事实' },
    { id: 'b', label: '找几位参与者聊聊具体经历' },
    { id: 'c', label: '先列出可以立即改进的行动' },
  ] },
  { id: 'ui-q2', title: '报名人数突然下降，你会怎么开始调查？', context: '本周报名比上周少，但推广和活动内容都做过调整。', options: [
    { id: 'a', label: '按渠道和时间拆开比较数据' },
    { id: 'b', label: '询问没报名的人在顾虑什么' },
    { id: 'c', label: '小范围试两种推广方式再观察' },
  ] },
  { id: 'ui-q3', title: '有人说“这个功能不好用”，你会怎么回应？', context: '你帮团队收集同学使用校园工具的意见。', options: [
    { id: 'a', label: '请对方描述上一次使用的具体过程' },
    { id: 'b', label: '整理现有反馈，寻找共同问题' },
    { id: 'c', label: '画一个改进方案，请对方试着理解' },
  ] },
  { id: 'ui-q4', title: '只有一分钟介绍方案，你会怎样表达？', context: '小组讨论时间快结束，需要让大家理解你的提议。', options: [
    { id: 'a', label: '先讲结论，再用两条依据说明' },
    { id: 'b', label: '用一个具体故事说明问题与改变' },
    { id: 'c', label: '列出实施步骤和需要的支持' },
  ] },
  { id: 'ui-q5', title: '任务临近截止，有一环卡住了，你会先做什么？', context: '三人小组要交作品，其中一份材料还没拿到。', options: [
    { id: 'a', label: '确定材料影响哪些任务，重新安排顺序' },
    { id: 'b', label: '和相关同学沟通阻塞原因与可用帮助' },
    { id: 'c', label: '找替代材料，先做一个能交付的版本' },
  ] },
  { id: 'ui-q6', title: '为校园活动想一个新点子，你更愿意怎么做？', context: '预算有限，希望让第一次参加的同学也愿意加入。', options: [
    { id: 'a', label: '提出几种不同形式，比较各自可行性' },
    { id: 'b', label: '先了解新同学最期待和最担心什么' },
    { id: 'c', label: '参考以往活动，改进一个具体环节' },
  ] },
  { id: 'ui-q7', title: '四个需求只能先做一个，你会怎么取舍？', context: '团队本周时间有限，每位同学都有想实现的功能。', options: [
    { id: 'a', label: '比较影响人数、价值与实现成本' },
    { id: 'b', label: '先验证哪个问题最影响实际使用' },
    { id: 'c', label: '选一个能快速完成并收集反馈的需求' },
  ] },
  { id: 'ui-q8', title: '尝试一个陌生岗位，你希望先做哪一步？', context: '你有一周时间探索方向，暂时不需要作出职业决定。', options: [
    { id: 'a', label: '看真实工作样例，整理需要的能力' },
    { id: 'b', label: '访谈从业者，了解一天如何度过' },
    { id: 'c', label: '完成一个小任务，再复盘自己的体验' },
  ] },
];
