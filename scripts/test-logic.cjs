const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const ts = require("typescript");
const root = path.resolve(__dirname, "..", "miniprogram");
const modules = new Map();
const device = new Map();
const delays = [];
let realTimers = false;
const intervals = new Map();
let nextInterval = 1;
const pageDefinitions = new Map();
let pages = [];
const navigations = [];
const wxMock = {
  getStorageSync: (key) => (device.has(key) ? device.get(key) : ""),
  setStorageSync: (key, value) => device.set(key, structuredClone(value)),
  removeStorageSync: (key) => device.delete(key),
  navigateTo: (options) => navigations.push(["navigateTo", options]),
  redirectTo: (options) => navigations.push(["redirectTo", options]),
  navigateBack: (options) => navigations.push(["navigateBack", options]),
  showToast() {},
  showModal() {},
};
function load(file) {
  const filename = path.resolve(root, file.endsWith(".ts") ? file : `${file}.ts`);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
  }).outputText;
  const requireLocal = (name) =>
    load(path.relative(root, path.resolve(path.dirname(filename), name)));
  // The tests run TS in memory; no emitted JS files enter the mini program.
  new Function(
    "require",
    "module",
    "exports",
    "wx",
    "setTimeout",
    "Page",
    "getCurrentPages",
    "setInterval",
    "clearInterval",
    "clearTimeout",
    code,
  )(
    requireLocal,
    module,
    module.exports,
    wxMock,
    (callback, delay) => {
      delays.push(delay);
      if (realTimers) return setTimeout(callback, delay);
      callback();
      return 0;
    },
    (definition) => {
      pageDefinitions.set(filename, definition);
    },
    () => pages,
    (callback) => {
      const id = nextInterval++;
      intervals.set(id, callback);
      return id;
    },
    (id) => intervals.delete(id),
    clearTimeout,
  );
  return module.exports;
}
function mountPage(file) {
  load(file);
  const definition = pageDefinitions.get(path.resolve(root, `${file}.ts`));
  return {
    ...definition,
    data: structuredClone(definition.data),
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
}
function profileCondition(value, data) {
  // A literal WXML attribute is a string, not a data binding.
  const binding = /^\{\{\s*(!?)(\w+)\s*\}\}$/.exec(value);
  if (!binding) return Boolean(value);
  return binding[1] === "!" ? !data[binding[2]] : Boolean(data[binding[2]]);
}
let checks = 0;
async function check(name, run) {
  await run();
  checks++;
  console.log(`PASS: ${name}`);
}
async function main() {
  const { createSessionStore, isProfileComplete, sessionStore } = load("store/session");
  const { baseQuestions, currentStates, goals, preferences } = load("mocks/base-questions");
  const memory = new Map();
  const storage = {
    read: (key) => memory.get(key),
    write: (key, value) => memory.set(key, structuredClone(value)),
    remove: (key) => memory.delete(key),
  };
  function complete(store) {
    store.start();
    store.updateProfile("currentState", currentStates[0].id);
    store.updateProfile("goal", goals[0].id);
    store.updateProfile("preference", preferences[0].id);
    for (const question of baseQuestions) store.answer(question.id, question.options[0].id);
  }
  function completeFollowup(store) {
    store.enterFollowup();
    for (let round = 0; round < 2; round++) {
      store.setFollowupDraft(round, `预设追问回答 ${round + 1}`);
      assert.equal(store.submitFollowupRound(round, store.snapshot().session.revision), true);
    }
  }
  await check("8 draft questions, unique IDs, no scoring fields", () => {
    assert.equal(baseQuestions.length, 8);
    assert.equal(new Set(baseQuestions.map((question) => question.id)).size, 8);
    for (const question of baseQuestions) {
      assert.deepEqual(Object.keys(question).sort(), ["context", "id", "options", "title"]);
      assert.equal(
        new Set(question.options.map((option) => option.id)).size,
        question.options.length,
      );
      for (const option of question.options)
        assert.deepEqual(Object.keys(option).sort(), ["id", "label"]);
    }
  });
  await check("fresh start, completion validation, progress survives a new store", () => {
    const store = createSessionStore(storage);
    assert.equal(store.snapshot().session, null);
    store.start();
    assert.equal(isProfileComplete(store.snapshot().session), false);
    complete(store);
    store.moveTo(6);
    const restored = createSessionStore(storage).snapshot().session;
    assert.equal(restored.questionIndex, 6);
    assert.equal(Object.keys(restored.answers).length, 8);
    assert.equal(isProfileComplete(restored), true);
  });
  await check(
    "answer/profile edits invalidate result; stale revisions rejected; snapshots isolated",
    () => {
      const store = createSessionStore(storage);
      completeFollowup(store);
      const before = store.snapshot().session;
      assert.equal(store.markRecommendation(before.revision), true);
      store.answer(baseQuestions[0].id, "b");
      assert.equal(store.snapshot().session.stage, "profile");
      assert.equal(store.markRecommendation(before.revision), false);
      const snapshot = store.snapshot().session;
      snapshot.answers[baseQuestions[0].id] = "c";
      assert.equal(store.snapshot().session.answers[baseQuestions[0].id], "b");
      store.markRecommendation(store.snapshot().session.revision);
      store.updateProfile("goal", goals[1].id);
      assert.equal(store.snapshot().session.stage, "profile");
      assert.throws(() => store.answer("unknown", "a"));
      assert.throws(() => store.moveTo(8));
      assert.throws(() => store.updateProfile("goal", "unknown"));
    },
  );
  await check("corrupt/version-mismatched cache is rejected without crashing", () => {
    for (const raw of [
      { version: 99 },
      { version: 1, session: {} },
      {
        version: 1,
        session: { ...createSessionStore(storage).snapshot().session, questionIndex: 999 },
      },
    ]) {
      const store = createSessionStore({ ...storage, read: () => raw });
      assert.equal(store.snapshot().session, null);
      assert.ok(store.snapshot().warning);
    }
  });
  await check(
    "storage failures preserve memory, expose warning, retry and delete correctly",
    () => {
      let failWrite = true;
      let failRemove = true;
      const store = createSessionStore({
        ...storage,
        write: (...args) => {
          if (failWrite) throw new Error("quota");
          storage.write(...args);
        },
        remove: (...args) => {
          if (failRemove) throw new Error("storage");
          storage.remove(...args);
        },
      });
      store.start();
      assert.ok(store.snapshot().warning);
      assert.ok(store.snapshot().session);
      failWrite = false;
      store.retrySave();
      assert.equal(store.snapshot().warning, "");
      assert.equal(store.clear(), false);
      assert.ok(store.snapshot().session);
      failRemove = false;
      assert.equal(store.clear(), true);
      assert.equal(store.snapshot().session, null);
      assert.equal(createSessionStore(storage).snapshot().session, null);
      const unreadable = createSessionStore({
        ...storage,
        read: () => {
          throw new Error("read");
        },
      });
      assert.ok(unreadable.snapshot().warning);
      assert.equal(unreadable.snapshot().session, null);
    },
  );
  const { frontendService } = load("services/index");
  await check(
    "Mock returns exactly 3 fixed roles and fresh data, independent of answers",
    async () => {
      const first = await frontendService.getInitialRecommendation();
      assert.equal(first.status, "success");
      assert.equal(first.data.source, "mock");
      assert.match(first.data.notice, /非真实 AI/);
      assert.equal(first.data.cards.length, 3);
      assert.deepEqual(
        first.data.cards.map((card) => card.name),
        ["数据分析", "用户研究", "产品运营"],
      );
      first.data.cards[0].name = "modified";
      const second = await frontendService.getInitialRecommendation();
      assert.equal(second.data.cards[0].name, "数据分析");
      assert.equal(
        second.data.cards.some((card) => "score" in card),
        false,
      );
    },
  );
  await check(
    "Mock empty/error/degraded/timeout paths; timeout configured to 15000ms",
    async () => {
      assert.equal((await frontendService.getInitialRecommendation("empty")).data.cards.length, 0);
      assert.equal((await frontendService.getInitialRecommendation("error")).status, "error");
      assert.equal((await frontendService.getInitialRecommendation("degraded")).status, "degraded");
      assert.equal((await frontendService.getInitialRecommendation("timeout")).status, "degraded");
      assert.equal(delays.at(-1), 15000); // Timer replaced in Node, not a real DevTools latency check.
    },
  );
  await check("navigation reuses existing pages and avoids stack overflow", () => {
    const { navigate, routes } = load("utils/navigation");
    pages = [
      { route: "pages/home/index" },
      { route: "pages/profile/profile" },
      { route: "pages/initial-result/initial-result" },
    ];
    navigate(routes.profile);
    assert.equal(navigations.at(-1)[0], "navigateBack");
    assert.equal(navigations.at(-1)[1].delta, 1);
    pages = Array.from({ length: 9 }, (_, i) => ({ route: `other/${i}` }));
    navigate(routes.workTrial);
    assert.equal(navigations.at(-1)[0], "redirectTo");
    pages = [];
    navigate(routes.profile);
    assert.equal(navigations.at(-1)[0], "navigateTo");
  });
  await check(
    "profile page validates required choices and directs user to unanswered question",
    () => {
      sessionStore.clear();
      sessionStore.start();
      const page = mountPage("pages/profile/profile");
      page.onShow();
      page.submit();
      assert.match(page.data.validation, /全部 8/);
      page.next();
      assert.match(page.data.validation, /先选择/);
      page.chooseAnswer({ currentTarget: { dataset: { option: "a" } } });
      page.next();
      assert.equal(page.data.questionIndex, 1);
      page.previous();
      assert.equal(page.data.selectedOption, "a");
    },
  );
  await check(
    "profile start tap exits the empty WXML branch and exposes the first question",
    () => {
      sessionStore.clear();
      const page = mountPage("pages/profile/profile");
      const markup = fs.readFileSync(path.join(root, "pages/profile/profile.wxml"), "utf8");
      const emptyBranch = /<block wx:if="([^"]+)"/.exec(markup)[1];
      const handler = /bindtap="([^"]+)">开始新的本地体验/.exec(markup)[1];
      page.onShow();
      assert.equal(profileCondition(emptyBranch, page.data), true);
      assert.equal(typeof page[handler], "function");
      page[handler]();
      assert.equal(page.data.ready, true);
      assert.equal(
        profileCondition(emptyBranch, page.data),
        false,
        "Start button must disappear when the session is ready",
      );
      assert.deepEqual(page.data.profile, { currentState: "", goal: "", preference: "" });
      assert.equal(page.data.question.id, baseQuestions[0].id);
      assert.equal(page.data.total, 8);
      page.chooseProfile({ currentTarget: { dataset: { field: "goal", value: goals[0].id } } });
      page.chooseAnswer({ currentTarget: { dataset: { option: "a" } } });
      assert.equal(page.data.profile.goal, goals[0].id);
      assert.equal(page.data.selectedOption, "a");
      page.next();
      assert.equal(page.data.questionIndex, 1);
      page.start();
      assert.equal(page.data.questionIndex, 0);
      assert.equal(page.data.answeredCount, 0);
      assert.equal(page.data.selectedOption, "");
      assert.equal(profileCondition(emptyBranch, page.data), false);
    },
  );
  await check(
    "home start opens a ready profile and re-entering restores the question",
    async () => {
      sessionStore.clear();
      pages = [];
      const home = mountPage("pages/home/index");
      home.onShow();
      await home.start();
      assert.equal(navigations.at(-1)[1].url, "/pages/profile/profile");
      const page = mountPage("pages/profile/profile");
      page.onShow();
      assert.equal(page.data.ready, true);
      page.chooseAnswer({ currentTarget: { dataset: { option: "b" } } });
      page.next();
      const returned = mountPage("pages/profile/profile");
      returned.onShow();
      assert.equal(returned.data.ready, true);
      assert.equal(returned.data.questionIndex, 1);
      returned.previous();
      assert.equal(returned.data.selectedOption, "b");
    },
  );
  await check(
    "profile start with wx storage failure still opens questions and renders a retry warning",
    () => {
      sessionStore.clear();
      const page = mountPage("pages/profile/profile");
      page.onShow();
      const originalWrite = wxMock.setStorageSync;
      try {
        wxMock.setStorageSync = () => {
          throw new Error("simulated device quota");
        };
        page.start();
        assert.equal(page.data.ready, true);
        assert.equal(page.data.question.id, baseQuestions[0].id);
        assert.match(page.data.warning, /本地保存失败/);
        const markup = fs.readFileSync(path.join(root, "pages/profile/profile.wxml"), "utf8");
        const warningCondition = /<view wx:if="([^"]+)" class="error">\{\{warning\}\}/.exec(
          markup,
        )[1];
        assert.equal(profileCondition(warningCondition, page.data), true);
        assert.match(markup, /bindtap="retrySave">重试保存/);
        page.chooseAnswer({ currentTarget: { dataset: { option: "c" } } });
        assert.equal(page.data.selectedOption, "c");
        assert.ok(page.data.warning);
        wxMock.setStorageSync = originalWrite;
        page.retrySave();
        assert.equal(page.data.warning, "");
        assert.equal(profileCondition(warningCondition, page.data), false);
        assert.equal(
          device.get("pathai.frontend.session.v2").session.answers[baseQuestions[0].id],
          "c",
        );
      } finally {
        wxMock.setStorageSync = originalWrite;
      }
    },
  );
  await check("profile with wx read failure explains recovery and can start a new session", () => {
    const originalRead = wxMock.getStorageSync;
    const originalSnapshot = sessionStore.snapshot;
    const originalStart = sessionStore.start;
    try {
      wxMock.getStorageSync = () => {
        throw new Error("simulated device read failure");
      };
      const isolated = createSessionStore(load("utils/storage").localStorage);
      sessionStore.snapshot = isolated.snapshot;
      sessionStore.start = isolated.start;
      const page = mountPage("pages/profile/profile");
      page.onShow();
      assert.equal(page.data.ready, false);
      assert.match(page.data.warning, /无法读取本地记录/);
      page.start();
      assert.equal(page.data.ready, true);
      assert.equal(page.data.warning, "");
      assert.equal(page.data.question.id, baseQuestions[0].id);
    } finally {
      wxMock.getStorageSync = originalRead;
      sessionStore.snapshot = originalSnapshot;
      sessionStore.start = originalStart;
    }
  });
  await check(
    "result guard, preview has no session side effects, normal result marks progress",
    async () => {
      sessionStore.clear();
      const page = mountPage("pages/initial-result/initial-result");
      page.onLoad({});
      await page.loadRecommendation();
      assert.equal(page.data.needsProfile, true);
      page.onLoad({ preview: "1" });
      await page.loadRecommendation();
      assert.equal(page.data.cards.length, 3);
      assert.equal(sessionStore.snapshot().session, null);
      complete(sessionStore);
      completeFollowup(sessionStore);
      page.onLoad({});
      await page.loadRecommendation();
      assert.equal(sessionStore.snapshot().session.stage, "initial-result");
    },
  );
  await check(
    "hidden/stale result requests cannot overwrite the page or mark a new session",
    async () => {
      const page = mountPage("pages/initial-result/initial-result");
      page.onLoad({});
      const original = frontendService.getInitialRecommendation;
      let resolve;
      frontendService.getInitialRecommendation = () =>
        new Promise((done) => {
          resolve = done;
        });
      const pending = page.loadRecommendation();
      page.onHide();
      resolve(await original());
      await pending;
      assert.equal(page.data.cards.length, 0);
      const pendingNew = page.loadRecommendation();
      sessionStore.start();
      resolve(await original());
      await pendingNew;
      assert.equal(page.data.needsProfile, true);
      assert.equal(sessionStore.snapshot().session.stage, "profile");
      frontendService.getInitialRecommendation = original;
    },
  );
  await check(
    "two followup rounds persist drafts, reject skips/duplicates, invalidate on edit",
    async () => {
      const store = createSessionStore(storage);
      complete(store);
      assert.equal(store.markRecommendation(store.snapshot().session.revision), false);
      assert.throws(() => store.setFollowupDraft(1, "skip"));
      store.setFollowupDraft(0, "first");
      const revision = store.snapshot().session.revision;
      assert.equal(store.submitFollowupRound(0, revision), true);
      assert.equal(store.submitFollowupRound(0, revision), false);
      const restored = createSessionStore(storage);
      assert.equal(restored.snapshot().session.followup.round, 1);
      assert.equal(restored.snapshot().session.followup.drafts[0], "first");
      restored.setFollowupDraft(1, "second");
      restored.submitFollowupRound(1, restored.snapshot().session.revision);
      assert.equal(restored.snapshot().session.followup.submittedCount, 2);
      assert.equal(restored.submitFollowupRound(2, restored.snapshot().session.revision), false);
      restored.editFollowup(0);
      restored.setFollowupDraft(0, "changed");
      assert.equal(restored.snapshot().session.followup.submittedCount, 0);
      assert.equal(restored.markRecommendation(restored.snapshot().session.revision), false);
      for (const scenario of ["normal", "empty", "error", "timeout", "degraded"]) {
        const response = await frontendService.getFollowup(0, scenario);
        assert.equal(
          response.status,
          scenario === "error"
            ? "error"
            : scenario === "timeout" || scenario === "degraded"
              ? "degraded"
              : "success",
        );
        if (scenario === "normal") assert.match(response.data.localId, /^ui-/);
        if (scenario === "empty") assert.equal(response.data, null);
      }
      assert.equal((await frontendService.getFollowup(2)).status, "error");
    },
  );
  await check(
    "profile -> two followup pages -> recommendation navigation with no bypass",
    async () => {
      complete(sessionStore);
      pages = [];
      const profile = mountPage("pages/profile/profile");
      profile.onShow();
      profile.submit();
      assert.equal(navigations.at(-1)[1].url, "/pages/followup/followup");
      const followup = mountPage("pages/followup/followup");
      await followup.loadQuestion();
      followup.submit();
      assert.match(followup.data.validation, /填写/);
      followup.input({ detail: { value: "我的第一轮回答" } });
      followup.submit();
      await followup.loadQuestion();
      assert.equal(followup.data.round, 1);
      followup.input({ detail: { value: "我的第二轮回答" } });
      followup.submit();
      assert.equal(navigations.at(-1)[1].url, "/pages/initial-result/initial-result");
      const result = mountPage("pages/initial-result/initial-result");
      result.onLoad({});
      await result.loadRecommendation();
      assert.equal(result.data.cards.length, 3);
      sessionStore.updateProfile("goal", goals[1].id);
      await result.loadRecommendation();
      assert.equal(result.data.needsProfile, true);
    },
  );
  await check(
    "three scoped trials, fictional compact materials, known dimensions, no scores/Rubric",
    async () => {
      const { workTrials } = load("mocks/work-trials");
      assert.equal(workTrials.length, 3);
      assert.deepEqual(
        workTrials.map((item) => item.roleName),
        ["数据分析", "产品运营", "用户研究"],
      );
      assert.equal(new Set(workTrials.map((item) => item.localId)).size, 3);
      for (const definition of workTrials) {
        assert.equal(definition.durationSeconds, 240);
        assert.equal(definition.fields.length, 3);
        assert.ok(definition.materials.map((item) => item.content).join("").length < 320);
        const result = (await frontendService.submitTrial(definition.localId)).data;
        assert.equal(result.source, "mock");
        assert.match(result.notice, /非真实 AI/);
        assert.ok(result.exampleAnswer.startsWith("示例作答"));
        assert.equal(
          /"(?:score|weight|rubric|maxScore)"/i.test(JSON.stringify({ definition, result })),
          false,
        );
        for (const item of result.evidence) assert.ok(item.exampleEvidence && item.improvement);
        assert.equal(
          (await frontendService.getTrial(definition.localRoleId)).data.localId,
          definition.localId,
        );
      }
      assert.equal((await frontendService.getTrial("unknown")).status, "error");
      assert.equal((await frontendService.submitTrial("unknown")).status, "error");
    },
  );
  await check(
    "trial store restores drafts, rejects stale/duplicate/invalid results, invalidates after edits",
    async () => {
      const { workTrials } = load("mocks/work-trials");
      const definition = workTrials[0];
      const store = createSessionStore(storage);
      complete(store);
      assert.equal(store.startTrial(definition.localId), false);
      completeFollowup(store);
      assert.equal(store.startTrial(definition.localId), true);
      for (const field of definition.fields) store.updateTrialAnswer(field.localId, "我的本地回答");
      const captured = store.snapshot().session;
      const result = (await frontendService.submitTrial(definition.localId)).data;
      const save = (value = result) =>
        store.saveTrialResult(
          definition.localId,
          captured.trial.revision,
          captured.localId,
          captured.revision,
          value,
          "success",
          "",
        );
      assert.equal(
        save({ ...result, evidence: [{ ...result.evidence[0], exampleEvidence: "" }] }),
        false,
      );
      assert.equal(save(), true);
      assert.equal(save(), false);
      const restored = createSessionStore(storage);
      assert.equal(restored.snapshot().session.trial.completed, true);
      assert.equal(
        restored.snapshot().session.trial.answers[definition.fields[0].localId],
        "我的本地回答",
      );
      store.updateTrialAnswer(definition.fields[0].localId, "修改");
      assert.equal(store.snapshot().session.trial.result, null);
      assert.equal(save(), false);
      store.startTrial(definition.localId, true);
      assert.deepEqual(store.snapshot().session.trial.answers, {});
      assert.equal(save(), false);
      store.setFollowupDraft(0, "修改追问");
      assert.equal(store.snapshot().session.trial, undefined);
      assert.throws(() => store.updateTrialAnswer("unknown", "wrong"));
    },
  );
  await check(
    "three complete page flows end in labeled Mock evidence and stop countdown timers",
    async () => {
      for (const option of frontendService.getTrialOptions()) {
        complete(sessionStore);
        completeFollowup(sessionStore);
        pages = [];
        const page = mountPage("pages/work-trial/work-trial");
        page.onLoad({ role: option.localRoleId });
        page.visible = true;
        await page.loadTrial();
        assert.equal(page.data.ready, true);
        page.start();
        assert.equal(page.data.started, true);
        assert.ok(page.timer !== null);
        await page.submit();
        assert.match(page.data.validation, /填写/);
        for (const field of page.data.definition.fields)
          page.input({
            currentTarget: { dataset: { field: field.localId } },
            detail: { value: "与固定示例完全不同的我的回答" },
          });
        await page.submit();
        assert.equal(page.data.completed, true);
        assert.equal(page.timer, null);
        assert.equal(navigations.at(-1)[1].url, "/pages/trial-result/trial-result");
        const result = mountPage("pages/trial-result/trial-result");
        result.onShow();
        assert.equal(result.data.result.roleName, option.roleName);
        assert.equal(JSON.stringify(result.data.result).includes("与固定示例完全不同"), false);
        page.onHide();
        assert.equal(page.timer, null);
      }
      assert.equal(intervals.size, 0);
    },
  );
  await check(
    "trial load/submit empty error degraded timeout preserve drafts and return fixed fallback",
    async () => {
      for (const scenario of ["empty", "error", "degraded", "timeout"]) {
        const loaded = await frontendService.getTrial("ui-data", scenario);
        assert.equal(
          loaded.status,
          scenario === "error" ? "error" : scenario === "empty" ? "success" : "degraded",
        );
        if (scenario === "empty") assert.equal(loaded.data, null);
        complete(sessionStore);
        completeFollowup(sessionStore);
        const page = mountPage("pages/work-trial/work-trial");
        page.onLoad({ role: "ui-data" });
        await page.loadTrial();
        page.start();
        for (const field of page.data.definition.fields)
          page.input({
            currentTarget: { dataset: { field: field.localId } },
            detail: { value: "保留的草稿" },
          });
        page.setData({ scenario });
        await page.submit();
        assert.equal(
          sessionStore.snapshot().session.trial.answers[page.data.definition.fields[0].localId],
          "保留的草稿",
        );
        if (scenario === "empty" || scenario === "error") {
          assert.ok(page.data.submissionError);
          assert.equal(page.data.completed, false);
          page.setData({ scenario: "normal" });
          await page.submit();
          assert.equal(page.data.completed, true);
        } else {
          assert.equal(sessionStore.snapshot().session.trial.resultStatus, "degraded");
          assert.ok(sessionStore.snapshot().session.trial.message);
        }
        page.onHide();
      }
      assert.ok(delays.includes(15000));
    },
  );
  await check(
    "trial duplicate clicks, hidden responses and session restart cannot save stale results",
    async () => {
      complete(sessionStore);
      completeFollowup(sessionStore);
      const page = mountPage("pages/work-trial/work-trial");
      page.onLoad({ role: "ui-data" });
      await page.loadTrial();
      page.start();
      for (const field of page.data.definition.fields)
        page.input({
          currentTarget: { dataset: { field: field.localId } },
          detail: { value: "回答" },
        });
      const original = frontendService.submitTrial;
      let resolve;
      let count = 0;
      frontendService.submitTrial = () => {
        count++;
        return new Promise((done) => {
          resolve = done;
        });
      };
      try {
        const first = page.submit();
        await page.submit();
        assert.equal(count, 1);
        page.onHide();
        resolve(await original(page.data.definition.localId));
        await first;
        assert.equal(sessionStore.snapshot().session.trial.completed, false);
        await page.loadTrial();
        const second = page.submit();
        sessionStore.startTrial(page.data.definition.localId, true);
        resolve(await original(page.data.definition.localId));
        await second;
        assert.equal(sessionStore.snapshot().session.trial.completed, false);
        assert.ok(page.data.submissionError);
      } finally {
        frontendService.submitTrial = original;
        page.onUnload();
      }
    },
  );
  await check(
    "wall-clock countdown survives background, clamps at zero without clearing answers",
    () => {
      const { trialClock } = load("utils/trial-clock");
      assert.equal(trialClock(1000, 240, 1000).label, "4:00");
      assert.equal(trialClock(1000, 240, 121000).label, "2:00");
      assert.equal(trialClock(1000, 240, 500000).label, "0:00");
      assert.equal(trialClock(1000, 240, 500000).expired, true);
      assert.equal(trialClock(1000, 240, 0).progress, 0);
      const session = sessionStore.snapshot().session;
      session.trial.startedAt = Date.now() - 300000;
      device.set("pathai.frontend.session.v2", { version: 1, session });
      const restored = createSessionStore(load("utils/storage").localStorage).snapshot().session;
      assert.ok(restored.trial);
      assert.equal(trialClock(restored.trial.startedAt, 240).expired, true);
    },
  );
  await check(
    "phase-1 cache migrates without losing base answers or permitting followup bypass",
    () => {
      const store = createSessionStore(storage);
      complete(store);
      const old = store.snapshot().session;
      delete old.followup;
      delete old.trial;
      old.stage = "initial-result";
      memory.set("pathai.frontend.session.v2", { version: 1, session: old });
      const migrated = createSessionStore(storage);
      const session = migrated.snapshot().session;
      assert.equal(session.stage, "followup");
      assert.equal(Object.keys(session.answers).length, 8);
      assert.deepEqual(session.followup.drafts, ["", ""]);
      assert.equal(migrated.markRecommendation(session.revision), false);
      for (const followup of [
        { drafts: ["bad"], round: 0, submittedCount: 0 },
        { drafts: ["", ""], round: 0, submittedCount: 2 },
      ]) {
        const invalid = createSessionStore({
          ...storage,
          read: () => ({ version: 1, session: { ...old, followup } }),
        });
        assert.equal(invalid.snapshot().session, null);
        assert.ok(invalid.snapshot().warning);
      }
    },
  );
  await check(
    "followup page error/empty/degraded/timeout branches retry and reject hidden requests",
    async () => {
      complete(sessionStore);
      const page = mountPage("pages/followup/followup");
      for (const scenario of ["empty", "error", "degraded", "timeout"]) {
        page.setData({ scenario });
        await page.loadQuestion();
        assert.equal(page.data.loading, false);
        if (scenario === "empty") assert.equal(page.data.question, null);
        else if (scenario === "error") assert.ok(page.data.error);
        else {
          assert.ok(page.data.message);
          assert.ok(page.data.question);
        }
      }
      page.setData({ scenario: "normal" });
      await page.loadQuestion();
      page.input({ detail: { value: "追问草稿" } });
      const original = frontendService.getFollowup;
      let resolve;
      frontendService.getFollowup = () =>
        new Promise((done) => {
          resolve = done;
        });
      try {
        const pending = page.loadQuestion();
        page.onHide();
        resolve(await original(0));
        await pending;
        assert.equal(page.data.question, null);
        assert.equal(sessionStore.snapshot().session.followup.drafts[0], "追问草稿");
      } finally {
        frontendService.getFollowup = original;
      }
      await page.loadQuestion();
      assert.equal(page.data.answer, "追问草稿");
      page.submit();
      await page.loadQuestion();
      page.input({ detail: { value: "第二轮草稿" } });
      page.submit();
      await page.loadQuestion();
      assert.equal(page.data.completed, true);
      page.edit();
      await page.loadQuestion();
      assert.equal(page.data.round, 0);
      assert.equal(page.data.canNextSaved, true);
      page.submit();
      assert.equal(navigations.at(-1)[1].url, "/pages/initial-result/initial-result");
    },
  );
  await check(
    "followup and trial storage failures remain visible without losing current drafts",
    async () => {
      complete(sessionStore);
      const followup = mountPage("pages/followup/followup");
      await followup.loadQuestion();
      const originalWrite = wxMock.setStorageSync;
      try {
        wxMock.setStorageSync = () => {
          throw new Error("quota");
        };
        followup.input({ detail: { value: "仅内存保留的追问" } });
        assert.match(followup.data.warning, /本地保存失败/);
        wxMock.setStorageSync = originalWrite;
        followup.retrySave();
        assert.equal(followup.data.warning, "");
        completeFollowup(sessionStore);
        const trial = mountPage("pages/work-trial/work-trial");
        trial.onLoad({ role: "ui-research" });
        await trial.loadTrial();
        trial.start();
        wxMock.setStorageSync = () => {
          throw new Error("quota");
        };
        for (const field of trial.data.definition.fields)
          trial.input({
            currentTarget: { dataset: { field: field.localId } },
            detail: { value: "仅内存保留的試岗回答" },
          });
        assert.match(trial.data.warning, /本地保存失败/);
        await trial.submit();
        assert.equal(trial.data.completed, true);
        const result = mountPage("pages/trial-result/trial-result");
        result.onShow();
        assert.ok(result.data.warning);
        assert.ok(result.data.result);
        wxMock.setStorageSync = originalWrite;
        result.retrySave();
        assert.equal(result.data.warning, "");
        trial.onUnload();
      } finally {
        wxMock.setStorageSync = originalWrite;
      }
    },
  );
  function finishTrial(store, role = "ui-research") {
    complete(store);
    completeFollowup(store);
    const { workTrials, createTrialResult } = load("mocks/work-trials");
    const definition = workTrials.find((trial) => trial.localRoleId === role);
    store.startTrial(definition.localId);
    for (const field of definition.fields)
      store.updateTrialAnswer(field.localId, "用于流程测试的作答");
    const session = store.snapshot().session;
    assert.equal(
      store.saveTrialResult(
        definition.localId,
        session.trial.revision,
        session.localId,
        session.revision,
        createTrialResult(definition.localId),
        "success",
        "",
      ),
      true,
    );
    return definition;
  }
  await check(
    "three trials show exactly three scripted ranks and six evidence-aware dimensions",
    () => {
      const { mockComparison, dimensionLabels } = load("mocks/next-steps");
      for (const role of ["ui-data", "ui-operations", "ui-research"]) {
        finishTrial(sessionStore, role);
        const result = mountPage("pages/trial-result/trial-result");
        result.onShow();
        assert.equal(result.data.dimensions.length, 6);
        assert.deepEqual(
          result.data.dimensions.map((item) => item.label),
          dimensionLabels,
        );
        assert.equal(result.data.comparison.before.length, 3);
        assert.equal(result.data.comparison.after.length, 3);
        assert.equal(new Set(result.data.comparison.after.map((item) => item.name)).size, 3);
        assert.match(result.data.comparison.explanation, /固定演示/);
        assert.equal(
          result.data.comparison.after[0].name,
          sessionStore.snapshot().session.trial.result.roleName,
        );
        assert.deepEqual(mockComparison(result.data.result), result.data.comparison);
        assert.ok(result.data.dimensions.every((item) => item.evidence && item.improvement));
      }
    },
  );
  await check(
    "seven ordered plan tasks persist per session; snapshots isolated; restart invalidates",
    async () => {
      finishTrial(sessionStore);
      const page = mountPage("pages/action-plan/action-plan");
      await page.load();
      assert.equal(page.data.plan.source, "mock");
      assert.equal(page.data.plan.items.length, 7);
      assert.deepEqual(
        page.data.plan.items.map((item) => item.day),
        [1, 2, 3, 4, 5, 6, 7],
      );
      page.toggle({ currentTarget: { dataset: { day: 1 } } });
      assert.equal(page.data.completedCount, 1);
      page.toggle({ currentTarget: { dataset: { day: 4 } } });
      const restored = createSessionStore(load("utils/storage").localStorage);
      assert.equal(
        restored.snapshot().session.actionPlan.view.items.filter((item) => item.completed).length,
        2,
      );
      const copy = sessionStore.snapshot().session;
      copy.actionPlan.view.items[0].completed = false;
      assert.equal(sessionStore.snapshot().session.actionPlan.view.items[0].completed, true);
      const reentered = mountPage("pages/action-plan/action-plan");
      await reentered.load();
      assert.equal(reentered.data.completedCount, 2);
      const old = sessionStore.snapshot().session;
      sessionStore.startTrial(old.trial.localTrialId, true);
      assert.equal(sessionStore.snapshot().session.actionPlan, undefined);
      assert.equal(
        sessionStore.saveActionPlan(old.localId, old.revision, old.actionPlan.view),
        false,
      );
      sessionStore.start();
      assert.equal(sessionStore.snapshot().session.actionPlan, undefined);
    },
  );
  await check("plan handles empty/error/timeout/degraded/retry and quota failures", async () => {
    const original = wxMock.setStorageSync;
    for (const scenario of ["empty", "error", "timeout", "degraded"]) {
      finishTrial(sessionStore);
      const page = mountPage("pages/action-plan/action-plan");
      page.setData({ scenario });
      await page.load();
      assert.equal(page.data.loading, false);
      if (scenario === "empty" || scenario === "error") {
        assert.ok(page.data.error);
        assert.equal(page.data.plan, null);
        page.setData({ scenario: "normal" });
        await page.load();
        assert.ok(page.data.plan);
      } else {
        assert.ok(page.data.plan);
        assert.ok(page.data.message);
      }
    }
    try {
      wxMock.setStorageSync = () => {
        throw new Error("quota");
      };
      const page = mountPage("pages/action-plan/action-plan");
      page.refresh();
      page.toggle({ currentTarget: { dataset: { day: 1 } } });
      assert.equal(page.data.completedCount, 1);
      assert.ok(page.data.warning);
      wxMock.setStorageSync = original;
      page.retrySave();
      assert.equal(page.data.warning, "");
    } finally {
      wxMock.setStorageSync = original;
    }
  });
  await check(
    "plan rejects duplicate loads, hidden/stale responses and malformed saved plans",
    async () => {
      finishTrial(sessionStore);
      const original = frontendService.getActionPlan;
      let resolve;
      let count = 0;
      frontendService.getActionPlan = () => {
        count++;
        return new Promise((done) => {
          resolve = done;
        });
      };
      try {
        const page = mountPage("pages/action-plan/action-plan");
        const pending = page.load();
        await page.load();
        assert.equal(count, 1);
        page.onHide();
        resolve(await original("用户研究"));
        await pending;
        assert.equal(sessionStore.snapshot().session.actionPlan, undefined);
        const pending2 = page.load();
        sessionStore.start();
        resolve(await original("用户研究"));
        await pending2;
        assert.equal(sessionStore.snapshot().session.actionPlan, undefined);
        assert.ok(page.data.error);
      } finally {
        frontendService.getActionPlan = original;
      }
      finishTrial(sessionStore);
      const page = mountPage("pages/action-plan/action-plan");
      await page.load();
      const raw = structuredClone(device.get("pathai.frontend.session.v2"));
      raw.session.actionPlan.view.items = [];
      const corrupted = createSessionStore({ ...storage, read: () => raw });
      assert.ok(corrupted.snapshot().session.trial.completed);
      assert.equal(corrupted.snapshot().session.actionPlan, undefined);
      assert.ok(corrupted.snapshot().warning);
    },
  );
  const envelope = (data, status = "success") => ({
    status,
    data,
    aiGenerated: false,
    error:
      status === "degraded" ? { code: "AI_UNAVAILABLE", message: "模板", retryable: true } : null,
    contractVersion: "1.0.0",
    configVersion: "1.0.0",
  });
  const credentials = {
    sessionId: `ses_${"a".repeat(32)}`,
    deletionToken: "b".repeat(43),
    progress: "created",
    expiresAt: "2026-10-23T00:00:00.000Z",
  };
  await check(
    "cloud adapter validates versions/status/schema and never exposes raw backend errors",
    async () => {
      realTimers = true;
      const { createCloudAdapter } = load("services/cloud-adapter");
      try {
        for (const invalid of [
          null,
          {},
          { ...envelope(credentials), contractVersion: "2" },
          { ...envelope(credentials), aiGenerated: true },
          envelope({ ...credentials, deletionToken: "" }),
          { ...envelope(credentials), status: "bad" },
          { ...envelope(null, "error"), error: { message: "PRIVATE_RAW_ERROR" } },
        ]) {
          const adapter = createCloudAdapter(async () => invalid, 100);
          const result = await adapter.createSession();
          assert.equal(result.status, "error");
          assert.doesNotMatch(result.message, /PRIVATE_RAW_ERROR/);
        }
        const adapter = createCloudAdapter(async () => envelope(credentials), 100);
        assert.equal((await adapter.createSession()).status, "success");
        const degraded = createCloudAdapter(async () => envelope(credentials, "degraded"), 100);
        assert.equal((await degraded.createSession()).status, "degraded");
      } finally {
        realTimers = false;
      }
    },
  );
  await check(
    "cloud timeout blocks concurrent retries and retains late validated create credentials",
    async () => {
      realTimers = true;
      const { createCloudAdapter } = load("services/cloud-adapter");
      try {
        let resolve;
        let count = 0;
        let saved;
        const adapter = createCloudAdapter(() => {
          count++;
          return new Promise((done) => {
            resolve = done;
          });
        }, 10);
        const pending = adapter.createSession((value) => {
          saved = value;
        });
        assert.equal((await adapter.createSession()).status, "error");
        const result = await pending;
        assert.equal(result.status, "error");
        assert.match(result.message, /15 秒/);
        assert.equal(count, 1);
        assert.equal((await adapter.createSession()).status, "error");
        assert.equal(count, 1);
        resolve(envelope(credentials));
        await new Promise((done) => setTimeout(done, 0));
        assert.deepEqual(saved, credentials);
      } finally {
        realTimers = false;
      }
    },
  );
  await check(
    "cloud requests use B names and payloads; feedback/event privacy and deletion require accepted",
    async () => {
      realTimers = true;
      const { createCloudAdapter } = load("services/cloud-adapter");
      const calls = [];
      try {
        const adapter = createCloudAdapter(async (name, data) => {
          calls.push([name, data]);
          return envelope({ accepted: true });
        }, 100);
        assert.equal(
          (await adapter.submitFeedback(credentials.sessionId, 5, "有帮助")).status,
          "success",
        );
        assert.equal((await adapter.submitFeedback(credentials.sessionId, 0, "")).status, "error");
        assert.equal(
          (await adapter.submitFeedback(credentials.sessionId, 5, "contact@example.com")).status,
          "error",
        );
        assert.equal(
          (await adapter.trackEvent(credentials.sessionId, "page_view", "home")).status,
          "success",
        );
        assert.equal(
          (await adapter.trackEvent(credentials.sessionId, "invalid personal text", "home")).status,
          "error",
        );
        assert.deepEqual(Object.keys(calls[1][1]).sort(), ["eventName", "sessionId", "step"]);
        assert.equal(
          (await adapter.deleteSession(credentials.sessionId, credentials.deletionToken)).status,
          "success",
        );
        assert.deepEqual(calls[2], [
          "deleteSession",
          { sessionId: credentials.sessionId, confirmationToken: credentials.deletionToken },
        ]);
        const denied = createCloudAdapter(async () => envelope({ accepted: false }), 100);
        assert.equal(
          (await denied.deleteSession(credentials.sessionId, credentials.deletionToken)).status,
          "error",
        );
      } finally {
        realTimers = false;
      }
    },
  );
  await check(
    "cloud followup fixed IDs/round and plan schema are checked; missing real gaps block calls",
    async () => {
      realTimers = true;
      const { createCloudAdapter } = load("services/cloud-adapter");
      const { createMockPlan } = load("mocks/next-steps");
      try {
        let sent;
        const adapter = createCloudAdapter(async (name, data) => {
          sent = data;
          return envelope(
            name === "selectFollowup"
              ? {
                  round: data.round,
                  dimension: "user_insight",
                  questionId: "followup_user_01",
                  questionText: "预设追问",
                }
              : {
                  roleId: data.roleId,
                  items: createMockPlan("数据分析").items,
                  personalizedSuggestion: "固定岗位模板",
                },
          );
        }, 100);
        assert.equal(
          (await adapter.selectFollowup(credentials.sessionId, 1, [])).status,
          "success",
        );
        assert.deepEqual(sent.evidenceByDimension, {});
        const gaps = [
          {
            dimension: "user_insight",
            score: 3,
            maxScore: 5,
            evidence: "仅自动化测试的服务端数据样本",
            improvement: "仅测试建议",
          },
        ];
        assert.equal(
          (await adapter.getActionPlan(credentials.sessionId, "data_analyst", gaps)).status,
          "success",
        );
        assert.deepEqual(sent.gaps, gaps);
        const previous = sent;
        assert.equal(
          (await adapter.getActionPlan(credentials.sessionId, "data_analyst", [])).status,
          "error",
        );
        assert.equal(sent, previous);
        const wrongRound = createCloudAdapter(
          async () =>
            envelope({
              round: 2,
              dimension: "user_insight",
              questionId: "q",
              questionText: "text",
            }),
          100,
        );
        assert.equal(
          (await wrongRound.selectFollowup(credentials.sessionId, 1, [])).status,
          "error",
        );
        const empty = createCloudAdapter(
          async () => envelope({ roleId: "data_analyst", items: [], personalizedSuggestion: "x" }),
          100,
        );
        assert.equal(
          (await empty.getActionPlan(credentials.sessionId, "data_analyst", gaps)).status,
          "error",
        );
      } finally {
        realTimers = false;
      }
    },
  );
  await check(
    "cloud session creation protects deletion credentials; delete failure never claims success",
    async () => {
      const { cloudSession } = load("services/cloud-session");
      const { cloudAdapter } = load("services/cloud-adapter");
      const originalCreate = cloudAdapter.createSession;
      const originalDelete = cloudAdapter.deleteSession;
      const originalWrite = wxMock.setStorageSync;
      let creates = 0;
      try {
        sessionStore.start();
        wxMock.setStorageSync = () => {
          throw new Error("quota");
        };
        assert.match(await cloudSession.connect(), /未调用云端/);
        wxMock.setStorageSync = originalWrite;
        cloudAdapter.createSession = async (saved) => {
          creates++;
          saved({ ...credentials, expiresAt: new Date(Date.now() + 86400000).toISOString() });
          return envelope(credentials);
        };
        assert.match(await cloudSession.connect(), /已创建/);
        assert.equal(creates, 1);
        assert.ok(cloudSession.current());
        assert.equal(
          device.get("pathai.cloud.link.v1").session.deletionToken,
          credentials.deletionToken,
        );
        await cloudSession.connect();
        assert.equal(creates, 1);
        cloudAdapter.deleteSession = async () => ({
          status: "error",
          data: null,
          message: "模拟服务不可用",
        });
        assert.match(await cloudSession.remove(), /不可用/);
        assert.ok(cloudSession.current());
        sessionStore.start();
        assert.equal(cloudSession.current(), null);
        assert.equal(cloudSession.status().connected, true);
        cloudAdapter.deleteSession = async () => ({
          status: "success",
          data: { accepted: true },
          message: "",
        });
        assert.match(await cloudSession.remove(), /确认删除成功/);
        assert.equal(cloudSession.status().connected, false);
      } finally {
        cloudAdapter.createSession = originalCreate;
        cloudAdapter.deleteSession = originalDelete;
        wxMock.setStorageSync = originalWrite;
      }
    },
  );
  await check(
    "telemetry requires opt-in, sends minimal idempotent real events and stops on new session",
    async () => {
      const { cloudSession } = load("services/cloud-session");
      const { cloudAdapter } = load("services/cloud-adapter");
      const { telemetry } = load("services/telemetry");
      const originalCreate = cloudAdapter.createSession;
      const originalDelete = cloudAdapter.deleteSession;
      const originalEvent = cloudAdapter.trackFormalEvent;
      const events = [];
      try {
        sessionStore.start();
        assert.equal(telemetry.start(), false);
        cloudAdapter.createSession = async (saved) => {
          saved({ ...credentials, expiresAt: new Date(Date.now() + 86400000).toISOString() });
          return { status: "success", data: credentials, message: "" };
        };
        await cloudSession.connect();
        cloudAdapter.trackFormalEvent = async (...args) => {
          events.push(args);
          return { status: "success", data: { accepted: true }, message: "" };
        };
        sessionStore.updateProfile("goal", goals[0].id);
        assert.equal(events.length, 0);
        assert.equal(telemetry.start(), true);
        await new Promise((done) => setTimeout(done, 0));
        assert.equal(events.length, 1);
        const eventDrafts = device.get("pathai.frontend.events.v2");
        assert.equal(eventDrafts.at(-1).eventName, "session.created");
        assert.equal(eventDrafts.at(-1).mode, "real");
        sessionStore.updateProfile("goal", goals[1].id);
        await new Promise((done) => setTimeout(done, 0));
        assert.equal(events.length, 1);
        sessionStore.start();
        assert.equal(telemetry.status().active, false);
        cloudAdapter.deleteSession = async () => ({
          status: "success",
          data: { accepted: true },
          message: "",
        });
        await cloudSession.remove();
      } finally {
        telemetry.stop();
        cloudAdapter.createSession = originalCreate;
        cloudAdapter.deleteSession = originalDelete;
        cloudAdapter.trackFormalEvent = originalEvent;
      }
    },
  );
  await check("seven-page Mock journey reaches saved plan and home resumes it", async () => {
    sessionStore.clear();
    const home = mountPage("pages/home/index");
    home.onShow();
    await home.start();
    assert.equal(navigations.at(-1)[1].url, "/pages/profile/profile");
    const profile = mountPage("pages/profile/profile");
    profile.onShow();
    for (const [field, choices] of Object.entries({
      currentState: currentStates,
      goal: goals,
      preference: preferences,
    })) {
      profile.chooseProfile({ currentTarget: { dataset: { field, value: choices[0].id } } });
    }
    for (const question of baseQuestions) {
      profile.chooseAnswer({ currentTarget: { dataset: { option: question.options[0].id } } });
      profile.next();
    }
    profile.submit();
    assert.equal(navigations.at(-1)[1].url, "/pages/followup/followup");
    const followup = mountPage("pages/followup/followup");
    for (let round = 0; round < 2; round++) {
      await followup.loadQuestion();
      followup.input({ detail: { value: `完整流程第${round + 1}轮回答` } });
      followup.submit();
    }
    const initial = mountPage("pages/initial-result/initial-result");
    initial.onLoad({});
    await initial.loadRecommendation();
    assert.equal(initial.data.cards.length, 3);
    const trial = mountPage("pages/work-trial/work-trial");
    trial.onLoad({ role: "ui-research" });
    await trial.loadTrial();
    trial.start();
    for (const field of trial.data.definition.fields)
      trial.input({
        currentTarget: { dataset: { field: field.localId } },
        detail: { value: "完整流程试岗回答" },
      });
    await trial.submit();
    assert.equal(navigations.at(-1)[1].url, "/pages/trial-result/trial-result");
    trial.onUnload();
    const result = mountPage("pages/trial-result/trial-result");
    result.onShow();
    assert.ok(result.data.comparison);
    result.plan();
    assert.equal(navigations.at(-1)[1].url, "/pages/action-plan/action-plan");
    const plan = mountPage("pages/action-plan/action-plan");
    await plan.load();
    plan.toggle({ currentTarget: { dataset: { day: 1 } } });
    assert.equal(plan.data.completedCount, 1);
    assert.equal(sessionStore.snapshot().session.stage, "action-plan");
    home.onShow();
    await home.resume();
    assert.equal(navigations.at(-1)[1].url, "/pages/action-plan/action-plan");
    assert.equal(
      createSessionStore(load("utils/storage").localStorage).snapshot().session.actionPlan.view
        .items[0].completed,
      true,
    );
    plan.cloudPlan();
    assert.equal(plan.data.error, "");
  });
  await check(
    "frontend display config matches B question IDs/options and contains no scoring weights",
    () => {
      const seeds = JSON.parse(
        fs.readFileSync(path.resolve(root, "../database/seeds/base_questions.json"), "utf8"),
      );
      assert.deepEqual(
        baseQuestions.map((item) => item.id),
        seeds.questions.map((item) => item.questionId),
      );
      for (let i = 0; i < baseQuestions.length; i++) {
        assert.equal(baseQuestions[i].title, seeds.questions[i].prompt);
        assert.deepEqual(
          baseQuestions[i].options,
          seeds.questions[i].options.map(({ optionId, label }) => ({ id: optionId, label })),
        );
      }
      const config = load("config/backend-content").backendContent;
      assert.equal(config.reviewStatus, "draft_for_joint_review");
      assert.equal(config.followups.length, 12);
      assert.doesNotMatch(JSON.stringify(config), /capabilityScores|capabilityWeights|matrix/);
    },
  );
  await check("v2 preference mapping is a role preference payload, not a capability score", () => {
    const { preferenceAnswers } = load("services/v2-contract");
    for (const [id, value] of Object.entries({
      "ui-facts": "facts",
      "ui-people": "people",
      "ui-practice": "practice",
      "ui-unsure": "unsure",
    })) {
      const session = sessionStore.snapshot().session;
      session.profile.preference = id;
      assert.deepEqual(preferenceAnswers(session), { preferredApproach: value });
    }
  });
  await check(
    "three v2 trial payloads pass B validator; optional omitted; attempt stable on retry and new on restart",
    () => {
      const { buildTrialRequest } = load("services/v2-contract");
      const definitions = JSON.parse(
        fs.readFileSync(path.resolve(root, "../database/seeds/work_trials.v2.json"), "utf8"),
      ).trials;
      const backend = require("../shared/recommendation.v2.js");
      for (const role of ["ui-data", "ui-operations", "ui-research"]) {
        const definition = finishTrial(sessionStore, role);
        const session = sessionStore.snapshot().session;
        const request = buildTrialRequest(credentials.sessionId, session);
        const formal = definitions.find((trial) => trial.trialId === request.trialId);
        assert.equal(backend.validateTrialAnswers(request, formal).ok, true);
        assert.equal(Object.keys(request.answers).length, 3);
        assert.deepEqual(buildTrialRequest(credentials.sessionId, session), request);
        session.trial.supplementaryAnswer = "可选总结";
        assert.equal(
          Object.keys(buildTrialRequest(credentials.sessionId, session).answers).length,
          4,
        );
        session.trial.answers.unknown = "不能上传";
        assert.throws(() => buildTrialRequest(credentials.sessionId, session));
        sessionStore.startTrial(definition.localId, true);
        assert.notEqual(
          sessionStore.snapshot().session.trial.trialAttemptId,
          request.trialAttemptId,
        );
        assert.throws(() =>
          buildTrialRequest(credentials.sessionId, sessionStore.snapshot().session),
        );
      }
    },
  );
  await check(
    "observation display accepts evidenced zero but rejects failure zero, unknown dimensions and missing evidence",
    () => {
      const { validObservations, observationCards } = load("models/observations");
      const observed = {
        dimension: "logical_analysis",
        status: "observed",
        score: 0,
        maxScore: 5,
        evidence: ["测试中的有效评分证据"],
        improvement: "测试建议",
      };
      const missing = {
        dimension: "user_insight",
        status: "not_observed",
        score: null,
        maxScore: 5,
        evidence: [],
        reason: "本任务没有覆盖",
      };
      const unavailable = {
        ...missing,
        dimension: "communication",
        status: "unavailable",
        reason: "评分服务不可用",
      };
      assert.equal(validObservations([observed, missing, unavailable]), true);
      const cards = observationCards([observed, missing, unavailable]);
      assert.equal(cards.length, 6);
      assert.match(cards[1].performance, /0\/5/);
      assert.match(cards[3].performance, /不计作 0/);
      for (const invalid of [
        { ...observed, evidence: [] },
        { ...observed, score: 6 },
        { ...missing, score: 0 },
        { ...observed, dimension: "invented" },
      ]) {
        assert.equal(validObservations([invalid]), false);
      }
      assert.equal(validObservations([observed, observed]), false);
    },
  );
  await check(
    "degraded trial leaves original recommendation order unchanged and never inserts failure score",
    () => {
      finishTrial(sessionStore);
      const { mockComparison } = load("mocks/next-steps");
      const comparison = mockComparison(sessionStore.snapshot().session.trial.result, true);
      assert.deepEqual(
        comparison.before.map((item) => item.name),
        comparison.after.map((item) => item.name),
      );
      assert.match(comparison.explanation, /不把技术失败作为 0/);
    },
  );
  await check(
    "same planId keeps checkmarks; confirmed new planId resets; cache survives reload",
    () => {
      finishTrial(sessionStore);
      const { createMockPlan } = load("mocks/next-steps");
      const session = sessionStore.snapshot().session;
      const plan = createMockPlan(session.trial.result.roleName);
      assert.equal(sessionStore.saveActionPlan(session.localId, session.revision, plan), true);
      sessionStore.togglePlanDay(1);
      sessionStore.saveActionPlan(session.localId, session.revision, plan);
      assert.equal(sessionStore.snapshot().session.actionPlan.view.items[0].completed, true);
      sessionStore.saveActionPlan(session.localId, session.revision, {
        ...plan,
        planId: "new-confirmed-plan",
      });
      assert.equal(sessionStore.snapshot().session.actionPlan.view.items[0].completed, false);
      assert.equal(
        createSessionStore(load("utils/storage").localStorage).snapshot().session.actionPlan.view
          .planId,
        "new-confirmed-plan",
      );
    },
  );
  await check(
    "v2 event IDs persist for retries; attempts and modes separate; unknown payload is not stored",
    () => {
      const { createEventLedger } = load("services/formal-events");
      const values = new Map();
      const storage = {
        read: (key) => values.get(key),
        write: (key, value) => values.set(key, structuredClone(value)),
        remove: (key) => values.delete(key),
      };
      const ledger = createEventLedger(storage);
      const input = {
        sessionId: credentials.sessionId,
        mode: "mock",
        eventName: "trial.started",
        step: "work_trial",
        trialAttemptId: "attempt-1",
        answers: "never store this",
      };
      const first = ledger.enqueue(input);
      assert.equal(ledger.enqueue(input).eventId, first.eventId);
      assert.equal(createEventLedger(storage).enqueue(input).eventId, first.eventId);
      assert.notEqual(
        ledger.enqueue({ ...input, trialAttemptId: "attempt-2" }).eventId,
        first.eventId,
      );
      assert.notEqual(ledger.enqueue({ ...input, mode: "real" }).eventId, first.eventId);
      assert.doesNotMatch(JSON.stringify(ledger.snapshot()), /answers|never store/);
      assert.throws(() => ledger.enqueue({ ...input, trialAttemptId: undefined }));
    },
  );
  await check(
    "publication consent defaults false and is persisted with submitted feedback",
    async () => {
      const { cloudSession } = load("services/cloud-session");
      const { cloudAdapter } = load("services/cloud-adapter");
      const adapter = load("services/v2-contract");
      const home = mountPage("pages/home/index");
      assert.equal(home.data.publicationConsent, false);
      const request = adapter.buildFeedbackRequest(credentials.sessionId, 4, "测试意见", {
        granted: false,
        textVersion: adapter.PUBLICATION_TEXT_VERSION,
      });
      assert.equal(request.publicationConsent.granted, false);
      assert.equal((await adapter.blockUnreleasedV2(request)).status, "error");
      const originalCurrent = cloudSession.current;
      const originalSubmit = cloudAdapter.submitFeedback;
      let calls = 0;
      let submittedConsent;
      try {
        cloudSession.current = () => credentials;
        cloudAdapter.submitFeedback = async (...args) => {
          calls++;
          submittedConsent = args[3];
          return { status: "success", data: { accepted: true }, message: "" };
        };
        home.setData({ helpfulness: 4, feedbackText: "我的测试意见", publicationConsent: true });
        await home.sendFeedback();
        assert.equal(calls, 1);
        assert.equal(submittedConsent.granted, true);
        assert.equal(submittedConsent.textVersion, adapter.PUBLICATION_TEXT_VERSION);
      } finally {
        cloudSession.current = originalCurrent;
        cloudAdapter.submitFeedback = originalSubmit;
      }
    },
  );
  await check(
    "legacy questionnaire cache is not converted or overwritten by the new B question set",
    () => {
      const values = new Map([["pathai.frontend.session.v1", { oldAnswers: { "ui-q1": "a" } }]]);
      const storage = {
        read: (key) => values.get(key),
        write: (key, value) => values.set(key, structuredClone(value)),
        remove: (key) => values.delete(key),
      };
      const store = createSessionStore(storage);
      assert.equal(store.snapshot().session, null);
      assert.match(store.snapshot().warning, /旧演示记录未覆盖/);
      store.start();
      assert.deepEqual(values.get("pathai.frontend.session.v1"), { oldAnswers: { "ui-q1": "a" } });
      store.clear();
      assert.equal(values.has("pathai.frontend.session.v1"), false);
    },
  );
  await check(
    "six formal events correspond to actual Mock milestones and page re-entry does not duplicate",
    async () => {
      const { telemetry } = load("services/telemetry");
      const { cloudSession } = load("services/cloud-session");
      const originalCurrent = cloudSession.current;
      try {
        complete(sessionStore);
        cloudSession.current = () => credentials;
        assert.equal(telemetry.start(), true);
        const profile = mountPage("pages/profile/profile");
        profile.onShow();
        profile.submit();
        const followup = mountPage("pages/followup/followup");
        for (let round = 0; round < 2; round++) {
          await followup.loadQuestion();
          followup.input({ detail: { value: "事件流程测试回答" } });
          followup.submit();
        }
        const recommendation = mountPage("pages/initial-result/initial-result");
        recommendation.onLoad({});
        await recommendation.loadRecommendation();
        const trial = mountPage("pages/work-trial/work-trial");
        trial.onLoad({ role: "ui-data" });
        await trial.loadTrial();
        trial.start();
        for (const field of trial.data.definition.fields)
          trial.input({
            currentTarget: { dataset: { field: field.localId } },
            detail: { value: "有依据的流程测试作答" },
          });
        await trial.submit();
        trial.onUnload();
        const plan = mountPage("pages/action-plan/action-plan");
        await plan.load();
        const events = device.get("pathai.frontend.events.v2");
        assert.deepEqual(
          events.map((event) => event.eventName),
          [
            "session.created",
            "profile.completed",
            "recommendation.viewed",
            "trial.started",
            "trial.completed",
            "plan.viewed",
          ],
        );
        assert.equal(
          events.find((event) => event.eventName === "trial.started").trialAttemptId,
          sessionStore.snapshot().session.trial.trialAttemptId,
        );
        await plan.load();
        await recommendation.loadRecommendation();
        assert.equal(device.get("pathai.frontend.events.v2").length, 6);
        sessionStore.clear();
        assert.equal(device.has("pathai.frontend.events.v2"), false);
      } finally {
        telemetry.stop();
        cloudSession.current = originalCurrent;
      }
    },
  );
  assert.equal(intervals.size, 0, "All countdown intervals must be stopped");
  console.log(
    `\n${checks} logic groups passed. wx and timers are mocked; no UI or real cloud validation claimed.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
