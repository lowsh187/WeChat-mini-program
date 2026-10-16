const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}
function files(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === "node_modules" || entry.name === ".git" ? [] : files(item);
    return [item];
  });
}
let jsonCount = 0;
for (const file of [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "project.config.json",
  ...files("miniprogram").filter((file) => file.endsWith(".json")),
]) {
  JSON.parse(read(file));
  jsonCount++;
}
const config = JSON.parse(read("project.config.json"));
assert.equal(config.miniprogramRoot, "miniprogram/");
assert.equal(config.compileType, "miniprogram");
assert.ok(
  typeof config.appid === "string" &&
    (config.appid === "" || /^wx[0-9a-f]{16}$/.test(config.appid)),
  "AppID must be empty or a correctly formatted team-provided value (format check only)",
);
assert.ok(config.setting.useCompilerPlugins.includes("typescript"));
const app = JSON.parse(read("miniprogram/app.json"));
assert.equal(app.pages.length, 7);
assert.equal(new Set(app.pages).size, 7);
const knownTags = new Set(["view", "text", "button", "block", "progress", "textarea"]);
for (const route of app.pages) {
  const prefix = `miniprogram/${route}`;
  for (const extension of ["ts", "wxml", "wxss", "json"])
    assert.ok(
      fs.existsSync(path.join(root, `${prefix}.${extension}`)),
      `${prefix}.${extension} missing`,
    );
  const markup = read(`${prefix}.wxml`);
  // Phase-1 conditions are all dynamic. Bare strings such as "!ready" stay truthy.
  for (const match of markup.matchAll(/wx:(?:if|elif)="([^"]*)"/g)) {
    assert.match(
      match[1],
      /^\{\{[\s\S]+\}\}$/,
      `${route}: condition must use {{ }} data binding: ${match[1]}`,
    );
  }
  const source = ts.createSourceFile(
    `${route}.ts`,
    read(`${prefix}.ts`),
    ts.ScriptTarget.Latest,
    true,
  );
  const handlers = new Set();
  function visit(node) {
    if (ts.isMethodDeclaration(node) && node.name) handlers.add(node.name.getText(source));
    ts.forEachChild(node, visit);
  }
  visit(source);
  for (const match of markup.matchAll(/(?:bind|catch)(?:tap|input|change|submit)="([^"]+)"/g)) {
    assert.ok(handlers.has(match[1]), `${route}: unknown event handler ${match[1]}`);
  }
  // Basic native tag nesting only; not a substitute for the DevTools WXML compiler.
  const stack = [];
  for (const match of markup.matchAll(/<\/?([a-z-]+)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g)) {
    const [tag, name] = match;
    assert.ok(knownTags.has(name), `${route}: unsupported native tag ${name}`);
    if (tag.startsWith("</")) assert.equal(stack.pop(), name, `${route}: tag nesting error`);
    else if (!tag.endsWith("/>")) stack.push(name);
  }
  assert.equal(stack.length, 0, `${route}: unclosed tags`);
}
for (const file of files("miniprogram").filter((item) => item.endsWith(".ts"))) {
  assert.doesNotMatch(
    read(file),
    /wx\.cloud\.database\s*\(/,
    `${file}: pages must not access the database`,
  );
  if (
    !file.replaceAll("\\", "/").startsWith("miniprogram/services/") &&
    file.replaceAll("\\", "/") !== "miniprogram/app.ts"
  ) {
    assert.doesNotMatch(
      read(file),
      /wx\.cloud\.(callFunction|init)\s*\(/,
      `${file}: cloud calls must go through services`,
    );
  }
}
console.log(
  `PASS: ${jsonCount} JSON files; 7 page quartets; routes, TS plugin, event handlers, basic WXML tags; cloud access confined to services.`,
);
