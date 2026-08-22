import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALGO = "aes-256-gcm";

/** Ключ шифрования: ENCRYPTION_KEY (hex 32 байта / base64 32 байта / passphrase).
 *  В production без ENCRYPTION_KEY — fail-closed. В dev — детерминированный fallback-ключ. */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY не задан в окружении (production).");
    }
    return createHash("sha256").update("bot-sbshnik-dev-key").digest();
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  const b = Buffer.from(raw, "base64");
  if (b.length === 32) return b;
  return createHash("sha256").update(raw).digest();
}

export type Encrypted = { cipher: string; nonce: string; tag: string };

export function encrypt(plain: string): Encrypted {
  const key = getKey();
  const nonce = randomBytes(12);
  const c = createCipheriv(ALGO, key, nonce);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return { cipher: enc.toString("base64"), nonce: nonce.toString("base64"), tag: c.getAuthTag().toString("base64") };
}

export function decrypt(cipher: string, nonce: string, tag: string): string {
  const key = getKey();
  const d = createDecipheriv(ALGO, key, Buffer.from(nonce, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  const dec = Buffer.concat([d.update(Buffer.from(cipher, "base64")), d.final()]);
  return dec.toString("utf8");
}

export function maskSecret(s: string): string {
  if (!s) return "";
  return "••••" + s.slice(-4);
}

export function hasEncryptionKey(): boolean {
  return !!process.env.ENCRYPTION_KEY;
}
