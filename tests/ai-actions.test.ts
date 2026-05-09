import assert from "node:assert/strict";
import test from "node:test";
import { inferExplicitToolActions } from "../server/ai-actions";

test("infers calendar event from explicit chat command", () => {
  const actions = inferExplicitToolActions("Marque no calendario compromisso dia 10/07/2026");

  assert.equal(actions.createEvent?.title, "Compromisso");
  assert.equal(actions.createEvent?.allDay, true);
  assert.equal(actions.createEvent?.startAt.startsWith("2026-07-10T"), true);
});

test("infers timed calendar event from explicit chat command", () => {
  const actions = inferExplicitToolActions("Agende reunião com Ana dia 10/07/2026 às 15h30");

  assert.equal(actions.createEvent?.title, "Reunião com Ana");
  assert.equal(actions.createEvent?.allDay, false);
  assert.equal(actions.createEvent?.startAt.startsWith("2026-07-10T"), true);
  assert.ok(actions.createEvent?.endAt);
});

test("infers finance expense from explicit chat command", () => {
  const actions = inferExplicitToolActions("Registra nas finanças que gastei R$ 42,50 no mercado");

  assert.equal(actions.logFinance?.type, "expense");
  assert.equal(actions.logFinance?.amount, 42.5);
  assert.equal(actions.logFinance?.category, "Alimentação");
});

test("infers finance income from explicit chat command", () => {
  const actions = inferExplicitToolActions("Recebi 2500 de salário");

  assert.equal(actions.logFinance?.type, "income");
  assert.equal(actions.logFinance?.amount, 2500);
  assert.equal(actions.logFinance?.category, "Salário");
});

test("infers note from explicit chat command", () => {
  const actions = inferExplicitToolActions("Anota isso: conversar com o contador amanhã");

  assert.equal(actions.saveNote?.content, "conversar com o contador amanhã");
  assert.equal(actions.saveNote?.title, "Conversar com o contador amanhã");
});
