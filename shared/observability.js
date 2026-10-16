const DEFAULT_FUNNEL = [
  "session.created",
  "profile.completed",
  "recommendation.viewed",
  "trial.started",
  "trial.completed",
  "plan.viewed",
];

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function percentile(sortedValues, percentileValue) {
  if (sortedValues.length === 0) return null;
  const index = Math.ceil((percentileValue / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

function normalizeDate(value, field) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} 不是有效时间。`);
  return date;
}

function filterWindow(records, start, end) {
  return records.filter((record) => {
    const createdAt = normalizeDate(record.createdAt, "createdAt");
    return createdAt >= start && createdAt < end;
  });
}

function validateInputs({ events, feedback, windowStart, windowEnd, funnelStages }) {
  if (!Array.isArray(events) || !Array.isArray(feedback)) {
    throw new TypeError("events 和 feedback 必须是数组。不能用缺失数据代替零。 ");
  }
  const start = normalizeDate(windowStart, "windowStart");
  const end = normalizeDate(windowEnd, "windowEnd");
  if (start >= end) throw new TypeError("统计窗口结束时间必须晚于开始时间。");
  if (
    !Array.isArray(funnelStages) ||
    funnelStages.length < 2 ||
    new Set(funnelStages).size !== funnelStages.length ||
    funnelStages.some((stage) => typeof stage !== "string" || stage.length === 0)
  ) {
    throw new TypeError("漏斗必须包含至少两个不重复事件名称。");
  }
  return { start, end };
}

function buildStabilitySummary({
  events,
  feedback,
  windowStart,
  windowEnd,
  funnelStages = DEFAULT_FUNNEL,
}) {
  const { start, end } = validateInputs({
    events,
    feedback,
    windowStart,
    windowEnd,
    funnelStages,
  });
  const rawWindowEvents = filterWindow(events, start, end);
  const rawWindowFeedback = filterWindow(feedback, start, end);
  const windowEvents = rawWindowEvents.filter(
    (event) =>
      typeof event.sessionId === "string" &&
      event.sessionId.length > 0 &&
      typeof event.eventName === "string" &&
      event.eventName.length > 0 &&
      (event.durationMs === undefined ||
        (Number.isFinite(event.durationMs) && event.durationMs >= 0)),
  );
  const windowFeedback = rawWindowFeedback.filter(
    (item) =>
      typeof item.sessionId === "string" &&
      item.sessionId.length > 0 &&
      Number.isInteger(item.helpfulness) &&
      item.helpfulness >= 1 &&
      item.helpfulness <= 5,
  );
  const sessionIds = new Set(windowEvents.map((event) => event.sessionId).filter(Boolean));
  const errors = windowEvents.filter((event) => event.eventName.startsWith("error."));
  const degraded = windowEvents.filter((event) => event.eventName.startsWith("degraded."));
  const durations = windowEvents
    .map((event) => event.durationMs)
    .filter((duration) => Number.isFinite(duration) && duration >= 0)
    .sort((left, right) => left - right);
  let cumulativeFunnelSessions = null;
  const funnel = funnelStages.map((eventName, index) => {
    const stageSessions = new Set(
      windowEvents
        .filter((event) => event.eventName === eventName)
        .map((event) => event.sessionId)
        .filter(Boolean),
    );
    const previousCount = cumulativeFunnelSessions?.size ?? stageSessions.size;
    cumulativeFunnelSessions =
      cumulativeFunnelSessions === null
        ? stageSessions
        : new Set(
            [...cumulativeFunnelSessions].filter((sessionId) => stageSessions.has(sessionId)),
          );
    return {
      eventName,
      sessions: cumulativeFunnelSessions.size,
      conversionFromPrevious:
        index === 0 || previousCount === 0
          ? null
          : round(cumulativeFunnelSessions.size / previousCount, 4),
    };
  });
  const helpfulnessValues = windowFeedback.map((item) => item.helpfulness);

  return {
    evidenceStatus:
      windowEvents.length === 0 && windowFeedback.length === 0 ? "insufficient_data" : "observed",
    window: { start: start.toISOString(), end: end.toISOString() },
    sample: {
      anonymousSessions: sessionIds.size,
      events: windowEvents.length,
      feedback: helpfulnessValues.length,
    },
    dataQuality: {
      invalidEventsExcluded: rawWindowEvents.length - windowEvents.length,
      invalidFeedbackExcluded: rawWindowFeedback.length - windowFeedback.length,
    },
    reliability: {
      errors: errors.length,
      errorRate: windowEvents.length === 0 ? null : round(errors.length / windowEvents.length, 4),
      degraded: degraded.length,
      degradationRate:
        windowEvents.length === 0 ? null : round(degraded.length / windowEvents.length, 4),
    },
    latencyMs: {
      samples: durations.length,
      mean:
        durations.length === 0
          ? null
          : round(durations.reduce((sum, value) => sum + value, 0) / durations.length, 1),
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      max: durations.at(-1) ?? null,
    },
    funnel,
    completionRate:
      funnel[0].sessions === 0
        ? null
        : round(funnel[funnel.length - 1].sessions / funnel[0].sessions, 4),
    feedback: {
      averageHelpfulness:
        helpfulnessValues.length === 0
          ? null
          : round(
              helpfulnessValues.reduce((sum, value) => sum + value, 0) / helpfulnessValues.length,
              2,
            ),
      distribution: Object.fromEntries(
        [1, 2, 3, 4, 5].map((score) => [
          score,
          helpfulnessValues.filter((value) => value === score).length,
        ]),
      ),
    },
    cautions: [
      "所有指标仅描述当前匿名样本，不能外推为总体效果。",
      "样本量和统计窗口必须与指标一起披露。",
      "errorRate 和 degradationRate 的分母是有效匿名埋点事件数，不是云函数调用次数。",
      "insufficient_data 或 null 不得改写成 0、100% 或成功。",
    ],
  };
}

module.exports = { DEFAULT_FUNNEL, buildStabilitySummary, percentile };
