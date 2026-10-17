import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const module = { exports: {} };
const code = ts.transpileModule(read("miniprogram/utils/home-progress.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
new Function("module", "exports", code)(module, module.exports);
const { homeProgress } = module.exports;
const session = (patch = {}) => ({ stage: "profile", answers: {}, ...patch });

test("home shows actual milestones without claiming a recommendation before it exists", () => {
  const fresh = homeProgress(null, 8);
  assert.equal(
    fresh.progressSteps.some((item) => item.current || item.complete),
    false,
  );
  const profile = homeProgress(session({ answers: { q1: "a", q2: "b" } }), 8);
  assert.match(profile.progressDetail, /2 \/ 8/);
  assert.equal(profile.continueLabel, "继续探索");
  for (const count of [0, 1, 2]) {
    const view = homeProgress(
      session({ stage: "followup", followup: { submittedCount: count } }),
      8,
    );
    assert.match(view.progressDetail, new RegExp(`${count} / 2`));
    assert.equal(view.progressSteps[2].complete, false);
    assert.equal(view.progressSteps[1].current, true);
  }
  assert.equal(
    homeProgress(session({ stage: "initial-result" }), 8).progressSteps[2].current,
    true,
  );
  const trial = homeProgress(session({ stage: "work-trial", trial: { completed: false } }), 8);
  assert.equal(trial.progressSteps[3].current, true);
  assert.match(trial.progressDetail, /已保留/);
});

test("result and plan entries require stored results; plan counts are real and input is untouched", () => {
  assert.equal(
    homeProgress(session({ trial: { completed: true, result: null } }), 8).continueLabel,
    "继续探索",
  );
  const result = session({ stage: "trial-result", trial: { completed: true, result: {} } });
  assert.equal(homeProgress(result, 8).continueLabel, "查看探索结果");
  result.actionPlan = {
    view: { items: Array.from({ length: 7 }, (_, day) => ({ completed: day < 2 })) },
  };
  const before = structuredClone(result);
  const view = homeProgress(result, 8);
  assert.equal(view.continueLabel, "查看七天计划");
  assert.match(view.progressDetail, /2 \/ 7/);
  assert.deepEqual(result, before);
});

test("home prioritizes resume and keeps privacy, recovery and deletion handlers accessible", () => {
  const markup = read("miniprogram/pages/home/index.wxml");
  assert.match(markup, /wx:if="\{\{canContinue\}\}" class="primary" bindtap="resume"/);
  assert.match(markup, /class="link-button" bindtap="start"/);
  for (const handler of [
    "privacy",
    "feedback",
    "clear",
    "deleteCloud",
    "analytics",
    "connectCloud",
    "saveCloudCredential",
    "sendFeedback",
  ])
    assert.ok(markup.includes(`bindtap="${handler}"`));
  assert.doesNotMatch(markup, /sessionId|eventId|授权文案版本|正式产品的探索路径|创建匿名云端会话/);
  assert.match(markup, /cloudNeedsAttention && canRetryConnection/);
  assert.match(markup, /cloudPending/);
});

test("every long-answer input retains its limit and binding with explicit keyboard spacing", () => {
  const pages = [
    ["home/index", 480],
    ["followup/followup", 800],
    ["work-trial/work-trial", 1200],
  ];
  for (const [page, limit] of pages) {
    const markup = read(`miniprogram/pages/${page}.wxml`);
    const inputs = [...markup.matchAll(/<textarea\b[^>]*\/>/g)];
    assert.ok(inputs.length > 0);
    for (const [input] of inputs) {
      assert.ok(input.includes(`maxlength="${limit}"`));
      assert.match(input, /bindinput="(?:input|feedbackInput)"/);
      assert.match(input, /cursor-spacing="24"/);
      assert.match(input, /adjust-position="\{\{true\}\}"/);
      assert.doesNotMatch(input, /auto-focus|focus="\{\{true\}\}"/);
    }
  }
});

function homePageForSettings(options = {}) {
  let definition;
  const sideEffect = () => assert.fail("Opening settings must not create, delete or opt in");
  let cloudCurrent = options.cloudCurrent || null;
  let connectCalls = 0;
  let startCalls = 0;
  const navigations = [];
  const localSession = options.localSession || null;
  const cloudStatus = options.cloudStatus || {
    connected: false,
    pending: true,
    warning: "删除凭据无法读取，请联系 B",
  };
  const dependencies = {
    "../../mocks/base-questions": { baseQuestions: Array(8).fill({}) },
    "../../utils/home-progress": { homeProgress },
    "../../store/session": {
      sessionStore: {
        snapshot: () => ({ session: localSession, warning: "" }),
        start: () => {
          startCalls += 1;
        },
        clear: sideEffect,
      },
    },
    "../../services/cloud-session": {
      cloudSession: {
        status: () => cloudStatus,
        current: () => cloudCurrent,
        connect: async () => {
          connectCalls += 1;
          if (options.connectSucceeds)
            cloudCurrent = {
              sessionId: "ses_00000000000000000000000000000000",
              deletionToken: "a".repeat(43),
              progress: "created",
              expiresAt: "2099-01-01T00:00:00.000Z",
            };
          return options.connectMessage || "服务连接已建立";
        },
        remove: sideEffect,
      },
    },
    "../../utils/navigation": {
      navigate: (route) => navigations.push(route),
      routes: {
        home: "home",
        profile: "profile",
        followup: "followup",
        initialResult: "initial-result",
        workTrial: "work-trial",
        trialResult: "trial-result",
        actionPlan: "action-plan",
      },
    },
    "../../services/telemetry": {
      telemetry: {
        status: () => ({ active: false, message: "请先创建匿名联调会话" }),
        start: sideEffect,
        stop: sideEffect,
      },
    },
  };
  const source = ts.transpileModule(read("miniprogram/pages/home/index.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("require", "Page", "wx", "exports", source)(
    (name) => dependencies[name] || {},
    (page) => {
      definition = page;
    },
    {
      cloud: {},
      showModal: ({ success }) => {
        if (options.confirmModal) success({ confirm: true, cancel: false });
      },
    },
    {},
  );
  return {
    ...definition,
    data: structuredClone(definition.data),
    setData(patch) {
      Object.assign(this.data, patch);
    },
    navigations,
    getConnectCalls: () => connectCalls,
    getStartCalls: () => startCalls,
  };
}

test("privacy sections default closed and open exclusively without consent or deletion side effects", () => {
  const page = homePageForSettings();
  assert.equal(page.data.privacyVisible, false);
  assert.equal(page.data.analyticsDetailsVisible, false);
  assert.equal(page.data.recordsVisible, false);
  page.privacy();
  page.toggleAnalyticsDetails();
  assert.equal(page.data.analyticsDetailsVisible, true);
  assert.equal(page.data.analyticsConsent, false);
  page.toggleRecords();
  assert.equal(page.data.analyticsDetailsVisible, false);
  assert.equal(page.data.recordsVisible, true);
  page.feedback();
  assert.equal(page.data.recordsVisible, false);
  assert.equal(page.data.feedbackVisible, true);
  assert.equal(page.data.publicationConsent, false);
  page.privacy();
  page.privacy();
  assert.equal(page.data.feedbackVisible, false);
  assert.equal(page.data.recordsVisible, false);
  assert.equal(page.data.analyticsDetailsVisible, false);
});

test("homepage recovery messages use plain language and retain pending state", () => {
  const page = homePageForSettings();
  page.data.cloudMessage = "云端会话的删除凭据已保存";
  page.refresh();
  assert.equal(page.data.cloudPending, true);
  assert.equal(page.data.canRetryConnection, false);
  for (const message of [
    page.data.cloudMessage,
    page.data.cloudWarning,
    page.data.analyticsMessage,
  ])
    assert.doesNotMatch(message, /凭据|会话|联调|联系 B/);
  const markup = read("miniprogram/pages/home/index.wxml");
  assert.match(markup, /wx:if="\{\{analyticsDetailsVisible\}\}"/);
  assert.match(markup, /wx:if="\{\{recordsVisible\}\}"/);
  const entrance = markup.match(/<view class="utility-links">([\s\S]*?)<\/view>/)[1];
  assert.equal([...entrance.matchAll(/<button\b/g)].length, 1);
  assert.match(entrance, /bindtap="privacy"/);
});

test("resuming cached local progress reconnects before leaving the homepage", async () => {
  const page = homePageForSettings({
    localSession: { localId: "local-1", stage: "profile", answers: { q1: "a" } },
    cloudStatus: { connected: false, pending: false, warning: "" },
    connectSucceeds: true,
  });
  page.refresh();
  await page.resume();
  assert.equal(page.getConnectCalls(), 1);
  assert.deepEqual(page.navigations, ["profile"]);
});

test("restart preserves local progress while an old cloud record still needs deletion", async () => {
  const page = homePageForSettings({
    localSession: { localId: "local-1", stage: "profile", answers: { q1: "a" } },
    cloudStatus: { connected: true, pending: false, warning: "" },
    cloudCurrent: {
      sessionId: "ses_00000000000000000000000000000000",
      deletionToken: "a".repeat(43),
      progress: "created",
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
    confirmModal: true,
  });
  page.refresh();
  await page.start();
  assert.equal(page.getStartCalls(), 0);
  assert.equal(page.data.privacyVisible, true);
  assert.equal(page.data.recordsVisible, true);
  assert.deepEqual(page.navigations, []);
});
