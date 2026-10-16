import type { MockScenario, TrialDefinition, TrialField } from "../../models/frontend";
import { frontendService } from "../../services/index";
import { isFollowupComplete, sessionStore } from "../../store/session";
import { navigate, routes } from "../../utils/navigation";
import { trialClock } from "../../utils/trial-clock";
import { buildTrialRequest } from "../../services/v2-contract";

Page({
  requestSerial: 0,
  timer: null as ReturnType<typeof setInterval> | null,
  visible: false,
  data: {
    options: frontendService.getTrialOptions(),
    localRoleId: "ui-data",
    definition: null as TrialDefinition | null,
    answerFields: [] as (TrialField & { answer: string })[],
    supplementaryAnswer: "",
    ready: false,
    started: false,
    completed: false,
    loading: false,
    submitting: false,
    error: "",
    submissionError: "",
    message: "",
    warning: "",
    validation: "",
    clockLabel: "4:00",
    timeProgress: 0,
    expired: false,
    scenario: "normal" as MockScenario,
  },
  onLoad(options: Record<string, string | undefined>) {
    const trial = sessionStore.snapshot().session?.trial;
    const roleId =
      options.resume === "1" && trial
        ? this.data.options.find((item) => item.localTrialId === trial.localTrialId)?.localRoleId
        : options.role;
    if (roleId && this.data.options.some((item) => item.localRoleId === roleId))
      this.setData({ localRoleId: roleId });
  },
  onShow() {
    this.visible = true;
    void this.loadTrial();
  },
  onHide() {
    this.visible = false;
    this.requestSerial += 1;
    this.stopClock();
  },
  onUnload() {
    this.visible = false;
    this.requestSerial += 1;
    this.stopClock();
  },
  async loadTrial(): Promise<void> {
    const request = ++this.requestSerial;
    this.stopClock();
    this.setData({
      loading: true,
      submitting: false,
      definition: null,
      error: "",
      submissionError: "",
      message: "",
      validation: "",
      started: false,
      completed: false,
    });
    try {
      const response = await frontendService.getTrial(this.data.localRoleId, this.data.scenario);
      if (request !== this.requestSerial) return;
      this.setData({
        loading: false,
        definition: response.data,
        error: response.status === "error" ? response.message : "",
        message: response.status === "error" ? "" : response.message,
      });
      this.refreshDraft();
    } catch {
      if (request === this.requestSerial)
        this.setData({ loading: false, error: "试岗材料读取失败，请重试。" });
    }
  },
  refreshDraft() {
    const { session, warning } = sessionStore.snapshot();
    const definition = this.data.definition;
    const trial = session?.trial?.localTrialId === definition?.localId ? session?.trial : undefined;
    this.setData({
      ready: isFollowupComplete(session),
      warning,
      started: !!trial,
      completed: !!trial?.completed,
      answerFields: definition
        ? definition.fields.map((field) => ({
            ...field,
            answer: trial?.answers[field.localId] || "",
          }))
        : [],
      supplementaryAnswer: trial?.supplementaryAnswer || "",
    });
    this.tick();
    if (trial && !trial.completed && this.visible) this.startClock();
  },
  begin(restart = false) {
    if (this.data.loading || this.data.submitting || !this.data.definition) return;
    if (!sessionStore.startTrial(this.data.definition.localId, restart)) {
      this.setData({ validation: "请先完成画像与两轮追问，再开始试岗。" });
      return;
    }
    this.requestSerial += 1;
    this.setData({ validation: "", submissionError: "", message: "" });
    this.refreshDraft();
  },
  start() {
    this.begin();
  },
  restart() {
    if (this.data.submitting) return;
    wx.showModal({
      title: "重新试岗？",
      content: "将清空当前试岗答案与结果，并重新开始 4 分钟计时。",
      success: (response) => {
        if (response.confirm) this.begin(true);
      },
    });
  },
  selectRole(event: WechatMiniprogram.TouchEvent) {
    const role = event.currentTarget.dataset.role;
    if (
      this.data.loading ||
      this.data.submitting ||
      role === this.data.localRoleId ||
      !this.data.options.some((item) => item.localRoleId === role)
    )
      return;
    const change = () => {
      this.setData({ localRoleId: role as string, scenario: "normal" });
      void this.loadTrial();
    };
    if (this.data.started && !this.data.completed) {
      wx.showModal({
        title: "切换试岗？",
        content: "当前草稿保留到新试岗开始；开始其他岗位后将替换当前草稿。",
        success: (response) => {
          if (response.confirm) change();
        },
      });
    } else change();
  },
  input(event: WechatMiniprogram.Input) {
    if (!this.data.started || this.data.submitting || this.data.completed) return;
    const field = event.currentTarget.dataset.field;
    if (typeof field !== "string") return;
    sessionStore.updateTrialAnswer(field, event.detail.value.slice(0, 1200));
    this.setData({ validation: "", submissionError: "" });
    this.refreshDraft();
  },
  async submit(): Promise<void> {
    if (this.data.submitting || this.data.loading || !this.data.started || !this.data.definition)
      return;
    const session = sessionStore.snapshot().session;
    const trial = session?.trial;
    if (
      !session ||
      !trial ||
      trial.localTrialId !== this.data.definition.localId ||
      !isFollowupComplete(session)
    ) {
      this.setData({ validation: "进度已变化，请返回画像与追问后重新进入试岗。" });
      return;
    }
    if (trial.completed) {
      navigate(routes.trialResult);
      return;
    }
    const missing = this.data.definition.fields.find(
      (field) => !trial.answers[field.localId]?.trim(),
    );
    if (missing) {
      this.setData({ validation: `请填写“${missing.label}”后提交。` });
      return;
    }
    const request = ++this.requestSerial;
    this.setData({ submitting: true, submissionError: "", validation: "", message: "" });
    try {
      const payload = buildTrialRequest(session.localId, session);
      const response = await frontendService.submitTrial(
        trial.localTrialId,
        this.data.scenario,
        payload,
      );
      if (request !== this.requestSerial) return;
      if (response.status === "error" || !response.data) {
        this.setData({
          submitting: false,
          submissionError: response.message || "模拟结果为空，草稿已保留，请重试。",
        });
        return;
      }
      if (
        !sessionStore.saveTrialResult(
          trial.localTrialId,
          trial.revision,
          session.localId,
          session.revision,
          response.data,
          response.status,
          response.message,
        )
      ) {
        this.setData({
          submitting: false,
          submissionError: "进度已变化或示例数据不完整，未保存结果。请重试。",
        });
        return;
      }
      this.setData({ submitting: false, message: response.message });
      this.refreshDraft();
      this.stopClock();
      navigate(routes.trialResult);
    } catch {
      if (request === this.requestSerial)
        this.setData({ submitting: false, submissionError: "提交失败，答案已保留，请重试。" });
    }
  },
  retrySubmit() {
    if (!this.data.submitting) {
      this.setData({ scenario: "normal" });
      void this.submit();
    }
  },
  retryLoad() {
    if (!this.data.loading && !this.data.submitting) {
      this.setData({ scenario: "normal" });
      void this.loadTrial();
    }
  },
  simulate(event: WechatMiniprogram.TouchEvent) {
    const scenario = event.currentTarget.dataset.scenario as MockScenario;
    if (
      this.data.loading ||
      this.data.submitting ||
      !["normal", "empty", "error", "timeout", "degraded"].includes(scenario)
    )
      return;
    this.setData({ scenario });
  },
  tick() {
    const trial = sessionStore.snapshot().session?.trial;
    const definition = this.data.definition;
    const clock =
      trial && definition && trial.localTrialId === definition.localId
        ? trialClock(trial.startedAt, definition.durationSeconds)
        : { label: "4:00", progress: 0, expired: false };
    this.setData({ clockLabel: clock.label, timeProgress: clock.progress, expired: clock.expired });
    if (clock.expired) this.stopClock();
  },
  startClock() {
    this.stopClock();
    if (!this.data.expired) this.timer = setInterval(() => this.tick(), 1000);
  },
  stopClock() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },
  retrySave() {
    sessionStore.retrySave();
    this.setData({ warning: sessionStore.snapshot().warning });
  },
  result() {
    navigate(routes.trialResult);
  },
  followup() {
    navigate(routes.followup);
  },
  recommendation() {
    navigate(routes.initialResult);
  },
  home() {
    navigate(routes.home);
  },
});
