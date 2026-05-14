import assert from "node:assert/strict";
import test from "node:test";
import { parseBeeCommand } from "../server/bee-command-parser";

const now = new Date(2026, 4, 14, 12, 0, 0, 0);

function parse(message: string) {
  return parseBeeCommand(message, {
    now,
    defaultReminderTime: "08:00",
    defaultReminderOffsetMinutes: 30,
  });
}

function localParts(iso?: string) {
  assert.ok(iso);
  const date = new Date(iso);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

test("parses calendar-only dentist command", () => {
  const result = parse("Marque dentista dia 20 às 8h");

  assert.equal(result.needsClarification, false);
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].type, "calendar_event");
  assert.equal(result.actions[0].title, "Dentista");
  assert.deepEqual(localParts(result.actions[0].startAt), {
    year: 2026,
    month: 5,
    day: 20,
    hour: 8,
    minute: 0,
  });
});

test("parses reminder-only command with default reminder time", () => {
  const result = parse("Me lembre de pagar a conta sexta-feira");

  assert.equal(result.needsClarification, false);
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].type, "alarm_reminder");
  assert.equal(result.actions[0].title, "Pagar a conta");
  assert.deepEqual(localParts(result.actions[0].scheduledAt), {
    year: 2026,
    month: 5,
    day: 15,
    hour: 8,
    minute: 0,
  });
});

test("parses calendar event with linked reminder one hour before", () => {
  const result = parse("Marque dentista dia 20 às 8h e me lembre 1 hora antes");

  assert.equal(result.needsClarification, false);
  assert.equal(result.actions.length, 2);
  const [event, reminder] = result.actions;
  assert.equal(event.type, "calendar_event");
  assert.equal(reminder.type, "alarm_reminder");
  assert.equal(reminder.linkedEvent, true);
  assert.equal(reminder.reminderOffsetMinutes, 60);
  assert.deepEqual(localParts(reminder.scheduledAt), {
    year: 2026,
    month: 5,
    day: 20,
    hour: 7,
    minute: 0,
  });
});

test("parses meeting with linked reminder thirty minutes before", () => {
  const result = parse("Agende reunião sexta às 14h e me avise 30 minutos antes");

  assert.equal(result.actions.length, 2);
  assert.equal(result.actions[0].title, "Reunião");
  assert.equal(result.actions[1].type, "alarm_reminder");
  assert.equal(result.actions[1].reminderOffsetMinutes, 30);
  assert.deepEqual(localParts(result.actions[1].scheduledAt), {
    year: 2026,
    month: 5,
    day: 15,
    hour: 13,
    minute: 30,
  });
});

test("parses wake-up alarm", () => {
  const result = parse("Me acorde amanhã às 6h");

  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].type, "alarm_reminder");
  assert.equal(result.actions[0].kind, "alarm");
  assert.deepEqual(localParts(result.actions[0].scheduledAt), {
    year: 2026,
    month: 5,
    day: 15,
    hour: 6,
    minute: 0,
  });
});

test("parses calendar command with calendar wording", () => {
  const result = parse("Coloque no calendário pagar aluguel dia 10 às 9h");

  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].type, "calendar_event");
  assert.equal(result.actions[0].title, "Pagar aluguel");
  assert.deepEqual(localParts(result.actions[0].startAt), {
    year: 2026,
    month: 6,
    day: 10,
    hour: 9,
    minute: 0,
  });
});

test("parses daily medicine reminder", () => {
  const result = parse("Me lembre de tomar remédio todo dia às 22h");

  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].type, "alarm_reminder");
  assert.equal(result.actions[0].repeatType, "daily");
  assert.deepEqual(localParts(result.actions[0].scheduledAt), {
    year: 2026,
    month: 5,
    day: 14,
    hour: 22,
    minute: 0,
  });
});

test("parses event with default before reminder", () => {
  const result = parse("Tenho médico amanhã às 10h, me avise antes");

  assert.equal(result.actions.length, 2);
  assert.equal(result.actions[1].type, "alarm_reminder");
  assert.equal(result.actions[1].linkedEvent, true);
  assert.equal(result.actions[1].reminderOffsetMinutes, 30);
  assert.deepEqual(localParts(result.actions[1].scheduledAt), {
    year: 2026,
    month: 5,
    day: 15,
    hour: 9,
    minute: 30,
  });
});

test("parses academy event with fifteen-minute reminder", () => {
  const result = parse("Marque academia segunda às 18h e me lembre 15 minutos antes");

  assert.equal(result.actions.length, 2);
  assert.equal(result.actions[0].type, "calendar_event");
  assert.equal(result.actions[1].type, "alarm_reminder");
  assert.equal(result.actions[1].reminderOffsetMinutes, 15);
  assert.deepEqual(localParts(result.actions[1].scheduledAt), {
    year: 2026,
    month: 5,
    day: 18,
    hour: 17,
    minute: 45,
  });
});

test("parses alarm relative to now", () => {
  const result = parse("Crie um alarme para daqui 30 minutos");

  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].type, "alarm_reminder");
  assert.equal(result.actions[0].kind, "alarm");
  assert.deepEqual(localParts(result.actions[0].scheduledAt), {
    year: 2026,
    month: 5,
    day: 14,
    hour: 12,
    minute: 30,
  });
});

test("parses reminder and mirrored calendar event", () => {
  const result = parse("Me avise sexta às 9h de pagar a conta e coloque também no calendário");

  assert.equal(result.actions.length, 2);
  assert.equal(result.actions[0].type, "calendar_event");
  assert.equal(result.actions[0].title, "Pagar a conta");
  assert.equal(result.actions[1].type, "alarm_reminder");
  assert.equal(result.actions[1].title, "Pagar a conta");
  assert.equal(result.actions[1].linkedEvent, false);
  assert.deepEqual(localParts(result.actions[0].startAt), {
    year: 2026,
    month: 5,
    day: 15,
    hour: 9,
    minute: 0,
  });
});
