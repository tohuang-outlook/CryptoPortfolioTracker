import { afterEach, describe, expect, it, vi } from "vitest";
import { applyOpenInterestHistory, fetchBitcoinDerivatives } from "./derivativesService";

afterEach(() => vi.unstubAllGlobals());

describe("derivatives service", () => {
  it("parses public funding and open-interest snapshots", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ code: "0", data: [
        { fundingRate: "0.0002", fundingTime: "1784412000000" },
        { fundingRate: "0.0001", fundingTime: "1784383200000" }
      ] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ code: "0", data: [
        { oiUsd: "2000000000", ts: "1784412000000" }
      ] }) }));

    const result = await fetchBitcoinDerivatives();

    expect(result?.fundingRate).toBe(0.0002);
    expect(result?.openInterestValue).toBe(2_000_000_000);
    expect(result?.openInterestChange7Day).toBeNull();
  });

  it("uses prior journal snapshots to calculate open-interest change", () => {
    const result = applyOpenInterestHistory({
      fundingRate: 0.0001,
      fundingRate30DayAverage: 0.0001,
      openInterestValue: 2_200_000_000,
      openInterestChange7Day: null,
      asOfDate: "2026-07-19"
    }, [{ derivativeData: {
      fundingRate: 0.0001,
      fundingRate30DayAverage: 0.0001,
      openInterestValue: 2_000_000_000,
      openInterestChange7Day: null,
      asOfDate: "2026-07-12"
    } }]);

    expect(result?.openInterestChange7Day).toBeCloseTo(0.1);
  });
});
