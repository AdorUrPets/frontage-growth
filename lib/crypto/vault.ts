import crypto from "crypto";

// AES-256-GCM at-rest encryption for provider API keys. Master key comes from
// FRONTAGE_GROWTH_MASTER_KEY (.env.local, generated once — see README).
// Never logged, never sent to the browser: only lib/db/keys.ts (server-only)
// and route handlers under app/api/keys touch this module.

function getMasterKey(): Buffer {
  const raw = process.env.FRONTAGE_GROWTH_MASTER_KEY;
  if (!raw || raw.trim().length === 0) {
    throw new Error(
      "FRONTAGE_GROWTH_MASTER_KEY is not set. Generate one with `node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"` and add it to .env.local."
    );
  }
  const key = Buffer.from(raw.trim(), "hex");
  if (key.length !== 32) {
    throw new Error("FRONTAGE_GROWTH_MASTER_KEY must be a 32-byte value hex-encoded (64 hex characters).");
  }
  return key;
}

export interface EncryptedKey {
  ciphertext: string; // base64
  iv: string; // base64
  tag: string; // base64
  last4: string;
}

export function encryptKey(plaintext: string): EncryptedKey {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    last4: plaintext.slice(-4),
  };
}

export function decryptKey(enc: { ciphertext: string; iv: string; tag: string }): string {
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(enc.iv, "base64"));
  decipher.setAuthTag(Buffer.from(enc.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

export function maskKey(last4: string): string {
  return `••••••••••${last4}`;
}
