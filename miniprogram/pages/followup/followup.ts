import type { FollowupQuestion, MockScenario } from "../../models/frontend";
import { frontendService } from "../../services/index";
import { isProfileComplete, sessionStore } from "../../store/session";
import { navigate, routes } from "../../utils/navigation";

Page({
  requestSerial: 0,
  data: {
    ready: false,
    loading: false,
    submitting: false,
    completed: false,
    editing: false,
    canNextSaved: false,
    round: 0,
    question: null as FollowupQuestion | null,
    answer: "",
    warning: "",
    error: "",
    validation: "",
    message: "",
    scenario: "normal" as MockScenario,
  },
  onShow() {
    void this.loadQuestion();
  },
  onHide() {
    this.requestSerial += 1;
  },
  onUnload() {
    this.requestSerial += 1;
  },
  async loadQuestion(): Promise<void> {
    const request = ++this.requestSerial;
    const { session, warning } = sessionStore.snapshot();
    const ready = isProfileComplete(session);
    const progress = session?.followup;
    const completed = progress?.submittedCount === 2 && !this.data.editing;
    this.setData({
      ready,
      completed,
      warning,
      loading: false,
      submitting: false,
      question: null,
      error: "",
      message: "",
      validation: "",
      round: progress?.round || 0,
      answer: progress?.drafts[progress.round] || "",
      canNextSaved: !!progress && progress.round === 0 && progress.submittedCount > 0,
    });
    if (!ready || completed || !session) return;
    this.setData({ loading: true });
    try {
      const response = await frontendService.getFollowup(this.data.round, this.data.scenario);
      if (request !== this.requestSerial) return;
      const current = sessionStore.snapshot().session;
      if (
        !current ||
        current.localId !== session.localId ||
        current.revision !== session.revision
      ) {
        this.setData({ loading: false, error: "答题记录已变化，请重试读取当前追问。" });
        return;
      }
      this.setData({
        loading: false,
        question: response.data,
        error: response.status === "error" ? response.message : "",
        message: response.status === "error" ? "" : response.message,
      });
    } catch {
      if (request === this.requestSerial)
        this.setData({ loading: false, error: "追问读取失败，请重试。" });
    }
  },
  input(event: WechatMiniprogram.Input) {
    if (this.data.loading || this.data.submitting || !this.data.question) return;
    const answer = event.detail.value.slice(0, 800);
    sessionStore.setFollowupDraft(this.data.round, answer);
    this.setData({
      answer,
      validation: "",
      warning: sessionStore.snapshot().warning,
      canNextSaved: false,
    });
  },
  submit() {
    if (this.data.loading || this.data.submitting || !this.data.question) return;
    if (!this.data.answer.trim()) {
      this.setData({ validation: "请填写本轮回答后再提交。" });
      return;
    }
    const session = sessionStore.snapshot().session;
    if (!session) return;
    if ((session.followup?.submittedCount || 0) > this.data.round) {
      if (session.followup?.submittedCount === 2) navigate(routes.initialResult);
      else this.nextSaved();
      return;
    }
    this.setData({ submitting: true });
    if (!sessionStore.submitFollowupRound(this.data.round, session.revision)) {
      this.setData({
        submitting: false,
        validation: "进度已变化。若本轮已提交，请前往已保存的下一轮。",
      });
      return;
    }
    this.setData({ editing: false });
    if (sessionStore.snapshot().session?.followup?.submittedCount === 2)
      navigate(routes.initialResult);
    void this.loadQuestion();
  },
  previous() {
    if (this.data.loading || this.data.submitting || this.data.round === 0) return;
    sessionStore.editFollowup(0);
    this.setData({ editing: true });
    void this.loadQuestion();
  },
  edit() {
    sessionStore.editFollowup(0);
    this.setData({ editing: true });
    void this.loadQuestion();
  },
  nextSaved() {
    const progress = sessionStore.snapshot().session?.followup;
    if (!progress || progress.submittedCount < 1) return;
    sessionStore.editFollowup(1);
    this.setData({ editing: true });
    void this.loadQuestion();
  },
  retry() {
    if (this.data.loading) return;
    this.setData({ scenario: "normal" });
    void this.loadQuestion();
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
    void this.loadQuestion();
  },
  retrySave() {
    sessionStore.retrySave();
    this.setData({ warning: sessionStore.snapshot().warning });
  },
  result() {
    navigate(routes.initialResult);
  },
  profile() {
    navigate(routes.profile);
  },
  home() {
    navigate(routes.home);
  },
});
