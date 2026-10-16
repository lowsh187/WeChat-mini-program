import assert from "node:assert/strict";
import test from "node:test";

import observability from "../shared/observability.js";

const { buildStabilitySummary, percentile } = observability;
const windowStart = "2026-10-14T00:00:00.000Z";
const windowEnd = "2026-10-15T00:00:00.000Z";
const funnelStages = ["session.created", "trial.completed", "plan.viewed"];

test("summarizes observed anonymous stability evidence", () => {
  const events = [
    ["s1", "session.created", 100],
    ["s2", "session.created", 200],
    ["s1", "trial.completed", 300],
    ["s1", "plan.viewed", 400],
    ["s2", "error.ai_timeout", 500],
    ["s2", "degraded.score_trial", 600],
  ].map(([sessionId, eventName, durationMs]) => ({
    sessionId,
    eventName,
    durationMs,
    createdAt: "2026-10-14T08:00:00.000Z",
  }));
  const feedback = [
    { sessionId: "s1", helpfulness: 5, createdAt: "2026-10-14T09:00:00.000Z" },
    { sessionId: "s2", helpfulness: 3, createdAt: "2026-10-14T09:10:00.000Z" },
  ];
  const result = buildStabilitySummary({ events, feedback, windowStart, windowEnd, funnelStages });

  assert.equal(result.evidenceStatus, "observed");
  assert.equal(result.sample.anonymousSessions, 2);
  assert.equal(result.reliability.errors, 1);
  assert.equal(result.reliability.degraded, 1);
  assert.equal(result.latencyMs.p95, 600);
  assert.equal(result.completionRate, 0.5);
  assert.equal(result.feedback.averageHelpfulness, 4);
  assert.equal(result.dataQuality.invalidEventsExcluded, 0);
});

test("excludes malformed records and keeps funnel conversion monotonic", () => {
  const events = [
    { sessionId: "s1", eventName: "session.created", createdAt: "2026-10-14T08:00:00Z" },
    { sessionId: "s2", eventName: "trial.completed", createdAt: "2026-10-14T08:00:00Z" },
    { sessionId: "", eventName: "error.unknown", createdAt: "2026-10-14T08:00:00Z" },
  ];
  const result = buildStabilitySummary({
    events,
    feedback: [],
    windowStart,
    windowEnd,
    funnelStages,
  });
  assert.equal(result.funnel[0].sessions, 1);
  assert.equal(result.funnel[1].sessions, 0);
  assert.equal(result.dataQuality.invalidEventsExcluded, 1);
});

test("never converts missing evidence into a successful zero metric", () => {
  const result = buildStabilitySummary({
    events: [],
    feedback: [],
    windowStart,
    windowEnd,
    funnelStages,
  });
  assert.equal(result.evidenceStatus, "insufficient_data");
  assert.equal(result.reliability.errorRate, null);
  assert.equal(result.latencyMs.p95, null);
  assert.equal(result.completionRate, null);
  assert.equal(result.feedback.averageHelpfulness, null);
});

test("uses nearest-rank percentiles and validates windows", () => {
  assert.equal(percentile([10, 20, 30, 40], 50), 20);
  assert.equal(percentile([10, 20, 30, 40], 95), 40);
  assert.throws(() =>
    buildStabilitySummary({
      events: [],
      feedback: [],
      windowStart: windowEnd,
      windowEnd: windowStart,
      funnelStages,
    }),
  );
});
