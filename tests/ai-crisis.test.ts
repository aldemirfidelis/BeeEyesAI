import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { detectCrisisSignals, buildCrisisResponse } from "../server/ai-crisis";

describe("ai-crisis detector", () => {
  test("detects explicit suicidal ideation", () => {
    assert.equal(detectCrisisSignals("estou pensando em suicídio"), true);
    assert.equal(detectCrisisSignals("quero me matar"), true);
    assert.equal(detectCrisisSignals("quero morrer"), true);
    assert.equal(detectCrisisSignals("quero pôr fim à minha vida"), true);
    assert.equal(detectCrisisSignals("não aguento mais viver"), true);
    assert.equal(detectCrisisSignals("vou desistir de tudo"), true);
  });

  test("detects self-harm patterns", () => {
    assert.equal(detectCrisisSignals("vou me machucar de novo"), true);
    assert.equal(detectCrisisSignals("estou me cortando"), true);
    assert.equal(detectCrisisSignals("tomei remédio demais"), true);
  });

  test("detects acute crisis", () => {
    assert.equal(detectCrisisSignals("estou em crise de pânico"), true);
    assert.equal(detectCrisisSignals("não consigo respirar"), true);
  });

  test("does not trigger on benign phrasing", () => {
    assert.equal(detectCrisisSignals("morrer de rir"), false);
    assert.equal(detectCrisisSignals("vou cortar o cabelo"), false);
    assert.equal(detectCrisisSignals("quero ver esse filme"), false);
    assert.equal(detectCrisisSignals("o trabalho está sufocante mas tudo bem"), false);
    assert.equal(detectCrisisSignals(""), false);
    assert.equal(detectCrisisSignals("oi bee, como vai"), false);
  });

  test("handles non-string input gracefully", () => {
    // @ts-expect-error testando contrato defensivo
    assert.equal(detectCrisisSignals(null), false);
    // @ts-expect-error
    assert.equal(detectCrisisSignals(undefined), false);
    // @ts-expect-error
    assert.equal(detectCrisisSignals(123), false);
  });

  test("buildCrisisResponse contains CVV and SAMU numbers", () => {
    const text = buildCrisisResponse(null);
    assert.match(text, /CVV/);
    assert.match(text, /188/);
    assert.match(text, /SAMU/);
    assert.match(text, /192/);
    assert.match(text, /cvv\.org\.br/i);
  });
});
