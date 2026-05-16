import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  estimateTokens,
  estimateCostCents,
  checkBudget,
  recordCost,
  isExempt,
  resetBudgetStoreForTests,
} from "../server/aiBudget";

describe("aiBudget", () => {
  beforeEach(() => {
    resetBudgetStoreForTests();
    delete process.env.BEE_AI_MONTHLY_BUDGET_USD;
    delete process.env.BEE_AI_BUDGET_EXEMPT_USER_IDS;
  });

  afterEach(() => {
    resetBudgetStoreForTests();
  });

  test("estimateTokens approximates chars/4", () => {
    assert.equal(estimateTokens(""), 0);
    assert.equal(estimateTokens("abcd"), 1);
    assert.equal(estimateTokens("a".repeat(400)), 100);
  });

  test("estimateCostCents returns positive cents for non-zero usage", () => {
    const cents = estimateCostCents(10000, 5000);
    // 10000 * 0.15/M + 5000 * 0.60/M = 0.0015 + 0.003 = $0.0045 → 1 cent (ceil)
    assert.ok(cents >= 1);
    assert.equal(estimateCostCents(0, 0), 0);
  });

  test("default budget allows new user", () => {
    const result = checkBudget("user-1");
    assert.equal(result.allowed, true);
    assert.equal(result.spentCents, 0);
    assert.ok(result.budgetCents > 0);
  });

  test("recording cost reduces remaining budget", () => {
    recordCost("user-2", 1_000_000, 500_000); // input + output big
    const result = checkBudget("user-2");
    assert.ok(result.spentCents > 0);
  });

  test("budget block when spent >= cap", () => {
    process.env.BEE_AI_MONTHLY_BUDGET_USD = "0.01"; // 1 cent
    // Cada call gasta pelo menos 1 cent (ceil)
    recordCost("user-3", 100_000, 100_000);
    const result = checkBudget("user-3");
    assert.equal(result.allowed, false);
  });

  test("exempt users bypass budget", () => {
    process.env.BEE_AI_BUDGET_EXEMPT_USER_IDS = "admin-1,admin-2";
    process.env.BEE_AI_MONTHLY_BUDGET_USD = "0.01";
    assert.equal(isExempt("admin-1"), true);
    assert.equal(isExempt("admin-2"), true);
    assert.equal(isExempt("user-1"), false);

    recordCost("admin-1", 10_000_000, 5_000_000); // tenta gastar muito
    const result = checkBudget("admin-1");
    assert.equal(result.allowed, true);
  });

  test("usage isolation between users", () => {
    process.env.BEE_AI_MONTHLY_BUDGET_USD = "0.01"; // 1 cent
    recordCost("user-a", 100_000, 100_000);
    const a = checkBudget("user-a");
    const b = checkBudget("user-b");
    assert.equal(a.allowed, false);
    assert.equal(b.allowed, true);
  });
});
