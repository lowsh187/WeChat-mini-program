import { baseQuestions } from '../../mocks/base-questions';
import { sessionStore } from '../../store/session';
import { navigate, routes } from '../../utils/navigation';

Page({
  data: { hasSession: false, answeredCount: 0, total: baseQuestions.length, warning: '', canContinue: false },
  onShow() { this.refresh(); },
  refresh() {
    const { session, warning } = sessionStore.snapshot();
    this.setData({ hasSession: !!session, answeredCount: session ? Object.keys(session.answers).length : 0, warning, canContinue: !!session });
  },
  start() {
    if (!this.data.hasSession) { sessionStore.start(); navigate(routes.profile); return; }
    wx.showModal({
      title: '重新开始？', content: '这会覆盖设备上的现有答题进度。',
      success: (result) => { if (result.confirm) { sessionStore.start(); navigate(routes.profile); } },
    });
  },
  resume() {
    const session = sessionStore.snapshot().session;
    if (session) {
      if (session.stage === 'work-trial' && session.trial) {
        navigate(`${routes.workTrial}?resume=1`); return;
      }
      navigate(session.stage === 'trial-result' ? routes.trialResult : session.stage === 'initial-result' ? routes.initialResult : session.stage === 'followup' ? routes.followup : routes.profile);
    }
  },
  preview() { navigate(`${routes.initialResult}?preview=1`); },
  showFollowup() { navigate(routes.followup); },
  clear() {
    wx.showModal({
      title: '清除本地记录？', content: '仅清除此设备的开发演示进度。本阶段没有云端记录。',
      success: (result) => {
        if (!result.confirm) return;
        const cleared = sessionStore.clear();
        this.refresh();
        wx.showToast({ title: cleared ? '本地记录已清除' : '清除失败，请重试', icon: 'none' });
      },
    });
  },
});
