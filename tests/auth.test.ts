import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, signToken, verifyPassword, verifyToken } from "../server/auth";

test("password hashing and verification work end-to-end", async () => {
  const password = "BeeEyes123";
  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("JWT roundtrip preserves subject", () => {
  const token = signToken("user-123");
  const payload = verifyToken(token);

  assert.equal(payload.sub, "user-123");
});
