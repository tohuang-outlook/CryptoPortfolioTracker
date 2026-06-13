import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSupportedPrices } from "./priceService";

describe("fetchSupportedPrices", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps provider response into the local price shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bitcoin: { usd: 65000 },
          ethereum: { usd: 2500 },
          solana: { usd: 150 },
          ripple: { usd: 1.1 },
          cardano: { usd: 0.45 },
          dogecoin: { usd: 0.2 }
        })
      })
    );

    const prices = await fetchSupportedPrices();

    expect(prices.BTC).toBe(65000);
    expect(prices.ETH).toBe(2500);
    expect(prices.SOL).toBe(150);
    expect(prices.XRP).toBe(1.1);
    expect(prices.ADA).toBe(0.45);
    expect(prices.DOGE).toBe(0.2);
  });
});
