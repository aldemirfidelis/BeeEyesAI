import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseAIActionsV2, extractJsonObjectWithKey } from "../server/ai-actions-parser";

describe("extractJsonObjectWithKey — extração balanceada", () => {
  test("encontra objeto simples", () => {
    const result = extractJsonObjectWithKey('Texto {"foo": "bar"} fim', "foo");
    assert.ok(result);
    assert.equal(result!.slice, '{"foo": "bar"}');
  });

  test("lida com chaves dentro de strings (caso que quebrava o regex legado)", () => {
    const source = 'Resp {"create_event": {"title": "Reunião { com cliente }", "startAt": "2026-05-16T14:00:00Z"}} fim';
    const result = extractJsonObjectWithKey(source, "create_event");
    assert.ok(result);
    const parsed = JSON.parse(result!.slice);
    assert.equal(parsed.create_event.title, "Reunião { com cliente }");
  });

  test("lida com objetos aninhados profundos", () => {
    const source = 'X {"outer": {"inner": {"deep": {"value": 1}}}} Y';
    const result = extractJsonObjectWithKey(source, "outer");
    assert.ok(result);
    const parsed = JSON.parse(result!.slice);
    assert.equal(parsed.outer.inner.deep.value, 1);
  });

  test("retorna null para chave inexistente", () => {
    assert.equal(extractJsonObjectWithKey('{"foo": 1}', "bar"), null);
  });

  test("retorna null quando JSON está incompleto/truncado", () => {
    // sem fechar
    assert.equal(extractJsonObjectWithKey('Texto {"foo": {"bar":', "foo"), null);
  });
});

describe("parseAIActionsV2 — validação Zod", () => {
  test("aceita create_event válido (ISO datetime)", () => {
    const resp = 'Ok, marquei! {"create_event": {"title": "Reunião", "startAt": "2026-05-20T14:00:00Z"}}';
    const r = parseAIActionsV2(resp);
    assert.ok(r.createEvent);
    assert.equal(r.createEvent!.title, "Reunião");
    assert.equal(r.createEvent!.startAt, "2026-05-20T14:00:00Z");
    assert.doesNotMatch(r.cleanText, /create_event/);
  });

  test("rejeita create_event com startAt vazio (legado aceitava)", () => {
    const resp = '{"create_event": {"title": "Reunião", "startAt": ""}}';
    const r = parseAIActionsV2(resp);
    assert.equal(r.createEvent, undefined);
  });

  test("rejeita create_event com startAt inválido", () => {
    const resp = '{"create_event": {"title": "X", "startAt": "amanhã às 14h"}}';
    const r = parseAIActionsV2(resp);
    assert.equal(r.createEvent, undefined);
  });

  test("aceita snake_case start_at e converte (compat com fallbacks)", () => {
    const resp = '{"create_event": {"title": "X", "start_at": "2026-05-20T10:00:00Z"}}';
    const r = parseAIActionsV2(resp);
    assert.ok(r.createEvent);
    assert.equal(r.createEvent!.startAt, "2026-05-20T10:00:00Z");
  });

  test("rejeita create_event sem título", () => {
    const resp = '{"create_event": {"title": "", "startAt": "2026-05-20T10:00:00Z"}}';
    const r = parseAIActionsV2(resp);
    assert.equal(r.createEvent, undefined);
  });

  test("aceita log_finance válido", () => {
    const resp = '{"log_finance": {"type": "expense", "amount": 45.50, "category": "Alimentação"}}';
    const r = parseAIActionsV2(resp);
    assert.ok(r.logFinance);
    assert.equal(r.logFinance!.type, "expense");
    assert.equal(r.logFinance!.amount, 45.50);
  });

  test("rejeita log_finance com amount=0 (positivo obrigatório)", () => {
    const resp = '{"log_finance": {"type": "expense", "amount": 0, "category": "X"}}';
    const r = parseAIActionsV2(resp);
    assert.equal(r.logFinance, undefined);
  });

  test("rejeita log_finance com type inválido (legado aceitava como 'expense')", () => {
    const resp = '{"log_finance": {"type": "outros", "amount": 10, "category": "X"}}';
    const r = parseAIActionsV2(resp);
    assert.equal(r.logFinance, undefined);
  });

  test("rejeita log_finance com amount NaN-equivalente", () => {
    const resp = '{"log_finance": {"type": "expense", "amount": "não-numero", "category": "X"}}';
    const r = parseAIActionsV2(resp);
    assert.equal(r.logFinance, undefined);
  });

  test("aceita save_note válido", () => {
    const resp = 'Salvo! {"save_note": {"content": "comprar leite", "title": "Mercado"}}';
    const r = parseAIActionsV2(resp);
    assert.ok(r.saveNote);
    assert.equal(r.saveNote!.content, "comprar leite");
  });

  test("rejeita save_note com content vazio", () => {
    const resp = '{"save_note": {"content": "   ", "title": "X"}}';
    const r = parseAIActionsV2(resp);
    assert.equal(r.saveNote, undefined);
  });

  test("aceita fetch_news + achievement na mesma resposta", () => {
    const resp = 'Aqui {"fetch_news": {"query": "ia brasil"}} e {"achievement": {"type": "first_chat", "title": "Olá!", "description": "Primeira mensagem"}}';
    const r = parseAIActionsV2(resp);
    assert.ok(r.fetchNews);
    assert.ok(r.achievement);
  });

  test("remove os JSONs encontrados do cleanText", () => {
    const resp = 'Texto antes {"save_note": {"content": "X"}} texto depois';
    const r = parseAIActionsV2(resp);
    assert.doesNotMatch(r.cleanText, /save_note/);
    assert.match(r.cleanText, /Texto antes/);
    assert.match(r.cleanText, /texto depois/);
  });

  test("ignora JSON truncado em streaming (não cria evento parcial)", () => {
    const resp = 'Resposta parcial {"create_event": {"title": "Reunião"';
    const r = parseAIActionsV2(resp);
    assert.equal(r.createEvent, undefined);
  });

  test("resposta sem nenhuma action retorna cleanText idêntico (trimmed)", () => {
    const resp = "Olá! Como foi seu dia?";
    const r = parseAIActionsV2(resp);
    assert.equal(r.cleanText, resp);
    assert.equal(r.createEvent, undefined);
    assert.equal(r.logFinance, undefined);
    assert.equal(r.saveNote, undefined);
    assert.equal(r.fetchNews, undefined);
    assert.equal(r.achievement, undefined);
  });
});
