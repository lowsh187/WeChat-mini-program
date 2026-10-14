import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

import observability from "../shared/observability.js";

const { buildStabilitySummary } = observability;

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const inputPath = readArgument("--input");
const outputPath = readArgument("--output");
if (!inputPath) {
  console.error(
    "用法：node scripts/summarize-metrics.mjs --input <匿名导出.json> [--output <摘要.json>]",
  );
  process.exitCode = 1;
} else {
  const payload = JSON.parse(await readFile(inputPath, "utf8"));
  const summary = buildStabilitySummary(payload);
  const serialized = `${JSON.stringify(summary, null, 2)}\n`;
  if (outputPath) await writeFile(outputPath, serialized, "utf8");
  else process.stdout.write(serialized);
}
