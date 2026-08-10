import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recordError, getStats, __resetForTest } from "./error-tracker";

beforeEach(() => {
  __resetForTest();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("error-tracker", () => {
  it("recordError increments total in getStats", () => {
    recordError("mine_not_found");
    expect(getStats().total).toBe(1);
  });

  it("getStats returns correct byCode breakdown", () => {
    recordError("mine_not_found");
    recordError("mine_not_found");
    recordError("parse_failure");

    const { byCode } = getStats();
    expect(byCode["mine_not_found"]).toBe(2);
    expect(byCode["parse_failure"]).toBe(1);
  });

  it("getStats returns windowMs = 60000", () => {
    expect(getStats().windowMs).toBe(60_000);
  });

  it("evicts entries older than 60s window", () => {
    recordError("mine_not_found");
    vi.advanceTimersByTime(61_000);
    recordError("parse_failure");

    const { byCode, total } = getStats();
    expect(total).toBe(1);
    expect(byCode["parse_failure"]).toBe(1);
    expect(byCode["mine_not_found"]).toBeUndefined();
  });

  it("fires console.error ALERT when count reaches threshold (5)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    for (let i = 0; i < 5; i++) {
      recordError("mine_not_found");
    }

    expect(spy).toHaveBeenCalledOnce();
    const logged = JSON.parse((spy.mock.calls[0] as string[])[0]);
    expect(logged.level).toBe("ALERT");
    expect(logged.event).toBe("error_rate_threshold_exceeded");
    expect(logged.count).toBe(5);
  });

  it("__resetForTest clears all state", () => {
    recordError("mine_not_found");
    recordError("parse_failure");
    __resetForTest();
    expect(getStats().total).toBe(0);
  });
});
