import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("KEY_ENCRYPTION_SECRET is required for key encryption");
  }
  return createHash("sha256").update(secret).digest();
}

/**
 * Encrypt a private key for storage.
 * If KEY_ENCRYPTION_SECRET is not set, returns the key as-is (dev mode).
 */
export function encryptPrivateKey(privateKey: string): string {
  if (!process.env.KEY_ENCRYPTION_SECRET) {
    return privateKey;
  }
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(privateKey, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypt a stored private key.
 * Handles both encrypted (base64) and unencrypted (0x hex) keys for migration.
 */
export function decryptPrivateKey(storedKey: string): string {
  // Unencrypted hex key (dev mode or pre-encryption data)
  if (storedKey.startsWith("0x")) {
    return storedKey;
  }
  // No encryption configured — return as-is
  if (!process.env.KEY_ENCRYPTION_SECRET) {
    return storedKey;
  }
  const key = getEncryptionKey();
  const data = Buffer.from(storedKey, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
}
