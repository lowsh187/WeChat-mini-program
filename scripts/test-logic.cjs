const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..', 'miniprogram');
const modules = new Map();
const device = new Map();
const delays = [];
const intervals = new Map();
let nextInterval = 1;
const pageDefinitions = new Map();
let pages = [];
const navigations = [];
const wxMock = {
  getStorageSync: (key) => device.has(key) ? device.get(key) : '',
  setStorageSync: (key, value) => device.set(key, structuredClone(value)),
  removeStorageSync: (key) => device.delete(key),
  navigateTo: (options) => navigations.push(['navigateTo', options]),
  redirectTo: (options) => navigations.push(['redirectTo', options]),
  navigateBack: (options) => navigations.push(['navigateBack', options]),
  showToast() {}, showModal() {},
};
function load(file) {
  const filename = path.resolve(root, file.endsWith('.ts') ? file : `${file}.ts`);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
  }).outputText;
  const requireLocal = (name) => load(path.relative(root, path.resolve(path.dirname(filename), name)));
  // The tests run TS in memory; no emitted JS files enter the mini program.
  new Function('require', 'module', 'exports', 'wx', 'setTimeout', 'Page', 'getCurrentPages', 'setInterval', 'clearInterval', code)(
    requireLocal, module, module.exports, wxMock,
    (callback, delay) => { delays.push(delay); callback(); return 0; },
    (definition) => { pageDefinitions.set(filename, definition); }, () => pages,
    (callback) => { const id = nextInterval++; intervals.set(id, callback); return id; },
    (id) => intervals.delete(id),
  );
  return module.exports;
}
function mountPage(file) {
  load(file);
  const definition = pageDefinitions.get(path.resolve(root, `${file}.ts`));
  return { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); } };
}
function profileCondition(value, data) {
  // A literal WXML attribute is a string, not a data binding.
  const binding = /^\{\{\s*(!?)(\w+)\s*\}\}$/.exec(value);
  if (!binding) return Boolean(value);
  return binding[1] === '!' ? !data[binding[2]] : Boolean(data[binding[2]]);
}
let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS: ${name}`); }
async function main() {
  const { createSessionStore, isProfileComplete, sessionStore } = load('store/session');
  const { baseQuestions, currentStates, goals, preferences } = load('mocks/base-questions');
  const memory = new Map();
  const storage = {
    read: (key) => memory.get(key),
    write: (key, value) => memory.set(key, structuredClone(value)),
    remove: (key) => memory.delete(key),
  };
  function complete(store) {
    store.start();
    store.updateProfile('currentState', currentStates[0].id);
    store.updateProfile('goal', goals[0].id);
    store.updateProfile('preference', preferences[0].id);
    for (const question of baseQuestions) store.answer(question.id, question.options[0].id);
  }
  function completeFollowup(store) {
    store.enterFollowup();
    for (let round = 0; round < 2; round++) {
      store.setFollowupDraft(round, `预设追问回答 ${round + 1}`);
      assert.equal(store.submitFollowupRound(round, store.snapshot().session.revision), true);
    }
  }
  await check('8 draft questions, unique IDs, no scoring fields', () => {
    assert.equal(baseQuestions.length, 8);
    assert.equal(new Set(baseQuestions.map((question) => question.id)).size, 8);
    for (const question of baseQuestions) {
      assert.deepEqual(Object.keys(question).sort(), ['context', 'id', 'options', 'title']);
      assert.equal(new Set(question.options.map((option) => option.id)).size, question.options.length);
      for (const option of question.options) assert.deepEqual(Object.keys(option).sort(), ['id', 'label']);
    }
  });
  await check('fresh start, completion validation, progress survives a new store', () => {
    const store = createSessionStore(storage);
    assert.equal(store.snapshot().session, null);
    store.start();
    assert.equal(isProfileComplete(store.snapshot().session), false);
    complete(store); store.moveTo(6);
    const restored = createSessionStore(storage).snapshot().session;
    assert.equal(restored.questionIndex, 6);
    assert.equal(Object.keys(restored.answers).length, 8);
    assert.equal(isProfileComplete(restored), true);
  });
  await check('answer/profile edits invalidate result; stale revisions rejected; snapshots isolated', () => {
    const store = createSessionStore(storage);
    completeFollowup(store);
    const before = store.snapshot().session;
    assert.equal(store.markRecommendation(before.revision), true);
    store.answer(baseQuestions[0].id, 'b');
    assert.equal(store.snapshot().session.stage, 'profile');
    assert.equal(store.markRecommendation(before.revision), false);
    const snapshot = store.snapshot().session;
    snapshot.answers[baseQuestions[0].id] = 'c';
    assert.equal(store.snapshot().session.answers[baseQuestions[0].id], 'b');
    store.markRecommendation(store.snapshot().session.revision);
    store.updateProfile('goal', goals[1].id);
    assert.equal(store.snapshot().session.stage, 'profile');
    assert.throws(() => store.answer('unknown', 'a'));
    assert.throws(() => store.moveTo(8));
    assert.throws(() => store.updateProfile('goal', 'unknown'));
  });
  await check('corrupt/version-mismatched cache is rejected without crashing', () => {
    for (const raw of [{ version: 99 }, { version: 1, session: {} }, { version: 1, session: { ...createSessionStore(storage).snapshot().session, questionIndex: 999 } }]) {
      const store = createSessionStore({ ...storage, read: () => raw });
      assert.equal(store.snapshot().session, null); assert.ok(store.snapshot().warning);
    }
  });
  await check('storage failures preserve memory, expose warning, retry and delete correctly', () => {
    let failWrite = true;
    let failRemove = true;
    const store = createSessionStore({
      ...storage,
      write: (...args) => { if (failWrite) throw new Error('quota'); storage.write(...args); },
      remove: (...args) => { if (failRemove) throw new Error('storage'); storage.remove(...args); },
    });
    store.start(); assert.ok(store.snapshot().warning); assert.ok(store.snapshot().session);
    failWrite = false; store.retrySave(); assert.equal(store.snapshot().warning, '');
    assert.equal(store.clear(), false); assert.ok(store.snapshot().session);
    failRemove = false; assert.equal(store.clear(), true); assert.equal(store.snapshot().session, null);
    assert.equal(createSessionStore(storage).snapshot().session, null);
    const unreadable = createSessionStore({ ...storage, read: () => { throw new Error('read'); } });
    assert.ok(unreadable.snapshot().warning); assert.equal(unreadable.snapshot().session, null);
  });
  const { frontendService } = load('services/index');
  await check('Mock returns exactly 3 fixed roles and fresh data, independent of answers', async () => {
    const first = await frontendService.getInitialRecommendation();
    assert.equal(first.status, 'success'); assert.equal(first.data.source, 'mock');
    assert.match(first.data.notice, /非真实 AI/); assert.equal(first.data.cards.length, 3);
    assert.deepEqual(first.data.cards.map((card) => card.name), ['数据分析', '用户研究', '产品运营']);
    first.data.cards[0].name = 'modified';
    const second = await frontendService.getInitialRecommendation();
    assert.equal(second.data.cards[0].name, '数据分析');
    assert.equal(second.data.cards.some((card) => 'score' in card), false);
  });
  await check('Mock empty/error/degraded/timeout paths; timeout configured to 15000ms', async () => {
    assert.equal((await frontendService.getInitialRecommendation('empty')).data.cards.length, 0);
    assert.equal((await frontendService.getInitialRecommendation('error')).status, 'error');
    assert.equal((await frontendService.getInitialRecommendation('degraded')).status, 'degraded');
    assert.equal((await frontendService.getInitialRecommendation('timeout')).status, 'degraded');
    assert.equal(delays.at(-1), 15000); // Timer replaced in Node, not a real DevTools latency check.
  });
  await check('navigation reuses existing pages and avoids stack overflow', () => {
    const { navigate, routes } = load('utils/navigation');
    pages = [{ route: 'pages/home/home' }, { route: 'pages/profile/profile' }, { route: 'pages/initial-result/initial-result' }];
    navigate(routes.profile); assert.equal(navigations.at(-1)[0], 'navigateBack'); assert.equal(navigations.at(-1)[1].delta, 1);
    pages = Array.from({ length: 9 }, (_, i) => ({ route: `other/${i}` }));
    navigate(routes.workTrial); assert.equal(navigations.at(-1)[0], 'redirectTo');
    pages = []; navigate(routes.profile); assert.equal(navigations.at(-1)[0], 'navigateTo');
  });
  await check('profile page validates required choices and directs user to unanswered question', () => {
    sessionStore.clear(); sessionStore.start();
    const page = mountPage('pages/profile/profile'); page.onShow(); page.submit();
    assert.match(page.data.validation, /全部 8/);
    page.next(); assert.match(page.data.validation, /先选择/);
    page.chooseAnswer({ currentTarget: { dataset: { option: 'a' } } });
    page.next(); assert.equal(page.data.questionIndex, 1);
    page.previous(); assert.equal(page.data.selectedOption, 'a');
  });
  await check('profile start tap exits the empty WXML branch and exposes the first question', () => {
    sessionStore.clear();
    const page = mountPage('pages/profile/profile');
    const markup = fs.readFileSync(path.join(root, 'pages/profile/profile.wxml'), 'utf8');
    const emptyBranch = /<block wx:if="([^"]+)"/.exec(markup)[1];
    const handler = /bindtap="([^"]+)">开始新的本地体验/.exec(markup)[1];
    page.onShow();
    assert.equal(profileCondition(emptyBranch, page.data), true);
    assert.equal(typeof page[handler], 'function');
    page[handler]();
    assert.equal(page.data.ready, true);
    assert.equal(profileCondition(emptyBranch, page.data), false, 'Start button must disappear when the session is ready');
    assert.deepEqual(page.data.profile, { currentState: '', goal: '', preference: '' });
    assert.equal(page.data.question.id, baseQuestions[0].id);
    assert.equal(page.data.total, 8);
    page.chooseProfile({ currentTarget: { dataset: { field: 'goal', value: goals[0].id } } });
    page.chooseAnswer({ currentTarget: { dataset: { option: 'a' } } });
    assert.equal(page.data.profile.goal, goals[0].id);
    assert.equal(page.data.selectedOption, 'a');
    page.next(); assert.equal(page.data.questionIndex, 1);
    page.start();
    assert.equal(page.data.questionIndex, 0);
    assert.equal(page.data.answeredCount, 0);
    assert.equal(page.data.selectedOption, '');
    assert.equal(profileCondition(emptyBranch, page.data), false);
  });
  await check('home start opens a ready profile and re-entering restores the question', () => {
    sessionStore.clear(); pages = [];
    const home = mountPage('pages/home/home'); home.onShow(); home.start();
    assert.equal(navigations.at(-1)[1].url, '/pages/profile/profile');
    const page = mountPage('pages/profile/profile'); page.onShow();
    assert.equal(page.data.ready, true);
    page.chooseAnswer({ currentTarget: { dataset: { option: 'b' } } }); page.next();
    const returned = mountPage('pages/profile/profile'); returned.onShow();
    assert.equal(returned.data.ready, true); assert.equal(returned.data.questionIndex, 1);
    returned.previous(); assert.equal(returned.data.selectedOption, 'b');
  });
  await check('profile start with wx storage failure still opens questions and renders a retry warning', () => {
    sessionStore.clear();
    const page = mountPage('pages/profile/profile'); page.onShow();
    const originalWrite = wxMock.setStorageSync;
    try {
      wxMock.setStorageSync = () => { throw new Error('simulated device quota'); };
      page.start();
      assert.equal(page.data.ready, true);
      assert.equal(page.data.question.id, baseQuestions[0].id);
      assert.match(page.data.warning, /本地保存失败/);
      const markup = fs.readFileSync(path.join(root, 'pages/profile/profile.wxml'), 'utf8');
      const warningCondition = /<view wx:if="([^"]+)" class="error">\{\{warning\}\}/.exec(markup)[1];
      assert.equal(profileCondition(warningCondition, page.data), true);
      assert.match(markup, /bindtap="retrySave">重试保存/);
      page.chooseAnswer({ currentTarget: { dataset: { option: 'c' } } });
      assert.equal(page.data.selectedOption, 'c'); assert.ok(page.data.warning);
      wxMock.setStorageSync = originalWrite;
      page.retrySave();
      assert.equal(page.data.warning, '');
      assert.equal(profileCondition(warningCondition, page.data), false);
      assert.equal(device.get('pathai.frontend.session.v1').session.answers[baseQuestions[0].id], 'c');
    } finally { wxMock.setStorageSync = originalWrite; }
  });
  await check('profile with wx read failure explains recovery and can start a new session', () => {
    const originalRead = wxMock.getStorageSync;
    const originalSnapshot = sessionStore.snapshot;
    const originalStart = sessionStore.start;
    try {
      wxMock.getStorageSync = () => { throw new Error('simulated device read failure'); };
      const isolated = createSessionStore(load('utils/storage').localStorage);
      sessionStore.snapshot = isolated.snapshot;
      sessionStore.start = isolated.start;
      const page = mountPage('pages/profile/profile'); page.onShow();
      assert.equal(page.data.ready, false); assert.match(page.data.warning, /无法读取本地记录/);
      page.start();
      assert.equal(page.data.ready, true); assert.equal(page.data.warning, '');
      assert.equal(page.data.question.id, baseQuestions[0].id);
    } finally {
      wxMock.getStorageSync = originalRead;
      sessionStore.snapshot = originalSnapshot;
      sessionStore.start = originalStart;
    }
  });
  await check('result guard, preview has no session side effects, normal result marks progress', async () => {
    sessionStore.clear();
    const page = mountPage('pages/initial-result/initial-result'); page.onLoad({});
    await page.loadRecommendation(); assert.equal(page.data.needsProfile, true);
    page.onLoad({ preview: '1' }); await page.loadRecommendation();
    assert.equal(page.data.cards.length, 3); assert.equal(sessionStore.snapshot().session, null);
    complete(sessionStore); completeFollowup(sessionStore); page.onLoad({}); await page.loadRecommendation();
    assert.equal(sessionStore.snapshot().session.stage, 'initial-result');
  });
  await check('hidden/stale result requests cannot overwrite the page or mark a new session', async () => {
    const page = mountPage('pages/initial-result/initial-result'); page.onLoad({});
    const original = frontendService.getInitialRecommendation;
    let resolve;
    frontendService.getInitialRecommendation = () => new Promise((done) => { resolve = done; });
    const pending = page.loadRecommendation(); page.onHide();
    resolve(await original()); await pending; assert.equal(page.data.cards.length, 0);
    const pendingNew = page.loadRecommendation(); sessionStore.start();
    resolve(await original()); await pendingNew;
    assert.equal(page.data.needsProfile, true); assert.equal(sessionStore.snapshot().session.stage, 'profile');
    frontendService.getInitialRecommendation = original;
  });
  await check('two followup rounds persist drafts, reject skips/duplicates, invalidate on edit', async () => {
    const store = createSessionStore(storage); complete(store);
    assert.equal(store.markRecommendation(store.snapshot().session.revision), false);
    assert.throws(() => store.setFollowupDraft(1, 'skip'));
    store.setFollowupDraft(0, 'first');
    const revision = store.snapshot().session.revision;
    assert.equal(store.submitFollowupRound(0, revision), true);
    assert.equal(store.submitFollowupRound(0, revision), false);
    const restored = createSessionStore(storage); assert.equal(restored.snapshot().session.followup.round, 1);
    assert.equal(restored.snapshot().session.followup.drafts[0], 'first');
    restored.setFollowupDraft(1, 'second'); restored.submitFollowupRound(1, restored.snapshot().session.revision);
    assert.equal(restored.snapshot().session.followup.submittedCount, 2);
    assert.equal(restored.submitFollowupRound(2, restored.snapshot().session.revision), false);
    restored.editFollowup(0); restored.setFollowupDraft(0, 'changed');
    assert.equal(restored.snapshot().session.followup.submittedCount, 0);
    assert.equal(restored.markRecommendation(restored.snapshot().session.revision), false);
    for (const scenario of ['normal','empty','error','timeout','degraded']) {
      const response = await frontendService.getFollowup(0, scenario);
      assert.equal(response.status, scenario === 'error' ? 'error' : scenario === 'timeout' || scenario === 'degraded' ? 'degraded' : 'success');
      if (scenario === 'normal') assert.match(response.data.localId, /^ui-/);
      if (scenario === 'empty') assert.equal(response.data, null);
    }
    assert.equal((await frontendService.getFollowup(2)).status, 'error');
  });
  await check('profile -> two followup pages -> recommendation navigation with no bypass', async () => {
    complete(sessionStore); pages = [];
    const profile = mountPage('pages/profile/profile'); profile.onShow(); profile.submit();
    assert.equal(navigations.at(-1)[1].url, '/pages/followup/followup');
    const followup = mountPage('pages/followup/followup'); await followup.loadQuestion();
    followup.submit(); assert.match(followup.data.validation, /填写/);
    followup.input({ detail: { value: '我的第一轮回答' } }); followup.submit();
    await followup.loadQuestion(); assert.equal(followup.data.round, 1);
    followup.input({ detail: { value: '我的第二轮回答' } }); followup.submit();
    assert.equal(navigations.at(-1)[1].url, '/pages/initial-result/initial-result');
    const result = mountPage('pages/initial-result/initial-result'); result.onLoad({}); await result.loadRecommendation();
    assert.equal(result.data.cards.length, 3);
    sessionStore.updateProfile('goal', goals[1].id);
    await result.loadRecommendation(); assert.equal(result.data.needsProfile, true);
  });
  await check('three scoped trials, fictional compact materials, known dimensions, no scores/Rubric', async () => {
    const { workTrials } = load('mocks/work-trials');
    assert.equal(workTrials.length, 3);
    assert.deepEqual(workTrials.map((item) => item.roleName), ['数据分析','产品运营','用户研究']);
    assert.equal(new Set(workTrials.map((item) => item.localId)).size, 3);
    for (const definition of workTrials) {
      assert.equal(definition.durationSeconds, 240); assert.equal(definition.fields.length, 3);
      assert.ok(definition.materials.map((item) => item.content).join('').length < 320);
      const result = (await frontendService.submitTrial(definition.localId)).data;
      assert.equal(result.source, 'mock'); assert.match(result.notice, /非真实 AI/);
      assert.ok(result.exampleAnswer.startsWith('示例作答'));
      assert.equal(/"(?:score|weight|rubric|maxScore)"/i.test(JSON.stringify({ definition, result })), false);
      for (const item of result.evidence) assert.ok(item.exampleEvidence && item.improvement);
      assert.equal((await frontendService.getTrial(definition.localRoleId)).data.localId, definition.localId);
    }
    assert.equal((await frontendService.getTrial('unknown')).status, 'error');
    assert.equal((await frontendService.submitTrial('unknown')).status, 'error');
  });
  await check('trial store restores drafts, rejects stale/duplicate/invalid results, invalidates after edits', async () => {
    const { workTrials } = load('mocks/work-trials');
    const definition = workTrials[0];
    const store = createSessionStore(storage); complete(store);
    assert.equal(store.startTrial(definition.localId), false);
    completeFollowup(store); assert.equal(store.startTrial(definition.localId), true);
    for (const field of definition.fields) store.updateTrialAnswer(field.localId, '我的本地回答');
    const captured = store.snapshot().session;
    const result = (await frontendService.submitTrial(definition.localId)).data;
    const save = (value = result) => store.saveTrialResult(definition.localId, captured.trial.revision, captured.localId, captured.revision, value, 'success', '');
    assert.equal(save({ ...result, evidence: [{ ...result.evidence[0], exampleEvidence: '' }] }), false);
    assert.equal(save(), true); assert.equal(save(), false);
    const restored = createSessionStore(storage); assert.equal(restored.snapshot().session.trial.completed, true);
    assert.equal(restored.snapshot().session.trial.answers[definition.fields[0].localId], '我的本地回答');
    store.updateTrialAnswer(definition.fields[0].localId, '修改'); assert.equal(store.snapshot().session.trial.result, null);
    assert.equal(save(), false);
    store.startTrial(definition.localId, true); assert.deepEqual(store.snapshot().session.trial.answers, {});
    assert.equal(save(), false);
    store.setFollowupDraft(0, '修改追问'); assert.equal(store.snapshot().session.trial, undefined);
    assert.throws(() => store.updateTrialAnswer('unknown', 'wrong'));
  });
  await check('three complete page flows end in labeled Mock evidence and stop countdown timers', async () => {
    for (const option of frontendService.getTrialOptions()) {
      complete(sessionStore); completeFollowup(sessionStore); pages = [];
      const page = mountPage('pages/work-trial/work-trial'); page.onLoad({ role: option.localRoleId });
      page.visible = true; await page.loadTrial(); assert.equal(page.data.ready, true);
      page.start(); assert.equal(page.data.started, true); assert.ok(page.timer !== null);
      await page.submit(); assert.match(page.data.validation, /填写/);
      for (const field of page.data.definition.fields) page.input({ currentTarget: { dataset: { field: field.localId } }, detail: { value: '与固定示例完全不同的我的回答' } });
      await page.submit(); assert.equal(page.data.completed, true); assert.equal(page.timer, null);
      assert.equal(navigations.at(-1)[1].url, '/pages/trial-result/trial-result');
      const result = mountPage('pages/trial-result/trial-result'); result.onShow();
      assert.equal(result.data.result.roleName, option.roleName);
      assert.equal(JSON.stringify(result.data.result).includes('与固定示例完全不同'), false);
      page.onHide(); assert.equal(page.timer, null);
    }
    assert.equal(intervals.size, 0);
  });
  await check('trial load/submit empty error degraded timeout preserve drafts and return fixed fallback', async () => {
    for (const scenario of ['empty','error','degraded','timeout']) {
      const loaded = await frontendService.getTrial('ui-data', scenario);
      assert.equal(loaded.status, scenario === 'error' ? 'error' : scenario === 'empty' ? 'success' : 'degraded');
      if (scenario === 'empty') assert.equal(loaded.data, null);
      complete(sessionStore); completeFollowup(sessionStore);
      const page = mountPage('pages/work-trial/work-trial'); page.onLoad({ role: 'ui-data' }); await page.loadTrial(); page.start();
      for (const field of page.data.definition.fields) page.input({ currentTarget: { dataset: { field: field.localId } }, detail: { value: '保留的草稿' } });
      page.setData({ scenario }); await page.submit();
      assert.equal(sessionStore.snapshot().session.trial.answers['ui-anomaly'], '保留的草稿');
      if (scenario === 'empty' || scenario === 'error') {
        assert.ok(page.data.submissionError); assert.equal(page.data.completed, false);
        page.setData({ scenario: 'normal' }); await page.submit(); assert.equal(page.data.completed, true);
      } else {
        assert.equal(sessionStore.snapshot().session.trial.resultStatus, 'degraded');
        assert.ok(sessionStore.snapshot().session.trial.message);
      }
      page.onHide();
    }
    assert.ok(delays.includes(15000));
  });
  await check('trial duplicate clicks, hidden responses and session restart cannot save stale results', async () => {
    complete(sessionStore); completeFollowup(sessionStore);
    const page = mountPage('pages/work-trial/work-trial'); page.onLoad({ role: 'ui-data' }); await page.loadTrial(); page.start();
    for (const field of page.data.definition.fields) page.input({ currentTarget: { dataset: { field: field.localId } }, detail: { value: '回答' } });
    const original = frontendService.submitTrial; let resolve; let count = 0;
    frontendService.submitTrial = () => { count++; return new Promise((done) => { resolve = done; }); };
    try {
      const first = page.submit(); await page.submit(); assert.equal(count, 1);
      page.onHide(); resolve(await original(page.data.definition.localId)); await first;
      assert.equal(sessionStore.snapshot().session.trial.completed, false);
      await page.loadTrial();
      const second = page.submit(); sessionStore.startTrial(page.data.definition.localId, true);
      resolve(await original(page.data.definition.localId)); await second;
      assert.equal(sessionStore.snapshot().session.trial.completed, false); assert.ok(page.data.submissionError);
    } finally { frontendService.submitTrial = original; page.onUnload(); }
  });
  await check('wall-clock countdown survives background, clamps at zero without clearing answers', () => {
    const { trialClock } = load('utils/trial-clock');
    assert.equal(trialClock(1000, 240, 1000).label, '4:00');
    assert.equal(trialClock(1000, 240, 121000).label, '2:00');
    assert.equal(trialClock(1000, 240, 500000).label, '0:00');
    assert.equal(trialClock(1000, 240, 500000).expired, true);
    assert.equal(trialClock(1000, 240, 0).progress, 0);
    const session = sessionStore.snapshot().session;
    session.trial.startedAt = Date.now() - 300000;
    device.set('pathai.frontend.session.v1', { version: 1, session });
    const restored = createSessionStore(load('utils/storage').localStorage).snapshot().session;
    assert.ok(restored.trial); assert.equal(trialClock(restored.trial.startedAt, 240).expired, true);
  });
  await check('phase-1 cache migrates without losing base answers or permitting followup bypass', () => {
    const store = createSessionStore(storage); complete(store);
    const old = store.snapshot().session; delete old.followup; delete old.trial; old.stage = 'initial-result';
    memory.set('pathai.frontend.session.v1', { version: 1, session: old });
    const migrated = createSessionStore(storage); const session = migrated.snapshot().session;
    assert.equal(session.stage, 'followup'); assert.equal(Object.keys(session.answers).length, 8);
    assert.deepEqual(session.followup.drafts, ['', '']);
    assert.equal(migrated.markRecommendation(session.revision), false);
    for (const followup of [{ drafts: ['bad'], round: 0, submittedCount: 0 }, { drafts: ['', ''], round: 0, submittedCount: 2 }]) {
      const invalid = createSessionStore({ ...storage, read: () => ({ version: 1, session: { ...old, followup } }) });
      assert.equal(invalid.snapshot().session, null); assert.ok(invalid.snapshot().warning);
    }
  });
  await check('followup page error/empty/degraded/timeout branches retry and reject hidden requests', async () => {
    complete(sessionStore);
    const page = mountPage('pages/followup/followup');
    for (const scenario of ['empty','error','degraded','timeout']) {
      page.setData({ scenario }); await page.loadQuestion();
      assert.equal(page.data.loading, false);
      if (scenario === 'empty') assert.equal(page.data.question, null);
      else if (scenario === 'error') assert.ok(page.data.error);
      else { assert.ok(page.data.message); assert.ok(page.data.question); }
    }
    page.setData({ scenario: 'normal' }); await page.loadQuestion();
    page.input({ detail: { value: '追问草稿' } });
    const original = frontendService.getFollowup; let resolve;
    frontendService.getFollowup = () => new Promise((done) => { resolve = done; });
    try {
      const pending = page.loadQuestion(); page.onHide(); resolve(await original(0)); await pending;
      assert.equal(page.data.question, null); assert.equal(sessionStore.snapshot().session.followup.drafts[0], '追问草稿');
    } finally { frontendService.getFollowup = original; }
    await page.loadQuestion(); assert.equal(page.data.answer, '追问草稿');
    page.submit(); await page.loadQuestion(); page.input({ detail: { value: '第二轮草稿' } });
    page.submit(); await page.loadQuestion(); assert.equal(page.data.completed, true);
    page.edit(); await page.loadQuestion(); assert.equal(page.data.round, 0); assert.equal(page.data.canNextSaved, true);
    page.submit(); assert.equal(navigations.at(-1)[1].url, '/pages/initial-result/initial-result');
  });
  await check('followup and trial storage failures remain visible without losing current drafts', async () => {
    complete(sessionStore);
    const followup = mountPage('pages/followup/followup'); await followup.loadQuestion();
    const originalWrite = wxMock.setStorageSync;
    try {
      wxMock.setStorageSync = () => { throw new Error('quota'); };
      followup.input({ detail: { value: '仅内存保留的追问' } }); assert.match(followup.data.warning, /本地保存失败/);
      wxMock.setStorageSync = originalWrite; followup.retrySave(); assert.equal(followup.data.warning, '');
      completeFollowup(sessionStore);
      const trial = mountPage('pages/work-trial/work-trial'); trial.onLoad({ role: 'ui-research' }); await trial.loadTrial(); trial.start();
      wxMock.setStorageSync = () => { throw new Error('quota'); };
      for (const field of trial.data.definition.fields) trial.input({ currentTarget: { dataset: { field: field.localId } }, detail: { value: '仅内存保留的試岗回答' } });
      assert.match(trial.data.warning, /本地保存失败/); await trial.submit(); assert.equal(trial.data.completed, true);
      const result = mountPage('pages/trial-result/trial-result'); result.onShow(); assert.ok(result.data.warning); assert.ok(result.data.result);
      wxMock.setStorageSync = originalWrite; result.retrySave(); assert.equal(result.data.warning, ''); trial.onUnload();
    } finally { wxMock.setStorageSync = originalWrite; }
  });
  assert.equal(intervals.size, 0, 'All countdown intervals must be stopped');
  console.log(`\n${checks} logic groups passed. wx and timers are mocked; no UI or real cloud validation claimed.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
