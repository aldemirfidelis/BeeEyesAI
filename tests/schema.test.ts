import test from "node:test";
import assert from "node:assert/strict";
import { insertUserSchema } from "../shared/schema";

test("insertUserSchema accepts a strong username and password", () => {
  const result = insertUserSchema.safeParse({
    username: "bee.user",
    password: "Secure123",
  });

  assert.equal(result.success, true);
});

test("insertUserSchema rejects weak credentials", () => {
  const result = insertUserSchema.safeParse({
    username: "a",
    password: "123",
  });

  assert.equal(result.success, false);
});
