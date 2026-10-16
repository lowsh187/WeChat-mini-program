import type { TrackEventRequestV2 } from "../../shared/contracts.v2";
import type { StorageAdapter } from "../utils/storage";
import { object } from "./cloud-adapter";

const KEY = "pathai.frontend.events.v2";
type EventInput = Omit<TrackEventRequestV2, "eventId">;
const names = [
  "session.created",
  "profile.completed",
  "recommendation.viewed",
  "trial.started",
  "trial.completed",
  "plan.viewed",
];
export function createEventLedger(storage: StorageAdapter) {
  let entries: TrackEventRequestV2[] = [];
  const raw = storage.read(KEY);
  if (Array.isArray(raw))
    entries = raw.filter(
      (item: unknown): item is TrackEventRequestV2 =>
        object(item) &&
        typeof item.sessionId === "string" &&
        typeof item.eventId === "string" &&
        names.includes(item.eventName as string) &&
        (item.mode === "mock" || item.mode === "real") &&
        typeof item.step === "string" &&
        (item.trialAttemptId === undefined || typeof item.trialAttemptId === "string") &&
        Object.keys(item).every((key) =>
          [
            "sessionId",
            "eventId",
            "mode",
            "eventName",
            "step",
            "trialAttemptId",
            "resultStatus",
            "durationMs",
          ].includes(key),
        ),
    );
  return {
    enqueue(input: EventInput): TrackEventRequestV2 {
      if (
        !names.includes(input.eventName) ||
        !["mock", "real"].includes(input.mode) ||
        !/^[a-z][a-z0-9_.-]{0,63}$/.test(input.step) ||
        ((input.eventName === "trial.started" || input.eventName === "trial.completed") &&
          !input.trialAttemptId)
      )
        throw new Error("事件字段无效");
      const existing = entries.find(
        (item) =>
          item.sessionId === input.sessionId &&
          item.mode === input.mode &&
          item.eventName === input.eventName &&
          item.trialAttemptId === input.trialAttemptId,
      );
      if (existing) return { ...existing };
      // Copy an allowlist only. Never persist profile, answer text or unknown properties.
      const event: TrackEventRequestV2 = {
        sessionId: input.sessionId,
        eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        mode: input.mode,
        eventName: input.eventName,
        step: input.step,
        ...(input.trialAttemptId ? { trialAttemptId: input.trialAttemptId } : {}),
        ...(input.resultStatus ? { resultStatus: input.resultStatus } : {}),
      };
      const next = [...entries, event];
      if (next.length > 100) throw new Error("本地事件草稿已满，请清除本地体验记录后重试");
      storage.write(KEY, next);
      entries = next;
      return { ...event };
    },
    snapshot() {
      return entries.map((event) => ({ ...event }));
    },
  };
}
