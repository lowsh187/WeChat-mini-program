// Generated from B's current configs. Display-only; no weights, scores or client scoring.
export const backendContent = {
  reviewStatus: "draft_for_joint_review",
  configVersion: "2.0.0",
  questions: [
    {
      id: "base_information_01",
      title: "面对一页包含多条信息的材料时，你通常先做什么？",
      context: "请选择更接近你通常做法的一项。MVP 探索假设，非专业测评。",
      options: [
        {
          id: "a",
          label: "先标记目标、事实和限制",
        },
        {
          id: "b",
          label: "先从头读完再凭印象总结",
        },
        {
          id: "c",
          label: "先找别人给出的结论",
        },
      ],
    },
    {
      id: "base_logic_01",
      title: "两个指标同时下降时，你更可能如何判断原因？",
      context: "请选择更接近你通常做法的一项。MVP 探索假设，非专业测评。",
      options: [
        {
          id: "a",
          label: "列出多个假设并寻找区分它们的证据",
        },
        {
          id: "b",
          label: "选择最直观的原因继续推进",
        },
        {
          id: "c",
          label: "等待更多人给出判断",
        },
      ],
    },
    {
      id: "base_user_01",
      title: "用户说“这个功能不好用”时，你最想先确认什么？",
      context: "请选择更接近你通常做法的一项。MVP 探索假设，非专业测评。",
      options: [
        {
          id: "a",
          label: "具体场景、目标和受阻步骤",
        },
        {
          id: "b",
          label: "用户是否喜欢界面样式",
        },
        {
          id: "c",
          label: "用户是不是操作错误",
        },
      ],
    },
    {
      id: "base_communication_01",
      title: "向团队同步复杂问题时，你更倾向于怎样表达？",
      context: "请选择更接近你通常做法的一项。MVP 探索假设，非专业测评。",
      options: [
        {
          id: "a",
          label: "先给结论，再给证据和下一步",
        },
        {
          id: "b",
          label: "按发现过程逐步叙述",
        },
        {
          id: "c",
          label: "转发全部材料让大家自行判断",
        },
      ],
    },
    {
      id: "base_execution_01",
      title: "收到一个目标模糊且时间有限的任务时，你通常先做什么？",
      context: "请选择更接近你通常做法的一项。MVP 探索假设，非专业测评。",
      options: [
        {
          id: "a",
          label: "确认交付标准并拆出优先步骤",
        },
        {
          id: "b",
          label: "从自己最熟悉的部分开始",
        },
        {
          id: "c",
          label: "等目标完全明确后再开始",
        },
      ],
    },
    {
      id: "base_creative_01",
      title: "需要为同一目标提出方案时，你通常如何开始？",
      context: "请选择更接近你通常做法的一项。MVP 探索假设，非专业测评。",
      options: [
        {
          id: "a",
          label: "先提出多个差异明显的方向再筛选",
        },
        {
          id: "b",
          label: "优化已有且最稳妥的方案",
        },
        {
          id: "c",
          label: "寻找一个模板直接套用",
        },
      ],
    },
    {
      id: "base_tradeoff_01",
      title: "资源只够完成三个需求中的一个时，你会怎么做？",
      context: "请选择更接近你通常做法的一项。MVP 探索假设，非专业测评。",
      options: [
        {
          id: "a",
          label: "按用户价值、成本和风险排序并说明取舍",
        },
        {
          id: "b",
          label: "优先选择最快完成的需求",
        },
        {
          id: "c",
          label: "由提出需求的人决定",
        },
      ],
    },
    {
      id: "base_evidence_01",
      title: "当自己的判断受到质疑时，你更可能怎样回应？",
      context: "请选择更接近你通常做法的一项。MVP 探索假设，非专业测评。",
      options: [
        {
          id: "a",
          label: "区分事实和假设，并说明还需验证什么",
        },
        {
          id: "b",
          label: "补充更多细节解释原判断",
        },
        {
          id: "c",
          label: "改用多数人的意见",
        },
      ],
    },
  ],
  roles: [
    {
      roleId: "data_analyst",
      name: "数据分析",
      description: "通过数据识别异常、解释原因并支持决策。",
    },
    {
      roleId: "product_operations",
      name: "产品运营",
      description: "围绕用户和业务目标设计并执行运营方案。",
    },
    {
      roleId: "user_researcher",
      name: "用户研究",
      description: "从用户材料中提炼需求、区分事实与假设并设计验证。",
    },
    {
      roleId: "product_manager",
      name: "产品经理",
      description: "在用户价值与有限资源之间排序、取舍并定义最小方案。",
    },
    {
      roleId: "project_manager",
      name: "项目管理",
      description: "识别阻塞、安排顺序并推动团队同步执行。",
    },
    {
      roleId: "content_strategist",
      name: "内容策划",
      description: "理解受众并提出差异化、可落地的内容表达。",
    },
  ],
  trials: [
    {
      trialId: "trial_data_signup_drop_v1",
      roleId: "data_analyst",
      questions: [
        {
          questionId: "data_signup_facts",
          required: true,
          prompt: "请从材料中列出最关键的事实与异常。",
        },
        {
          questionId: "data_signup_hypotheses",
          required: true,
          prompt: "请提出可能原因并说明支持或反对证据。",
        },
        {
          questionId: "data_signup_next_step",
          required: true,
          prompt: "请给出下一步验证方案和判断标准。",
        },
        {
          questionId: "data_signup_summary",
          required: false,
          prompt: "请用三句话向团队总结。",
        },
      ],
      rubricDimensions: ["information_extraction", "logical_analysis", "communication"],
    },
    {
      trialId: "trial_operations_reading_event_v1",
      roleId: "product_operations",
      questions: [
        {
          questionId: "ops_event_goal",
          required: true,
          prompt: "请明确活动目标与目标用户。",
        },
        {
          questionId: "ops_event_plan",
          required: true,
          prompt: "请设计一个可执行的活动方案。",
        },
        {
          questionId: "ops_event_metric",
          required: true,
          prompt: "请定义关键指标和复盘方式。",
        },
        {
          questionId: "ops_event_risk",
          required: false,
          prompt: "请补充一个主要风险及预案。",
        },
      ],
      rubricDimensions: ["user_insight", "execution_planning", "creative_ideation"],
    },
    {
      trialId: "trial_research_study_room_v1",
      roleId: "user_researcher",
      questions: [
        {
          questionId: "research_room_signal",
          required: true,
          prompt: "请区分材料中的事实、观点与未知信息。",
        },
        {
          questionId: "research_room_insight",
          required: true,
          prompt: "请提出一个用户洞察并引用证据。",
        },
        {
          questionId: "research_room_validation",
          required: true,
          prompt: "请设计下一步访谈或验证问题。",
        },
        {
          questionId: "research_room_summary",
          required: false,
          prompt: "请向产品团队简要说明研究结论。",
        },
      ],
      rubricDimensions: ["information_extraction", "user_insight", "communication"],
    },
  ],
  followups: [
    {
      questionId: "followup_information_01",
      dimension: "information_extraction",
      questionText: "请举例说明：面对信息较多的任务时，你会怎样找出最重要的三条信息？",
    },
    {
      questionId: "followup_information_02",
      dimension: "information_extraction",
      questionText: "如果材料里同时存在事实、观点和猜测，你会怎样区分并使用它们？",
    },
    {
      questionId: "followup_logic_01",
      dimension: "logical_analysis",
      questionText: "当两个可能原因都说得通时，你会用什么证据判断哪一个更可信？",
    },
    {
      questionId: "followup_logic_02",
      dimension: "logical_analysis",
      questionText: "请描述一次你发现原先判断有误，并据此调整方案的经历。",
    },
    {
      questionId: "followup_user_01",
      dimension: "user_insight",
      questionText: "当用户表达得很模糊时，你通常如何确认他真正想解决的问题？",
    },
    {
      questionId: "followup_user_02",
      dimension: "user_insight",
      questionText: "如果不同用户提出相反需求，你会怎样决定先验证哪一类需求？",
    },
    {
      questionId: "followup_communication_01",
      dimension: "communication",
      questionText: "请举例说明你会怎样向不了解背景的人解释一个复杂问题。",
    },
    {
      questionId: "followup_communication_02",
      dimension: "communication",
      questionText: "当团队成员不同意你的结论时，你会如何组织下一次沟通？",
    },
    {
      questionId: "followup_execution_01",
      dimension: "execution_planning",
      questionText: "任务时间缩短一半时，你会保留什么、放弃什么，并如何安排顺序？",
    },
    {
      questionId: "followup_execution_02",
      dimension: "execution_planning",
      questionText: "面对一个目标明确但路径未知的任务，你会怎样拆出第一天的行动？",
    },
    {
      questionId: "followup_creative_01",
      dimension: "creative_ideation",
      questionText: "请举例说明你如何在常规方案之外提出一个不同方向。",
    },
    {
      questionId: "followup_creative_02",
      dimension: "creative_ideation",
      questionText: "当第一个创意不可行时，你会用什么方法产生新的备选方案？",
    },
  ],
} as const;
