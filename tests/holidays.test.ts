import assert from "node:assert/strict";
import test from "node:test";
import { getBrazilNationalHoliday } from "../server/holidays";

test("detects national holiday", () => {
  const holiday = getBrazilNationalHoliday(new Date(2026, 11, 25, 8, 0));
  assert.equal(holiday?.name, "Natal");
});

test("returns null for regular day", () => {
  const holiday = getBrazilNationalHoliday(new Date(2026, 6, 10, 8, 0));
  assert.equal(holiday, null);
});
