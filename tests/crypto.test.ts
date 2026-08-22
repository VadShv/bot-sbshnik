import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt, maskSecret, hasEncryptionKey } from "../server/lib/crypto";

describe("crypto (AES-256-GCM)", () => {
  const prevKey = process.env.ENCRYPTION_KEY;
  const prevEnv = process.env.NODE_ENV;

  beforeEach(() => {
    delete process.env.ENCRYPTION_KEY;
    process.env.NODE_ENV = "test";
  });
  afterEach(() => {
    process.env.ENCRYPTION_KEY = prevKey;
    process.env.NODE_ENV = prevEnv;
  });

  it("round-trip encrypt/decrypt (dev fallback key)", () => {
    const enc = encrypt("ghp_secret_token_12345");
    expect(enc.cipher).not.toBe("ghp_secret_token_12345");
    expect(decrypt(enc.cipher, enc.nonce, enc.tag)).toBe("ghp_secret_token_12345");
  });

  it("разные nonce/cipher на каждый encrypt", () => {
    const a = encrypt("x");
    const b = encrypt("x");
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.cipher).not.toBe(b.cipher);
  });

  it("fail-closed в production без ENCRYPTION_KEY", () => {
    process.env.NODE_ENV = "production";
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY/);
  });

  it("работает с явным ENCRYPTION_KEY (hex 32 байта)", () => {
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    const enc = encrypt("hello");
    expect(decrypt(enc.cipher, enc.nonce, enc.tag)).toBe("hello");
  });

  it("maskSecret маскирует последние 4 символа", () => {
    expect(maskSecret("sk-1234567890")).toBe("••••7890");
    expect(maskSecret("")).toBe("");
  });

  it("hasEncryptionKey", () => {
    expect(hasEncryptionKey()).toBe(false);
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    expect(hasEncryptionKey()).toBe(true);
  });
});
