import { baseQuestions } from "../../mocks/base-questions";
import { sessionStore } from "../../store/session";
import { navigate, routes } from "../../utils/navigation";
import { cloudSession } from "../../services/cloud-session";
import { cloudAdapter } from "../../services/cloud-adapter";
import { telemetry } from "../../services/telemetry";
import { PUBLICATION_TEXT_VERSION, publicationConsentText } from "../../services/v2-contract";
import { homeProgress } from "../../utils/home-progress";

// Presentation only: service state, credentials and request payloads are unchanged.
function userMessage(message: string): string {
  return message
    .replace(/删除凭据/g, "删除记录所需的信息")
    .replace(/凭据/g, "本机保存的信息")
    .replace(/匿名联调会话|匿名云端会话|云端匿名会话|云端会话/g, "服务连接")
    .replace(/会话/g, "体验")
    .replace(/eventId/g, "记录标识")
    .replace(/联调/g, "连接")
    .replace(/联系 B/g, "联系团队");
}

Page({
  data: {
    ...homeProgress(null, baseQuestions.length),
    cloudNeedsAttention: false,
    canRetryConnection: false,
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
    analyticsDetailsVisible: false,
    recordsVisible: false,
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
      ...homeProgress(session, baseQuestions.length),
      hasSession: !!session,
      answeredCount: session ? Object.keys(session.answers).length : 0,
      warning: userMessage(warning),
      canContinue: !!session,
    });
    const status = cloudSession.status();
    this.setData({
      cloudConnected: status.connected,
      cloudPending: status.pending,
      cloudWarning: userMessage(status.warning),
      cloudMessage: userMessage(this.data.cloudMessage),
      cloudLinked: status.linked,
      cloudNeedsAttention: !!session && !!wx.cloud && !cloudSession.current(),
      canRetryConnection: !!session && !status.connected && !status.pending && !status.warning,
    });
    const analytics = telemetry.status();
    this.setData({
      analyticsConsent: analytics.active,
      analyticsMessage: userMessage(analytics.message),
    });
  },
  async start() {
    if (this.data.cloudBusy || this.data.feedbackBusy) return;
    if (!this.data.hasSession) {
      sessionStore.start();
      if (!(await this.ensureCloudSession())) return;
      navigate(routes.profile);
      return;
    }
    wx.showModal({
      title: "重新开始？",
      content: "这会覆盖设备上的现有答题进度。",
      success: async (result) => {
        if (result.confirm) {
          const cloudStatus = cloudSession.status();
          if (wx.cloud && (cloudStatus.connected || cloudStatus.pending || !!cloudStatus.warning)) {
            this.setData({
              cloudMessage: userMessage(
                cloudStatus.connected
                  ? "请先在隐私与数据管理中删除旧的云端记录，再重新开始。"
                  : cloudStatus.warning || "上次连接结果尚未确认，请先处理当前连接状态再重新开始。",
              ),
              privacyVisible: true,
              recordsVisible: cloudStatus.connected,
              analyticsDetailsVisible: false,
              feedbackVisible: false,
            });
            this.refresh();
            return;
          }
          sessionStore.start();
          if (!(await this.ensureCloudSession())) return;
          navigate(routes.profile);
        }
      },
    });
  },
  async resume() {
    const session = sessionStore.snapshot().session;
    if (session) {
      if (!(await this.ensureCloudSession())) return;
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
  async ensureCloudSession(): Promise<boolean> {
    if (!wx.cloud || cloudSession.current()) return true;
    const status = cloudSession.status();
    if (status.connected || status.pending || status.warning) {
      this.setData({
        cloudMessage: userMessage(
          status.connected
            ? "检测到旧的云端记录与当前进度不匹配或已经过期。请先在隐私与数据管理中请求删除云端记录，再重新开始。"
            : status.warning || "上次连接结果尚未确认，请勿重复创建。请联系团队协助恢复。",
        ),
        privacyVisible: true,
        recordsVisible: status.connected,
        analyticsDetailsVisible: false,
        feedbackVisible: false,
      });
      this.refresh();
      return false;
    }
    this.setData({ cloudBusy: true, cloudMessage: "正在连接探索服务…" });
    try {
      const cloudMessage = await cloudSession.connect();
      this.setData({ cloudMessage: userMessage(cloudMessage) });
    } finally {
      this.setData({ cloudBusy: false });
      this.refresh();
    }
    return !!cloudSession.current();
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
      content: "清除此设备的画像、回答、试岗与计划勾选。云端记录不会同步删除。",
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
    this.setData({
      privacyVisible: !this.data.privacyVisible,
      analyticsDetailsVisible: false,
      recordsVisible: false,
      feedbackVisible: false,
    });
  },
  toggleAnalyticsDetails() {
    this.setData({
      analyticsDetailsVisible: !this.data.analyticsDetailsVisible,
      recordsVisible: false,
      feedbackVisible: false,
    });
  },
  toggleRecords() {
    this.setData({
      recordsVisible: !this.data.recordsVisible,
      analyticsDetailsVisible: false,
      feedbackVisible: false,
    });
  },
  feedback() {
    this.setData({
      feedbackVisible: !this.data.feedbackVisible,
      analyticsDetailsVisible: false,
      recordsVisible: false,
    });
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
        feedbackMessage: "尚未连接服务，反馈未发送。请先开始探索或重试连接。",
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
          : userMessage(response.message) || "尚未确认接收，请联系团队核实。",
    });
  },
  async connectCloud(): Promise<void> {
    if (this.data.cloudBusy || this.data.feedbackBusy) return;
    wx.showModal({
      title: "重新连接服务？",
      content:
        "将发送应用版本信息并连接探索服务，在本机保存管理记录所需的信息。完成画像后，必要回答会用于生成推荐和试岗结果。请勿输入个人隐私。",
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
      title: "删除云端探索记录？",
      content:
        "将请求服务器删除本次探索关联的评分、计划、反馈和使用统计。只有服务器确认后才显示成功。",
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
    this.setData({
      analyticsConsent: status.active,
      analyticsMessage: userMessage(status.message),
    });
  },
});
