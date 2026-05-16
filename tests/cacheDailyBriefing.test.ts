import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getCachedBriefing,
  setCachedBriefing,
  clearCachedBriefing,
  pruneOldBriefings,
  resetBriefingCacheForTests,
} from "../server/cacheDailyBriefing";

const sample = (text: string) => ({
  text,
  city: "Recife",
  weather: { temp: 28 },
  date: "16/05/2026",
  dayOfWeek: "sexta-feira",
});

describe("cacheDailyBriefing", () => {
  beforeEach(() => resetBriefingCacheForTests());

  test("get retorna null quando não existe", () => {
    assert.equal(getCachedBriefing("u1", "2026-05-16"), null);
  });

  test("set e get round-trip", () => {
    setCachedBriefing("u1", "2026-05-16", sample("bom dia João"));
    const got = getCachedBriefing("u1", "2026-05-16");
    assert.ok(got);
    assert.equal(got!.text, "bom dia João");
  });

  test("isolamento entre usuários", () => {
    setCachedBriefing("u1", "2026-05-16", sample("a"));
    setCachedBriefing("u2", "2026-05-16", sample("b"));
    assert.equal(getCachedBriefing("u1", "2026-05-16")!.text, "a");
    assert.equal(getCachedBriefing("u2", "2026-05-16")!.text, "b");
  });

  test("isolamento entre dias do mesmo usuário", () => {
    setCachedBriefing("u1", "2026-05-15", sample("ontem"));
    setCachedBriefing("u1", "2026-05-16", sample("hoje"));
    assert.equal(getCachedBriefing("u1", "2026-05-15")!.text, "ontem");
    assert.equal(getCachedBriefing("u1", "2026-05-16")!.text, "hoje");
  });

  test("clear remove apenas a chave alvo", () => {
    setCachedBriefing("u1", "2026-05-16", sample("a"));
    setCachedBriefing("u2", "2026-05-16", sample("b"));
    clearCachedBriefing("u1", "2026-05-16");
    assert.equal(getCachedBriefing("u1", "2026-05-16"), null);
    assert.ok(getCachedBriefing("u2", "2026-05-16"));
  });

  test("pruneOldBriefings remove entradas que não sejam do dia atual", () => {
    setCachedBriefing("u1", "2026-05-14", sample("x"));
    setCachedBriefing("u1", "2026-05-15", sample("y"));
    setCachedBriefing("u1", "2026-05-16", sample("z"));
    const removed = pruneOldBriefings("2026-05-16");
    assert.equal(removed, 2);
    assert.equal(getCachedBriefing("u1", "2026-05-14"), null);
    assert.equal(getCachedBriefing("u1", "2026-05-15"), null);
    assert.ok(getCachedBriefing("u1", "2026-05-16"));
  });
});
