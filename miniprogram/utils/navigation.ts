export const routes = {
  home: '/pages/home/home', profile: '/pages/profile/profile',
  followup: '/pages/followup/followup', initialResult: '/pages/initial-result/initial-result',
  workTrial: '/pages/work-trial/work-trial', trialResult: '/pages/trial-result/trial-result',
  actionPlan: '/pages/action-plan/action-plan',
};

export function navigate(url: string): void {
  const pages = getCurrentPages();
  // Reuse an existing page to keep repeated back/edit navigation within the stack limit.
  const path = url.split('?')[0].slice(1);
  const index = pages.findIndex((page) => page.route === path);
  if (index >= 0 && !url.includes('?')) {
    const delta = pages.length - 1 - index;
    if (delta > 0) wx.navigateBack({ delta, fail: showNavigationError });
    return;
  }
  if (pages.length >= 9) wx.redirectTo({ url, fail: showNavigationError });
  else wx.navigateTo({ url, fail: showNavigationError });
}

function showNavigationError(): void {
  wx.showToast({ title: '页面打开失败，请重试', icon: 'none' });
}
