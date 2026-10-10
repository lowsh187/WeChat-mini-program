import { baseQuestions, currentStates, goals, preferences } from '../../mocks/base-questions';
import { ProfileDraft } from '../../models/frontend';
import { isProfileComplete, sessionStore } from '../../store/session';
import { navigate, routes } from '../../utils/navigation';

Page({
  data: {
    currentStates, goals, preferences, profile: { currentState: '', goal: '', preference: '' },
    question: baseQuestions[0], questionIndex: 0, total: baseQuestions.length,
    selectedOption: '', answeredCount: 0, progressPercent: 0,
    warning: '', validation: '', ready: false, submitting: false,
  },
  onShow() { this.setData({ submitting: false }); this.refresh(); },
  refresh() {
    const snapshot = sessionStore.snapshot();
    const session = snapshot.session;
    if (!session) {
      this.setData({ ready: false, warning: snapshot.warning || '当前没有答题进度，请开始新的本地体验。' });
      return;
    }
    const question = baseQuestions[session.questionIndex];
    const answeredCount = Object.keys(session.answers).length;
    this.setData({
      ready: true, profile: session.profile, questionIndex: session.questionIndex, question,
      selectedOption: session.answers[question.id] || '', answeredCount,
      progressPercent: Math.round(answeredCount / baseQuestions.length * 100), warning: snapshot.warning,
    });
  },
  start() { sessionStore.start(); this.refresh(); },
  chooseProfile(event: WechatMiniprogram.TouchEvent) {
    const { field, value } = event.currentTarget.dataset;
    if (field !== 'currentState' && field !== 'goal' && field !== 'preference') return;
    if (typeof value !== 'string') return;
    sessionStore.updateProfile(field as keyof ProfileDraft, value);
    this.setData({ validation: '' }); this.refresh();
  },
  chooseAnswer(event: WechatMiniprogram.TouchEvent) {
    const option = event.currentTarget.dataset.option;
    if (typeof option !== 'string' || !this.data.ready) return;
    sessionStore.answer(this.data.question.id, option);
    this.setData({ validation: '' }); this.refresh();
  },
  previous() {
    if (this.data.questionIndex > 0) sessionStore.moveTo(this.data.questionIndex - 1);
    this.setData({ validation: '' }); this.refresh();
  },
  next() {
    if (!this.data.selectedOption) { this.setData({ validation: '请先选择本题的一个选项。' }); return; }
    if (this.data.questionIndex < baseQuestions.length - 1) sessionStore.moveTo(this.data.questionIndex + 1);
    this.setData({ validation: '' }); this.refresh();
  },
  submit() {
    if (this.data.submitting) return;
    const session = sessionStore.snapshot().session;
    if (!isProfileComplete(session)) {
      this.setData({ validation: '请选择当前状态、探索目标和偏好，并完成全部 8 道题。' });
      if (session) {
        const missing = baseQuestions.findIndex((question) => !session.answers[question.id]);
        if (missing >= 0) { sessionStore.moveTo(missing); this.refresh(); }
      }
      return;
    }
    this.setData({ submitting: true });
    sessionStore.enterFollowup();
    navigate(routes.followup);
    this.setData({ submitting: false });
  },
  retrySave() { sessionStore.retrySave(); this.refresh(); },
  followup() { navigate(routes.followup); },
});
