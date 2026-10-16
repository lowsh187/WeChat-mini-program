import type { FormalEventNameV2 } from "../../shared/contracts.v2";
import { sessionStore } from "../store/session";
import { localStorage } from "../utils/storage";
import { cloudSession } from "./cloud-session";
import { createEventLedger } from "./formal-events";
import { cloudAdapter } from "./cloud-adapter";

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
        mode: "real",
        eventName,
        step,
        ...((eventName === "trial.started" || eventName === "trial.completed") && session.trial
          ? { trialAttemptId: session.trial.trialAttemptId }
          : {}),
      });
      void cloudAdapter.trackFormalEvent(event).then((response) => {
        message =
          response.status === "error"
            ? "匿名事件暂未发送成功，已保留相同 eventId 供重试。"
            : "匿名步骤事件已记录；不包含画像或回答正文。";
      });
      message = "匿名步骤事件正在发送；仅包含事件标识和流程状态。";
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
