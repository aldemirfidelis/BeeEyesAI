import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { encryptToken, decryptToken, decryptTokenSafe, isEncrypted } from "../server/encryption";

describe("encryption (AES-256-GCM)", () => {
  let prevKey: string | undefined;

  beforeEach(() => {
    prevKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
  });

  afterEach(() => {
    if (prevKey !== undefined) process.env.ENCRYPTION_KEY = prevKey;
    else delete process.env.ENCRYPTION_KEY;
  });

  test("round-trip preserves content", () => {
    const plain = "ya29.a0AfH6SMC_some_google_access_token_blob";
    const enc = encryptToken(plain);
    assert.ok(enc.startsWith("enc:v1:"));
    assert.notEqual(enc, plain);
    assert.equal(decryptToken(enc), plain);
  });

  test("isEncrypted detects format correctly", () => {
    assert.equal(isEncrypted("enc:v1:abc"), true);
    assert.equal(isEncrypted("ya29.xxx"), false);
    assert.equal(isEncrypted(""), false);
    assert.equal(isEncrypted(null), false);
    assert.equal(isEncrypted(undefined), false);
  });

  test("decryptToken passes plaintext through (legacy coexistence)", () => {
    assert.equal(decryptToken("ya29.legacy_plain_token"), "ya29.legacy_plain_token");
    assert.equal(decryptToken(""), "");
  });

  test("two encryptions of the same plaintext produce different ciphertexts (random IV)", () => {
    const plain = "same-content";
    const a = encryptToken(plain);
    const b = encryptToken(plain);
    assert.notEqual(a, b);
    assert.equal(decryptToken(a), plain);
    assert.equal(decryptToken(b), plain);
  });

  test("tampering with ciphertext throws on decrypt", () => {
    const plain = "secret-token";
    const enc = encryptToken(plain);
    // Flip um byte do meio do blob (após o prefixo)
    const prefix = "enc:v1:";
    const blob = Buffer.from(enc.slice(prefix.length), "base64");
    blob[blob.length - 1] ^= 0xff;
    const tampered = prefix + blob.toString("base64");
    assert.throws(() => decryptToken(tampered));
  });

  test("decryptTokenSafe returns null when null/empty", () => {
    assert.equal(decryptTokenSafe(null), null);
    assert.equal(decryptTokenSafe(undefined), null);
    assert.equal(decryptTokenSafe(""), null);
  });

  test("decryptTokenSafe returns null on tampering instead of throwing", () => {
    const enc = encryptToken("secret");
    const tampered = enc.slice(0, -2) + "xx";
    const result = decryptTokenSafe(tampered);
    assert.equal(result, null);
  });

  test("decryptTokenSafe returns plaintext if input is not encrypted", () => {
    assert.equal(decryptTokenSafe("ya29.legacy"), "ya29.legacy");
  });
});
