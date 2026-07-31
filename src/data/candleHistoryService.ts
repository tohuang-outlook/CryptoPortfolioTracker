import type { BitcoinCandle, ForecastAsset } from "../types/forecast.js";

const COINBASE_CANDLES_URL = "https://api.exchange.coinbase.com/products";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 730;
// Coinbase limits a candle request to 300 data points. Leave a small buffer for UTC boundaries.
const CHUNK_DAYS = 280;
const REFRESH_LOOKBACK_DAYS = 7;
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

type CoinbaseCandle = [number, number, number, number, number, number];

export interface CandleHistoryCacheEntry {
  updatedAt: string;
  candles: BitcoinCandle[];
}

export type CandleHistoryCache = Partial<Record<ForecastAsset, CandleHistoryCacheEntry>>;

export function parseCandleHistoryCache(value: unknown): CandleHistoryCache {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([asset, entry]) => isForecastAsset(asset) && isCacheEntry(entry))
      .map(([asset, entry]) => {
        const cacheEntry = entry as { updatedAt: string; candles: unknown[] };
        return [asset, {
          updatedAt: cacheEntry.updatedAt,
          candles: cacheEntry.candles.filter(isBitcoinCandle)
        }];
      })
  ) as CandleHistoryCache;
}

export async function getDailyCandleHistory(
  assetSymbol: ForecastAsset,
  cache: CandleHistoryCache,
  fetchImpl: typeof fetch = fetch,
  now = Date.now()
): Promise<{ candles: BitcoinCandle[]; cache: CandleHistoryCache }> {
  const existing = cache[assetSymbol];
  const existingCandles = existing?.candles.filter((candle) => candle.timestamp + DAY_IN_MS <= now) ?? [];
  const cacheIsFresh = existing && now - Date.parse(existing.updatedAt) < CACHE_MAX_AGE_MS;

  if (existingCandles.length >= 35 && cacheIsFresh) {
    return { candles: existingCandles, cache };
  }

  const historyStart = now - HISTORY_DAYS * DAY_IN_MS;
  const cachedStart = existingCandles.length
    ? Math.max(historyStart, existingCandles[existingCandles.length - 1].timestamp - REFRESH_LOOKBACK_DAYS * DAY_IN_MS)
    : historyStart;
  const fetched = await fetchDailyCandleWindows(assetSymbol, cachedStart, now, fetchImpl);
  const candles = mergeCandles(existingCandles, fetched)
    .filter((candle) => candle.timestamp >= historyStart)
    .filter((candle) => candle.timestamp + DAY_IN_MS <= now);

  if (candles.length < 35) {
    throw new Error(`Not enough ${assetSymbol} history to calculate a forecast`);
  }

  return {
    candles,
    cache: {
      ...cache,
      [assetSymbol]: { updatedAt: new Date(now).toISOString(), candles }
    }
  };
}

export async function fetchRecentHourlyCandles(
  assetSymbol: ForecastAsset,
  fetchImpl: typeof fetch = fetch,
  now = Date.now()
): Promise<BitcoinCandle[]> {
  const url = new URL(`${COINBASE_CANDLES_URL}/${assetSymbol}-USD/candles`);
  url.searchParams.set("start", new Date(now - 12 * DAY_IN_MS).toISOString());
  url.searchParams.set("end", new Date(now).toISOString());
  url.searchParams.set("granularity", "3600");
  return fetchCoinbaseCandles(url, fetchImpl, now, 60 * 60 * 1000);
}

export function mergeCandles(...collections: BitcoinCandle[][]): BitcoinCandle[] {
  const byTimestamp = new Map<number, BitcoinCandle>();
  collections.flat().forEach((candle) => byTimestamp.set(candle.timestamp, candle));
  return [...byTimestamp.values()].sort((left, right) => left.timestamp - right.timestamp);
}

function asyncWindows(start: number, end: number) {
  const windows: Array<{ start: number; end: number }> = [];
  for (let cursor = start; cursor < end; cursor += CHUNK_DAYS * DAY_IN_MS) {
    windows.push({ start: cursor, end: Math.min(cursor + CHUNK_DAYS * DAY_IN_MS, end) });
  }
  return windows;
}

async function fetchDailyCandleWindows(assetSymbol: ForecastAsset, start: number, end: number, fetchImpl: typeof fetch) {
  const results: BitcoinCandle[][] = [];
  // Sequential requests are friendlier to Coinbase's public endpoint than a burst of parallel windows.
  for (const window of asyncWindows(start, end)) {
    const url = new URL(`${COINBASE_CANDLES_URL}/${assetSymbol}-USD/candles`);
    url.searchParams.set("start", new Date(window.start).toISOString());
    url.searchParams.set("end", new Date(window.end).toISOString());
    url.searchParams.set("granularity", "86400");
    results.push(await fetchCoinbaseCandles(url, fetchImpl, end, DAY_IN_MS));
  }
  return mergeCandles(...results);
}

async function fetchCoinbaseCandles(url: URL, fetchImpl: typeof fetch, now: number, candleDuration: number) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error("Coinbase candle request failed");
  const payload = await response.json() as unknown;
  if (!Array.isArray(payload)) throw new Error("Malformed Coinbase candle payload");

  return payload
    .map(readCoinbaseCandle)
    .filter((candle): candle is BitcoinCandle => candle !== null)
    .filter((candle) => candle.timestamp + candleDuration <= now)
    .sort((left, right) => left.timestamp - right.timestamp);
}

function readCoinbaseCandle(value: unknown): BitcoinCandle | null {
  if (!Array.isArray(value) || value.length < 6) return null;
  const [timestamp, low, high, open, close, volume] = value as CoinbaseCandle;
  if (![timestamp, low, high, open, close, volume].every((item) => typeof item === "number" && Number.isFinite(item))) return null;

  return {
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    timestamp: timestamp * 1000,
    low,
    high,
    open,
    close,
    volume
  };
}

function isCacheEntry(value: unknown): value is { updatedAt: string; candles: unknown[] } {
  return Boolean(value) && typeof value === "object" &&
    typeof (value as { updatedAt?: unknown }).updatedAt === "string" &&
    Array.isArray((value as { candles?: unknown }).candles);
}

function isBitcoinCandle(value: unknown): value is BitcoinCandle {
  if (!value || typeof value !== "object") return false;
  const candle = value as Partial<BitcoinCandle>;
  return typeof candle.date === "string" && [candle.timestamp, candle.open, candle.high, candle.low, candle.close, candle.volume]
    .every((item) => typeof item === "number" && Number.isFinite(item));
}

function isForecastAsset(value: string): value is ForecastAsset {
  return ["BTC", "ETH", "ADA", "SOL", "XRP", "DOGE"].includes(value);
}
