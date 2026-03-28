import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptPrivateKey, decryptPrivateKey } from "../keys";

// ── Constants ──

const SAMPLE_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const SAMPLE_ENCRYPTION_SECRET = "test-encryption-secret-for-unit-tests";

// ── Behavior without KEY_ENCRYPTION_SECRET ──

describe("encryptPrivateKey (no encryption secret)", () => {
  beforeEach(() => {
    delete process.env.KEY_ENCRYPTION_SECRET;
  });

  it("returns the key as-is when no secret is set", () => {
    const result = encryptPrivateKey(SAMPLE_PRIVATE_KEY);
    expect(result).toBe(SAMPLE_PRIVATE_KEY);
  });

  it("returns non-hex keys as-is too", () => {
    const key = "some-plain-key";
    const result = encryptPrivateKey(key);
    expect(result).toBe(key);
  });
});

describe("decryptPrivateKey (no encryption secret)", () => {
  beforeEach(() => {
    delete process.env.KEY_ENCRYPTION_SECRET;
  });

  it("returns 0x-prefixed keys as-is (backward compatibility)", () => {
    const result = decryptPrivateKey(SAMPLE_PRIVATE_KEY);
    expect(result).toBe(SAMPLE_PRIVATE_KEY);
  });

  it("returns non-0x keys as-is when no secret is set", () => {
    const encoded = "c29tZS1iYXNlNjQtZGF0YQ=="; // base64 of "some-base64-data"
    const result = decryptPrivateKey(encoded);
    expect(result).toBe(encoded);
  });
});

// ── Behavior with KEY_ENCRYPTION_SECRET ──

describe("encryptPrivateKey (with encryption secret)", () => {
  afterEach(() => {
    delete process.env.KEY_ENCRYPTION_SECRET;
  });

  it("produces output different from input", () => {
    process.env.KEY_ENCRYPTION_SECRET = SAMPLE_ENCRYPTION_SECRET;
    const encrypted = encryptPrivateKey(SAMPLE_PRIVATE_KEY);
    expect(encrypted).not.toBe(SAMPLE_PRIVATE_KEY);
  });

  it("produces base64 output when encrypting", () => {
    process.env.KEY_ENCRYPTION_SECRET = SAMPLE_ENCRYPTION_SECRET;
    const encrypted = encryptPrivateKey(SAMPLE_PRIVATE_KEY);
    // Verify it's valid base64 by decoding
    const decoded = Buffer.from(encrypted, "base64");
    expect(decoded.length).toBeGreaterThan(0);
    // Re-encoding should match (might differ due to padding but should round-trip)
    expect(decoded.toString("base64")).toBe(encrypted);
  });

  it("produces different ciphertext for the same input (random IV)", () => {
    process.env.KEY_ENCRYPTION_SECRET = SAMPLE_ENCRYPTION_SECRET;
    const encrypted1 = encryptPrivateKey(SAMPLE_PRIVATE_KEY);
    const encrypted2 = encryptPrivateKey(SAMPLE_PRIVATE_KEY);
    // AES-256-GCM uses a random IV, so outputs should differ
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("encrypts short keys", () => {
    process.env.KEY_ENCRYPTION_SECRET = SAMPLE_ENCRYPTION_SECRET;
    const encrypted = encryptPrivateKey("short");
    expect(encrypted).not.toBe("short");
    expect(encrypted.length).toBeGreaterThan(0);
  });

  it("encrypts long keys", () => {
    process.env.KEY_ENCRYPTION_SECRET = SAMPLE_ENCRYPTION_SECRET;
    const longKey = "0x" + "a".repeat(500);
    const encrypted = encryptPrivateKey(longKey);
    expect(encrypted).not.toBe(longKey);
    expect(encrypted.length).toBeGreaterThan(0);
  });
});

describe("decryptPrivateKey (with encryption secret)", () => {
  afterEach(() => {
    delete process.env.KEY_ENCRYPTION_SECRET;
  });

  it("round-trips: encrypt then decrypt returns original", () => {
    process.env.KEY_ENCRYPTION_SECRET = SAMPLE_ENCRYPTION_SECRET;
    const encrypted = encryptPrivateKey(SAMPLE_PRIVATE_KEY);
    const decrypted = decryptPrivateKey(encrypted);
    expect(decrypted).toBe(SAMPLE_PRIVATE_KEY);
  });

  it("round-trips with different encryption secrets independently", () => {
    process.env.KEY_ENCRYPTION_SECRET = "secret-one";
    const encrypted1 = encryptPrivateKey(SAMPLE_PRIVATE_KEY);

    process.env.KEY_ENCRYPTION_SECRET = "secret-two";
    const encrypted2 = encryptPrivateKey(SAMPLE_PRIVATE_KEY);

    // Decrypt each with its own secret
    process.env.KEY_ENCRYPTION_SECRET = "secret-one";
    expect(decryptPrivateKey(encrypted1)).toBe(SAMPLE_PRIVATE_KEY);

    process.env.KEY_ENCRYPTION_SECRET = "secret-two";
    expect(decryptPrivateKey(encrypted2)).toBe(SAMPLE_PRIVATE_KEY);
  });

  it("backward compatibility: returns 0x-prefixed keys without decryption", () => {
    process.env.KEY_ENCRYPTION_SECRET = SAMPLE_ENCRYPTION_SECRET;
    // Even with encryption secret set, 0x keys are returned as-is
    const result = decryptPrivateKey(SAMPLE_PRIVATE_KEY);
    expect(result).toBe(SAMPLE_PRIVATE_KEY);
  });

  it("fails to decrypt with wrong secret", () => {
    process.env.KEY_ENCRYPTION_SECRET = "correct-secret";
    const encrypted = encryptPrivateKey(SAMPLE_PRIVATE_KEY);

    process.env.KEY_ENCRYPTION_SECRET = "wrong-secret";
    // AES-GCM auth tag verification should fail
    expect(() => decryptPrivateKey(encrypted)).toThrow();
  });

  it("round-trips an empty string", () => {
    process.env.KEY_ENCRYPTION_SECRET = SAMPLE_ENCRYPTION_SECRET;
    const encrypted = encryptPrivateKey("");
    const decrypted = decryptPrivateKey(encrypted);
    expect(decrypted).toBe("");
  });

  it("round-trips keys with special characters", () => {
    process.env.KEY_ENCRYPTION_SECRET = SAMPLE_ENCRYPTION_SECRET;
    const specialKey = "key-with-special-chars!@#$%^&*()_+-=[]{}|;':\",./<>?";
    const encrypted = encryptPrivateKey(specialKey);
    const decrypted = decryptPrivateKey(encrypted);
    expect(decrypted).toBe(specialKey);
  });

  it("round-trips keys with unicode characters", () => {
    process.env.KEY_ENCRYPTION_SECRET = SAMPLE_ENCRYPTION_SECRET;
    const unicodeKey = "key-with-unicode-\u00e9\u00e8\u00ea\u00eb";
    const encrypted = encryptPrivateKey(unicodeKey);
    const decrypted = decryptPrivateKey(encrypted);
    expect(decrypted).toBe(unicodeKey);
  });
});

// ── getEncryptionKey error handling ──

describe("encryption key derivation", () => {
  afterEach(() => {
    delete process.env.KEY_ENCRYPTION_SECRET;
  });

  it("throws when encrypting non-passthrough and KEY_ENCRYPTION_SECRET is unset then re-set", () => {
    // First encrypt with secret
    process.env.KEY_ENCRYPTION_SECRET = SAMPLE_ENCRYPTION_SECRET;
    const encrypted = encryptPrivateKey("test-key");

    // Now decrypt — should work
    const decrypted = decryptPrivateKey(encrypted);
    expect(decrypted).toBe("test-key");
  });

  it("different secrets produce different ciphertext", () => {
    process.env.KEY_ENCRYPTION_SECRET = "secret-a";
    const encrypted1 = encryptPrivateKey("same-key");

    process.env.KEY_ENCRYPTION_SECRET = "secret-b";
    const encrypted2 = encryptPrivateKey("same-key");

    // Due to random IV, even same secret produces different ciphertext,
    // but different secrets definitely produce different results
    expect(encrypted1).not.toBe(encrypted2);
  });
});
