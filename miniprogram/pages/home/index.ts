import { baseQuestions } from "../../mocks/base-questions";
import { sessionStore } from "../../store/session";
import { navigate, routes } from "../../utils/navigation";
import { cloudSession } from "../../services/cloud-session";
import { cloudAdapter } from "../../services/cloud-adapter";
import { telemetry } from "../../services/telemetry";
import { PUBLICATION_TEXT_VERSION, publicationConsentText } from "../../services/v2-contract";

Page({
  data: {
    hasSession: false,
    answeredCount: 0,
    total: baseQuestions.length,
    warning: "",
    canContinue: false,
    title: "PathAI 职业试岗舱",
    subtitle: "别只问自己适合什么工作，先用 5 分钟做一次这份工作。",
    publicationConsent: false,
    publicationConsentText,
    publicationTextVersion: PUBLICATION_TEXT_VERSION,
    feedbackSessionId: "",
    privacyVisible: false,
    feedbackVisible: false,
    feedbackText: "",
    helpfulness: 0,
    feedbackMessage: "",
    feedbackSent: false,
    cloudBusy: false,
    cloudMessage: "",
    cloudConnected: false,
    cloudPending: false,
    cloudWarning: "",
    cloudLinked: false,
    analyticsConsent: false,
    analyticsMessage: "",
    feedbackBusy: false,
    feedbackUncertain: false,
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    const { session, warning } = sessionStore.snapshot();
    if (this.data.feedbackSessionId !== (session?.localId || ""))
      this.setData({
        feedbackSessionId: session?.localId || "",
        publicationConsent: false,
        feedbackText: "",
        helpfulness: 0,
        feedbackSent: false,
        feedbackUncertain: false,
        feedbackMessage: "",
      });
    this.setData({
      hasSession: !!session,
      answeredCount: session ? Object.keys(session.answers).length : 0,
      warning,
      canContinue: !!session,
    });
    const status = cloudSession.status();
    this.setData({
      cloudConnected: status.connected,
      cloudPending: status.pending,
      cloudWarning: status.warning,
      cloudLinked: status.linked,
    });
    const analytics = telemetry.status();
    this.setData({ analyticsConsent: analytics.active, analyticsMessage: analytics.message });
  },
  async start() {
    if (this.data.cloudBusy || this.data.feedbackBusy) return;
    if (!this.data.hasSession) {
      sessionStore.start();
      if (wx.cloud && !cloudSession.current()) {
        this.setData({ cloudBusy: true, cloudMessage: "正在创建匿名云端会话…" });
        const cloudMessage = await cloudSession.connect();
        this.setData({ cloudBusy: false, cloudMessage });
        if (!cloudSession.current()) {
          this.refresh();
          return;
        }
      }
      navigate(routes.profile);
      return;
    }
    wx.showModal({
      title: "重新开始？",
      content: "这会覆盖设备上的现有答题进度。",
      success: (result) => {
        if (result.confirm) {
          sessionStore.start();
          navigate(routes.profile);
        }
      },
    });
  },
  resume() {
    const session = sessionStore.snapshot().session;
    if (session) {
      if (session.actionPlan && session.trial?.completed) {
        navigate(routes.actionPlan);
        return;
      }
      if (session.stage === "work-trial" && session.trial) {
        navigate(`${routes.workTrial}?resume=1`);
        return;
      }
      navigate(
        session.stage === "trial-result"
          ? routes.trialResult
          : session.stage === "initial-result"
            ? routes.initialResult
            : session.stage === "followup"
              ? routes.followup
              : routes.profile,
      );
    }
  },
  preview() {
    navigate(`${routes.initialResult}?preview=1`);
  },
  showFollowup() {
    navigate(routes.followup);
  },
  clear() {
    if (this.data.cloudBusy || this.data.feedbackBusy) return;
    wx.showModal({
      title: "清除本地记录？",
      content: "清除此设备的画像、回答、试岗与计划勾选。云端记录须另行删除；删除凭据将保留。",
      success: (result) => {
        if (!result.confirm) return;
        const cleared = sessionStore.clear();
        if (cleared) telemetry.stop();
        this.refresh();
        wx.showToast({ title: cleared ? "本地记录已清除" : "清除失败，请重试", icon: "none" });
      },
    });
  },
  privacy() {
    this.setData({ privacyVisible: !this.data.privacyVisible });
  },
  feedback() {
    this.setData({ feedbackVisible: !this.data.feedbackVisible });
  },
  feedbackInput(event: WechatMiniprogram.Input) {
    this.setData({
      feedbackText: event.detail.value.slice(0, 480),
      feedbackSent: false,
      feedbackMessage: "",
    });
  },
  rate(event: WechatMiniprogram.TouchEvent) {
    this.setData({
      helpfulness: Number(event.currentTarget.dataset.value),
      feedbackSent: false,
      feedbackMessage: "",
    });
  },
  togglePublicationConsent() {
    if (!this.data.feedbackBusy)
      this.setData({
        publicationConsent: !this.data.publicationConsent,
        feedbackSent: false,
        feedbackMessage: "",
      });
  },
  async sendFeedback(): Promise<void> {
    if (
      this.data.feedbackBusy ||
      this.data.feedbackSent ||
      this.data.feedbackUncertain ||
      this.data.cloudBusy
    )
      return;
    const session = cloudSession.current();
    if (!session) {
      this.setData({
        feedbackMessage: "尚未建立有效云端会话，反馈未发送。请先创建匿名会话。",
      });
      return;
    }
    if (
      !Number.isInteger(this.data.helpfulness) ||
      this.data.helpfulness < 1 ||
      this.data.helpfulness > 5
    ) {
      this.setData({ feedbackMessage: "请先选择 1～5 的帮助度。" });
      return;
    }
    this.setData({ feedbackBusy: true, feedbackMessage: "" });
    const response = await cloudAdapter.submitFeedback(
      session.sessionId,
      this.data.helpfulness,
      this.data.feedbackText,
      {
        granted: this.data.publicationConsent,
        textVersion: PUBLICATION_TEXT_VERSION,
      },
    );
    this.setData({
      feedbackBusy: false,
      feedbackSent: response.status === "success",
      feedbackUncertain:
        response.status === "error" && /15 秒|云服务或本地保存异常/.test(response.message),
      feedbackMessage:
        response.status === "success"
          ? "云端已确认接收反馈。"
          : response.message || "尚未确认接收，请联系团队核实。",
    });
  },
  async connectCloud(): Promise<void> {
    if (this.data.cloudBusy || this.data.feedbackBusy) return;
    wx.showModal({
      title: "创建匿名云端会话？",
      content:
        "将向当前云环境发送版本号以创建匿名会话，并在设备保存删除凭据。完成画像后，回答会用于生成推荐和试岗结果。请勿输入个人隐私。",
      success: async (result) => {
        if (!result.confirm || this.data.cloudBusy) return;
        this.setData({ cloudBusy: true, cloudMessage: "" });
        telemetry.stop();
        try {
          this.setData({ cloudMessage: await cloudSession.connect() });
        } finally {
          this.setData({ cloudBusy: false });
          this.refresh();
        }
      },
    });
  },
  deleteCloud() {
    if (this.data.cloudBusy || this.data.feedbackBusy) return;
    wx.showModal({
      title: "删除云端匿名记录？",
      content:
        "将请求服务器删除该匿名会话关联的评分、计划、反馈和事件。只有服务器确认后才显示成功。",
      success: async (result) => {
        if (!result.confirm || this.data.cloudBusy || this.data.feedbackBusy) return;
        this.setData({ cloudBusy: true, cloudMessage: "" });
        telemetry.stop();
        try {
          this.setData({ cloudMessage: await cloudSession.remove(), analyticsConsent: false });
        } finally {
          this.setData({ cloudBusy: false });
          this.refresh();
        }
      },
    });
  },
  saveCloudCredential() {
    this.setData({ cloudMessage: cloudSession.retrySave() });
    this.refresh();
  },
  analytics() {
    if (this.data.cloudBusy) return;
    if (telemetry.status().active) telemetry.stop();
    else telemetry.start();
    const status = telemetry.status();
    this.setData({ analyticsConsent: status.active, analyticsMessage: status.message });
  },
});
