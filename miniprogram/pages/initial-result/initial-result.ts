import type { RecommendationCard, MockScenario } from "../../models/frontend";
import { frontendService } from "../../services/index";
import { isFollowupComplete, sessionStore } from "../../store/session";
import { navigate, routes } from "../../utils/navigation";
import { telemetry } from "../../services/telemetry";

const scenarios: MockScenario[] = ["normal", "empty", "error", "timeout", "degraded"];

Page({
  requestSerial: 0,
  data: {
    preview: false,
    loading: false,
    needsProfile: false,
    cards: [] as RecommendationCard[],
    error: "",
    statusMessage: "",
    warning: "",
    scenario: "normal" as MockScenario,
  },
  onLoad(options: Record<string, string | undefined>) {
    this.setData({ preview: options.preview === "1" });
  },
  onShow() {
    void this.loadRecommendation();
  },
  onHide() {
    this.requestSerial += 1;
  },
  onUnload() {
    this.requestSerial += 1;
  },
  async loadRecommendation(): Promise<void> {
    const request = ++this.requestSerial;
    const { session, warning } = sessionStore.snapshot();
    if (!this.data.preview && !isFollowupComplete(session)) {
      this.setData({
        needsProfile: true,
        loading: false,
        cards: [],
        warning,
        error: "",
        statusMessage: "",
      });
      return;
    }
    this.setData({
      loading: true,
      needsProfile: false,
      cards: [],
      error: "",
      statusMessage: "",
      warning,
    });
    try {
      const response = await frontendService.getInitialRecommendation(
        this.data.scenario,
        this.data.preview,
      );
      if (request !== this.requestSerial) return;
      const current = sessionStore.snapshot().session;
      if (
        !this.data.preview &&
        (!current || current.localId !== session?.localId || current.revision !== session?.revision)
      ) {
        this.setData({
          loading: false,
          needsProfile: true,
          cards: [],
          error: "画像已更新，请重新进入以查看演示结果。",
        });
        return;
      }
      if (response.status === "error") {
        this.setData({ loading: false, error: response.message });
        return;
      }
      if (!this.data.preview && session && response.data.cards.length > 0)
        sessionStore.markRecommendation(session.revision);
      this.setData({
        loading: false,
        cards: response.data.cards,
        statusMessage: response.message,
        warning: sessionStore.snapshot().warning,
      });
      if (!this.data.preview && response.data.cards.length === 3)
        telemetry.record("recommendation.viewed", "initial_result");
    } catch {
      if (request === this.requestSerial)
        this.setData({ loading: false, error: "演示数据读取失败，请重试。" });
    }
  },
  retry() {
    if (this.data.loading) return;
    this.setData({ scenario: "normal" });
    void this.loadRecommendation();
  },
  simulate(event: WechatMiniprogram.TouchEvent) {
    const value = event.currentTarget.dataset.scenario as MockScenario;
    if (this.data.loading || !scenarios.includes(value)) return;
    this.setData({ scenario: value });
    void this.loadRecommendation();
  },
  editProfile() {
    navigate(routes.profile);
  },
  trial(event: WechatMiniprogram.TouchEvent) {
    const roleId = event.currentTarget.dataset.role;
    const available = frontendService.getTrialOptions().some((item) => item.localRoleId === roleId);
    if (
      typeof roleId === "string" &&
      available &&
      this.data.cards.some((card) => card.localId === roleId)
    ) {
      navigate(`${routes.workTrial}?role=${encodeURIComponent(roleId)}`);
    } else if (typeof roleId === "string") {
      this.setData({ error: "该方向暂未开放模拟试岗，请选择数据分析、产品运营或用户研究。" });
    }
  },
  followup() {
    navigate(routes.followup);
  },
  home() {
    navigate(routes.home);
  },
});
