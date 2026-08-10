import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/text-query/error-tracker", () => ({
  getStats: vi.fn().mockReturnValue({ total: 3, byCode: { mine_not_found: 2, parse_failure: 1 }, windowMs: 60_000 }),
}));

import { GET } from "./route";

describe("GET /api/text-query/stats", () => {
  it("returns 200 with total, byCode, and windowMs", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(typeof body.total).toBe("number");
    expect(typeof body.byCode).toBe("object");
    expect(body.windowMs).toBe(60_000);
  });

  it("byCode reflects recorded errors from getStats", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.byCode["mine_not_found"]).toBe(2);
    expect(body.byCode["parse_failure"]).toBe(1);
  });
});
