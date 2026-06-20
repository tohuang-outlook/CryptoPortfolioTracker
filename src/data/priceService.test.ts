import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSupportedPrices } from "./priceService";

describe("fetchSupportedPrices", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses Coinbase spot prices when all supported assets resolve", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              amount: coinbaseAmountByUrl[url]
            }
          })
        })
      )
    );

    const prices = await fetchSupportedPrices();

    expect(prices).toEqual({
      BTC: 65000,
      ETH: 2500,
      SOL: 150,
      XRP: 1.1,
      ADA: 0.45,
      DOGE: 0.2
    });
  });

  it("falls back to CoinGecko when Coinbase responds with a non-ok status", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("api.coinbase.com")) {
        return Promise.resolve({ ok: false });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          bitcoin: { usd: 64000 },
          ethereum: { usd: 2400 },
          solana: { usd: 145 },
          ripple: { usd: 1.05 },
          cardano: { usd: 0.42 },
          dogecoin: { usd: 0.19 }
        })
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const prices = await fetchSupportedPrices();

    expect(prices).toEqual({
      BTC: 64000,
      ETH: 2400,
      SOL: 145,
      XRP: 1.05,
      ADA: 0.42,
      DOGE: 0.19
    });
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it("falls back to CoinGecko when Coinbase returns malformed data", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("BTC-USD")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: { amount: "" }
          })
        });
      }

      if (url.includes("api.coinbase.com")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: { amount: coinbaseAmountByUrl[url] }
          })
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          bitcoin: { usd: 63000 },
          ethereum: { usd: 2350 },
          solana: { usd: 140 },
          ripple: { usd: 1.0 },
          cardano: { usd: 0.4 },
          dogecoin: { usd: 0.18 }
        })
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const prices = await fetchSupportedPrices();

    expect(prices).toEqual({
      BTC: 63000,
      ETH: 2350,
      SOL: 140,
      XRP: 1,
      ADA: 0.4,
      DOGE: 0.18
    });
  });

  it("throws when both Coinbase and CoinGecko fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false
      })
    );

    await expect(fetchSupportedPrices()).rejects.toThrow(
      "Unable to fetch prices"
    );
  });

  it("throws when the CoinGecko fallback payload is malformed", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("api.coinbase.com")) {
        return Promise.resolve({ ok: false });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          bitcoin: { usd: 65000 },
          ethereum: { usd: 2500 },
          solana: { usd: 150 },
          ripple: { usd: 1.1 },
          cardano: { usd: 0.45 }
        })
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSupportedPrices()).rejects.toThrow(
      "Malformed price payload"
    );
  });
});

const coinbaseAmountByUrl: Record<string, string> = {
  "https://api.coinbase.com/v2/prices/BTC-USD/spot": "65000",
  "https://api.coinbase.com/v2/prices/ETH-USD/spot": "2500",
  "https://api.coinbase.com/v2/prices/SOL-USD/spot": "150",
  "https://api.coinbase.com/v2/prices/XRP-USD/spot": "1.1",
  "https://api.coinbase.com/v2/prices/ADA-USD/spot": "0.45",
  "https://api.coinbase.com/v2/prices/DOGE-USD/spot": "0.2"
};
