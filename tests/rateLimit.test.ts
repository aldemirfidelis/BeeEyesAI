import test from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, resetRateLimitStoreForTests } from "../server/rateLimit";

test.beforeEach(() => {
  resetRateLimitStoreForTests();
});

test("rate limiter allows requests until the configured threshold", () => {
  let lastResult = checkRateLimit("user-a");

  for (let index = 0; index < 59; index++) {
    lastResult = checkRateLimit("user-a");
  }

  assert.equal(lastResult.allowed, true);
  assert.equal(lastResult.remaining, 0);
});

test("rate limiter blocks after the hourly threshold", () => {
  for (let index = 0; index < 60; index++) {
    checkRateLimit("user-a");
  }

  const blocked = checkRateLimit("user-a");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.resetInMs > 0);
});
