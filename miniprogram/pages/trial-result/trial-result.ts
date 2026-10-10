import { navigate, routes } from '../../utils/navigation';
import { sessionStore } from '../../store/session';
import { TrialResultView } from '../../models/frontend';

Page({
  data: { result: null as TrialResultView | null, degraded: false, message: '', warning: '' },
  onShow() {
    const { session, warning } = sessionStore.snapshot();
    const trial = session?.trial;
    this.setData({ result: trial?.completed && trial.result?.source === 'mock' ? trial.result : null,
      degraded: trial?.resultStatus === 'degraded', message: trial?.message || '', warning });
  },
  trial() { navigate(`${routes.workTrial}?resume=1`); },
  recommendation() { navigate(routes.initialResult); },
  plan() { navigate(routes.actionPlan); },
  retrySave() { sessionStore.retrySave(); this.setData({ warning: sessionStore.snapshot().warning }); },
  home() { navigate(routes.home); },
});
