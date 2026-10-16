import type { ActionPlanView, MockScenario } from "../../models/frontend";
import { frontendService } from "../../services/index";
import { sessionStore } from "../../store/session";
import { navigate, routes } from "../../utils/navigation";
import { telemetry } from "../../services/telemetry";

Page({
  requestSerial: 0,
  data: {
    plan: null as ActionPlanView | null,
    loading: false,
    error: "",
    message: "",
    warning: "",
    ready: false,
    completedCount: 0,
    expandedDay: 1,
    scenario: "normal" as MockScenario,
  },
  onShow() {
    void this.load();
  },
  onHide() {
    this.requestSerial += 1;
    this.setData({ loading: false });
  },
  onUnload() {
    this.requestSerial += 1;
  },
  refresh() {
    const { session, warning } = sessionStore.snapshot();
    const plan = session?.trial?.completed ? session.actionPlan?.view || null : null;
    this.setData({
      plan,
      ready: !!session?.trial?.completed,
      warning,
      completedCount: plan ? plan.items.filter((item) => item.completed).length : 0,
    });
    if (plan) telemetry.record("plan.viewed", "action_plan");
  },
  async load(): Promise<void> {
    if (this.data.loading) return;
    this.refresh();
    if (!this.data.ready || this.data.plan) return;
    const session = sessionStore.snapshot().session;
    if (!session?.trial?.result) return;
    const request = ++this.requestSerial;
    this.setData({ loading: true, error: "", message: "" });
    try {
      const response = await frontendService.getActionPlan(
        session.trial.result.roleName,
        this.data.scenario,
      );
      if (request !== this.requestSerial) return;
      if (response.status === "error" || !response.data) {
        this.setData({ loading: false, error: response.message || "计划为空，请重试。" });
        return;
      }
      if (!sessionStore.saveActionPlan(session.localId, session.revision, response.data)) {
        this.setData({ loading: false, error: "会话已变化或计划格式异常，请重新进入。" });
        return;
      }
      this.setData({ loading: false, message: response.message });
      this.refresh();
    } catch {
      if (request === this.requestSerial)
        this.setData({ loading: false, error: "网络或服务异常，请重试；可继续使用固定模板。" });
    }
  },
  toggle(event: WechatMiniprogram.TouchEvent) {
    if (!sessionStore.togglePlanDay(Number(event.currentTarget.dataset.day)))
      this.setData({ error: "计划已变化，请重新进入。" });
    this.refresh();
  },
  detail(event: WechatMiniprogram.TouchEvent) {
    const day = Number(event.currentTarget.dataset.day);
    this.setData({ expandedDay: this.data.expandedDay === day ? 0 : day });
  },
  retry() {
    this.setData({ scenario: "normal" });
    void this.load();
  },
  fallback() {
    if (this.data.plan) {
      this.setData({ error: "", message: "已保留原有固定演示计划，无需上传或重复生成。" });
      return;
    }
    this.setData({ scenario: "degraded" });
    void this.load();
  },
  simulate(event: WechatMiniprogram.TouchEvent) {
    const scenario = event.currentTarget.dataset.scenario as MockScenario;
    if (
      this.data.loading ||
      !["normal", "empty", "error", "timeout", "degraded"].includes(scenario)
    )
      return;
    this.setData({ scenario });
  },
  cloudPlan() {
    if (this.data.loading) return;
    this.setData({ plan: null, error: "", scenario: "normal" });
    void this.load();
  },
  mockPlan() {
    if (this.data.loading) return;
    wx.showModal({
      title: "切换固定演示计划？",
      content: "会替换当前计划并重置勾选进度。",
      success: async (result) => {
        if (!result.confirm || this.data.loading) return;
        const session = sessionStore.snapshot().session;
        if (!session?.trial?.result) return;
        const request = ++this.requestSerial;
        this.setData({ loading: true, error: "" });
        try {
          const response = await frontendService.getActionPlan(
            session.trial.result.roleName,
            this.data.scenario,
          );
          if (request !== this.requestSerial) return;
          if (response.status !== "error" && response.data)
            response.data.planId = `mock-plan-${session.localId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          if (
            response.status !== "error" &&
            response.data &&
            sessionStore.saveActionPlan(session.localId, session.revision, response.data)
          ) {
            this.setData({ loading: false, message: response.message || "已切换为固定演示计划。" });
            this.refresh();
          } else
            this.setData({
              loading: false,
              error: response.message || "计划为空或会话已变化，原计划已保留。",
            });
        } catch {
          if (request === this.requestSerial)
            this.setData({ loading: false, error: "模板读取失败，原计划已保留。" });
        }
      },
    });
  },
  retrySave() {
    sessionStore.retrySave();
    this.refresh();
  },
  result() {
    navigate(routes.trialResult);
  },
  trial() {
    navigate(`${routes.workTrial}?resume=1`);
  },
  home() {
    navigate(routes.home);
  },
});
