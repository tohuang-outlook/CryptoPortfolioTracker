import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOnChainRegime, fetchOnChainMetrics } from "./onChainService";
import type { OnChainMarketData } from "../types/forecast";

afterEach(() => vi.unstubAllGlobals());

function onChain(overrides: Partial<OnChainMarketData> = {}): OnChainMarketData {
  return {
    assetSymbol: "BTC",
    activeAddresses: 600_000,
    transactionCount: 700_000,
    totalFeesNative: 3,
    activeAddressesChange7Day: 0.02,
    transactionCountChange7Day: 0.01,
    mvrv: 1.5,
    mvrvChange30Day: 0,
    asOfDate: "2026-09-09",
    ...overrides
  };
}

describe("on-chain service", () => {
  it("adds BTC MVRV to the public activity request and calculates its 30-day change", async () => {
    const rows = Array.from({ length: 31 }, (_, index) => ({
      time: `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00.000000000Z`,
      AdrActCnt: String(500_000 + index * 1_000),
      TxCnt: String(600_000 + index * 1_000),
      FeeTotNtv: "2.5",
      CapMVRVCur: String(1.2 + index * 0.01)
    }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: rows }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchOnChainMetrics("BTC");

    expect(String(fetchMock.mock.calls[0][0])).toContain("CapMVRVCur");
    expect(result?.mvrv).toBeCloseTo(1.5);
    expect(result?.mvrvChange30Day).toBeGreaterThan(0);
  });

  it("uses valuation state only to control forecast risk", () => {
    expect(buildOnChainRegime(onChain({ mvrv: 0.95 })).id).toBe("capitulation");
    expect(buildOnChainRegime(onChain({ mvrv: 1.1, mvrvChange30Day: -0.02 })).id).toBe("accumulation");
    const distribution = buildOnChainRegime(onChain({ mvrv: 2.6, mvrvChange30Day: 0.08 }));
    expect(distribution.id).toBe("distribution");
    expect(distribution.rangeMultiplier).toBeGreaterThan(1);
  });

  it("keeps the regime inactive without a complete BTC valuation snapshot", () => {
    expect(buildOnChainRegime(onChain({ assetSymbol: "ETH", mvrv: null, mvrvChange30Day: null })).id).toBe("unavailable");
  });
});
