import { describe, expect, it, vi } from "vitest";
import { getDailyCandleHistory, mergeCandles, parseCandleHistoryCache } from "./candleHistoryService";
import type { BitcoinCandle } from "../types/forecast";

const now = Date.UTC(2026, 6, 20);

function makeCandle(index: number): BitcoinCandle {
  const timestamp = now - (45 - index) * 24 * 60 * 60 * 1000;
  return {
    date: new Date(timestamp).toISOString().slice(0, 10),
    timestamp,
    open: 60000 + index,
    high: 60100 + index,
    low: 59900 + index,
    close: 60020 + index,
    volume: 1000 + index
  };
}

describe("candle history cache", () => {
  it("uses a fresh cache without another Coinbase request", async () => {
    const candles = Array.from({ length: 40 }, (_, index) => makeCandle(index));
    const fetchMock = vi.fn();
    const result = await getDailyCandleHistory("BTC", {
      BTC: { updatedAt: new Date(now - 60_000).toISOString(), candles }
    }, fetchMock as unknown as typeof fetch, now);

    expect(result.candles).toHaveLength(40);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("downloads a cold history in Coinbase-safe chunks and removes duplicate timestamps", async () => {
    const payload = Array.from({ length: 40 }, (_, index) => {
      const candle = makeCandle(index);
      return [candle.timestamp / 1000, candle.low, candle.high, candle.open, candle.close, candle.volume];
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [...payload, payload[0]] });
    const result = await getDailyCandleHistory("BTC", {}, fetchMock as unknown as typeof fetch, now);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.candles).toHaveLength(40);
    expect(result.cache.BTC?.candles).toHaveLength(40);
  });

  it("keeps only valid cached assets and resolves duplicate records by timestamp", () => {
    const candle = makeCandle(0);
    expect(parseCandleHistoryCache({ BTC: { updatedAt: new Date(now).toISOString(), candles: [candle] }, invalid: {} })).toHaveProperty("BTC");
    expect(mergeCandles([candle], [{ ...candle, close: 70000 }])[0].close).toBe(70000);
  });
});
