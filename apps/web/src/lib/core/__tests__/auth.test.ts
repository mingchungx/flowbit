import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import {
  generateApiKey,
  hashApiKey,
  AuthenticationError,
  AuthorizationError,
} from "../auth";

// ── generateApiKey ──

describe("generateApiKey", () => {
  it("generates agent keys with fb_live_ prefix", () => {
    const { raw } = generateApiKey("agent");
    expect(raw.startsWith("fb_live_")).toBe(true);
  });

  it("generates admin keys with fb_admin_ prefix", () => {
    const { raw } = generateApiKey("admin");
    expect(raw.startsWith("fb_admin_")).toBe(true);
  });

  it("returns both raw key and hash", () => {
    const { raw, hash } = generateApiKey("agent");
    expect(raw).toBeDefined();
    expect(hash).toBeDefined();
    expect(typeof raw).toBe("string");
    expect(typeof hash).toBe("string");
  });

  it("generates hash that matches hashApiKey of the raw key", () => {
    const { raw, hash } = generateApiKey("agent");
    expect(hash).toBe(hashApiKey(raw));
  });

  it("generates unique keys on each call", () => {
    const keys = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const { raw } = generateApiKey("agent");
      keys.add(raw);
    }
    expect(keys.size).toBe(50);
  });

  it("generates unique hashes on each call", () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const { hash } = generateApiKey("agent");
      hashes.add(hash);
    }
    expect(hashes.size).toBe(50);
  });

  it("generates keys with sufficient length for security", () => {
    const { raw } = generateApiKey("agent");
    // Prefix "fb_live_" = 8 chars, random = 24 bytes in base64url = 32 chars
    // Total should be at least 40 characters
    expect(raw.length).toBeGreaterThanOrEqual(40);
  });

  it("raw key contains only valid characters", () => {
    const { raw } = generateApiKey("agent");
    // base64url charset + prefix chars (fb_live_ or fb_admin_)
    expect(raw).toMatch(/^fb_(live|admin)_[A-Za-z0-9_-]+$/);
  });
});

// ── hashApiKey ──

describe("hashApiKey", () => {
  it("produces deterministic output for the same input", () => {
    const hash1 = hashApiKey("fb_live_testkey123");
    const hash2 = hashApiKey("fb_live_testkey123");
    expect(hash1).toBe(hash2);
  });

  it("produces different output for different inputs", () => {
    const hash1 = hashApiKey("fb_live_key1");
    const hash2 = hashApiKey("fb_live_key2");
    expect(hash1).not.toBe(hash2);
  });

  it("returns a 64-character hex string (SHA-256)", () => {
    const hash = hashApiKey("fb_live_testkey");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("matches manual SHA-256 computation", () => {
    const input = "fb_live_manual_check";
    const expected = createHash("sha256").update(input).digest("hex");
    expect(hashApiKey(input)).toBe(expected);
  });

  it("handles empty string", () => {
    const hash = hashApiKey("");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("handles very long input", () => {
    const longKey = "fb_live_" + "a".repeat(1000);
    const hash = hashApiKey(longKey);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("handles special characters in input", () => {
    const hash = hashApiKey("fb_live_key+with/special=chars");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ── Error class constructors ──

describe("AuthenticationError", () => {
  it("has correct name", () => {
    const err = new AuthenticationError("test message");
    expect(err.name).toBe("AuthenticationError");
  });

  it("preserves error message", () => {
    const err = new AuthenticationError("Invalid API key");
    expect(err.message).toBe("Invalid API key");
  });

  it("is an instance of Error", () => {
    const err = new AuthenticationError("test");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("AuthorizationError", () => {
  it("has correct name", () => {
    const err = new AuthorizationError("test message");
    expect(err.name).toBe("AuthorizationError");
  });

  it("preserves error message", () => {
    const err = new AuthorizationError("Admin access required");
    expect(err.message).toBe("Admin access required");
  });

  it("is an instance of Error", () => {
    const err = new AuthorizationError("test");
    expect(err).toBeInstanceOf(Error);
  });
});
