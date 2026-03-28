import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the SlidingWindowLimiter class and getClientIp function.
// The module exports singleton instances (apiKeyLimiter, ipLimiter) and the class
// is not exported directly, but we can test through the exported instances
// and by creating the module fresh.

// Import the actual module — these are in-memory, no DB needed
import { apiKeyLimiter, ipLimiter, getClientIp } from "../rate-limit";

// ── SlidingWindowLimiter via apiKeyLimiter (100 req/s) ──

describe("SlidingWindowLimiter (apiKeyLimiter: 100 req/s)", () => {
  it("allows the first request", () => {
    const result = apiKeyLimiter.check("test-key-first");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
    expect(result.retryAfterMs).toBe(0);
  });

  it("allows requests up to the limit", () => {
    const key = "test-key-up-to-limit";
    for (let i = 0; i < 100; i++) {
      const result = apiKeyLimiter.check(key);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99 - i);
    }
  });

  it("rejects the 101st request within the window", () => {
    const key = "test-key-over-limit";
    for (let i = 0; i < 100; i++) {
      apiKeyLimiter.check(key);
    }
    const result = apiKeyLimiter.check(key);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("returns correct remaining count", () => {
    const key = "test-key-remaining";
    const r1 = apiKeyLimiter.check(key);
    expect(r1.remaining).toBe(99);

    const r2 = apiKeyLimiter.check(key);
    expect(r2.remaining).toBe(98);

    const r3 = apiKeyLimiter.check(key);
    expect(r3.remaining).toBe(97);
  });

  it("different keys are independent", () => {
    const keyA = "test-key-independent-a";
    const keyB = "test-key-independent-b";

    // Exhaust key A
    for (let i = 0; i < 100; i++) {
      apiKeyLimiter.check(keyA);
    }

    // Key B should still be fresh
    const result = apiKeyLimiter.check(keyB);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);

    // Key A should be blocked
    const resultA = apiKeyLimiter.check(keyA);
    expect(resultA.allowed).toBe(false);
  });

  it("retry-after is positive when rate limited", () => {
    const key = "test-key-retry-after";
    for (let i = 0; i < 100; i++) {
      apiKeyLimiter.check(key);
    }
    const result = apiKeyLimiter.check(key);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(1000); // window is 1s
  });

  it("retry-after is 0 when allowed", () => {
    const result = apiKeyLimiter.check("test-key-no-retry");
    expect(result.retryAfterMs).toBe(0);
  });
});

// ── SlidingWindowLimiter via ipLimiter (20 req/s) ──

describe("SlidingWindowLimiter (ipLimiter: 20 req/s)", () => {
  it("allows up to 20 requests", () => {
    const ip = "192.168.1.100";
    for (let i = 0; i < 20; i++) {
      const result = ipLimiter.check(ip);
      expect(result.allowed).toBe(true);
    }
  });

  it("rejects the 21st request", () => {
    const ip = "192.168.1.101";
    for (let i = 0; i < 20; i++) {
      ipLimiter.check(ip);
    }
    const result = ipLimiter.check(ip);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

// ── Window expiration ──

describe("window expiration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resets after the window expires", () => {
    const key = "test-key-expire";
    // Exhaust the limit
    for (let i = 0; i < 100; i++) {
      apiKeyLimiter.check(key);
    }
    expect(apiKeyLimiter.check(key).allowed).toBe(false);

    // Advance time past the 1-second window
    vi.advanceTimersByTime(1001);

    // Should be allowed again
    const result = apiKeyLimiter.check(key);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it("a new window starts fresh after expiration", () => {
    const key = "test-key-fresh-window";

    // Use some requests
    for (let i = 0; i < 50; i++) {
      apiKeyLimiter.check(key);
    }

    // Advance past window
    vi.advanceTimersByTime(1001);

    // Full quota should be available
    const result = apiKeyLimiter.check(key);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99); // 100 - 1
  });
});

// ── getClientIp ──

describe("getClientIp", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.50" },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("extracts first IP when multiple are in x-forwarded-for", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18, 150.172.238.178" },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("trims whitespace from the IP", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "  203.0.113.50  " },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("returns 'unknown' when no forwarded header exists", () => {
    const request = new Request("http://localhost");
    expect(getClientIp(request)).toBe("unknown");
  });
});
