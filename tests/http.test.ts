import test from "node:test";
import assert from "node:assert/strict";
import { parseBoundedInt } from "../server/http";

test("parseBoundedInt falls back for invalid values", () => {
  assert.equal(parseBoundedInt(undefined, { fallback: 10, min: 1, max: 20 }), 10);
  assert.equal(parseBoundedInt("abc", { fallback: 10, min: 1, max: 20 }), 10);
});

test("parseBoundedInt clamps to bounds", () => {
  assert.equal(parseBoundedInt("0", { fallback: 10, min: 1, max: 20 }), 1);
  assert.equal(parseBoundedInt("999", { fallback: 10, min: 1, max: 20 }), 20);
  assert.equal(parseBoundedInt("12", { fallback: 10, min: 1, max: 20 }), 12);
});
