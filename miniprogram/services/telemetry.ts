import type { FormalEventNameV2 } from "../../shared/contracts.v2";
import { sessionStore } from "../store/session";
import { localStorage } from "../utils/storage";
import { cloudSession } from "./cloud-session";
import { createEventLedger } from "./formal-events";
import { blockUnreleasedV2 } from "./v2-contract";

let active = false;
let localId = "";
let message = "";
export const telemetry = {
  status() {
    return { active, message };
  },
  stop() {
    active = false;
    sessionStore.observeProgress(null);
    message = "匿名事件已关闭。清除本地体验会删除本地事件草稿。";
  },
  record(eventName: FormalEventNameV2, step: string) {
    if (!active) return;
    const credentials = cloudSession.current();
    const session = sessionStore.snapshot().session;
    if (!credentials || !session || session.localId !== localId) {
      this.stop();
      return;
    }
    try {
      const event = createEventLedger(localStorage).enqueue({
        sessionId: credentials.sessionId,
        mode: "mock",
        eventName,
        step,
        ...((eventName === "trial.started" || eventName === "trial.completed") && session.trial
          ? { trialAttemptId: session.trial.trialAttemptId }
          : {}),
      });
      // Do not send v2 events to v1, which would ignore IDs/mode and lose idempotency.
      void blockUnreleasedV2(event);
      message = "已保存最小化 Mock 事件草稿（eventId/mode/试岗尝试），v2 尚未部署，未发送到云端。";
    } catch {
      message = "事件草稿保存失败，不影响答题；可关闭事件记录后重试。";
    }
  },
  start(): boolean {
    const session = sessionStore.snapshot().session;
    if (!cloudSession.current() || !session) {
      message = "请先创建当前体验的匿名联调会话。";
      return false;
    }
    localId = session.localId;
    active = true;
    sessionStore.observeProgress((progress) => {
      if (progress.localId !== localId) {
        this.stop();
        return;
      }
      if (progress.stage === "followup") this.record("profile.completed", "followup");
      if (progress.stage === "work-trial") this.record("trial.started", "work_trial");
      if (progress.stage === "trial-result") this.record("trial.completed", "trial_result");
    });
    this.record("session.created", "session_created");
    return true;
  },
};
