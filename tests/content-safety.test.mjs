import assert from "node:assert/strict";
import test from "node:test";

import contentSafety from "../shared/content-safety.js";

const { validateOptionalText } = contentSafety;

test("accepts short non-sensitive optional text", () => {
  assert.deepEqual(validateOptionalText(undefined, { field: "comment", maxLength: 20 }), {
    ok: true,
    value: undefined,
  });
  assert.equal(
    validateOptionalText(" useful ", { field: "comment", maxLength: 20 }).value,
    "useful",
  );
});

test("rejects contact details and excessive text", () => {
  assert.equal(
    validateOptionalText("联系 13800138000", { field: "comment", maxLength: 50 }).code,
    "CONTENT_RISK",
  );
  assert.equal(validateOptionalText("x".repeat(51), { field: "comment", maxLength: 50 }).ok, false);
});
