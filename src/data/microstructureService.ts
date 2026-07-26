import type { ForecastAsset, MicrostructureSnapshot } from "../types/forecast.js";
import { average, clamp } from "./forecastModels.js";

const COINBASE_PRODUCTS_URL = "https://api.exchange.coinbase.com/products";
const HOUR_IN_MS = 60 * 60 * 1000;
const RETENTION_IN_MS = 30 * 24 * HOUR_IN_MS;

type CoinbaseBook = { bids?: unknown; asks?: unknown };
type CoinbaseTrade = { side?: unknown; price?: unknown; size?: unknown };

export async function fetchMicrostructureSnapshot(assetSymbol: ForecastAsset): Promise<MicrostructureSnapshot | null> {
  try {
    const product = `${assetSymbol}-USD`;
    const [bookResponse, tradesResponse] = await Promise.all([
      fetch(`${COINBASE_PRODUCTS_URL}/${product}/book?level=2`),
      fetch(`${COINBASE_PRODUCTS_URL}/${product}/trades?limit=100`)
    ]);
    if (!bookResponse.ok || !tradesResponse.ok) return null;

    const [book, trades] = await Promise.all([
      bookResponse.json() as Promise<CoinbaseBook>,
      tradesResponse.json() as Promise<CoinbaseTrade[]>
    ]);
    const bids = parseLevels(book.bids);
    const asks = parseLevels(book.asks);
    if (!bids.length || !asks.length || !Array.isArray(trades)) return null;

    const bidDepthUsd = totalNotional(bids);
    const askDepthUsd = totalNotional(asks);
    const midPrice = (bids[0].price + asks[0].price) / 2;
    const parsedTrades = trades
      .map(parseTrade)
      .filter((trade): trade is { side: "buy" | "sell"; notional: number } => trade !== null);
    const totalTradeNotional = parsedTrades.reduce((total, trade) => total + trade.notional, 0);
    const tradeFlowImbalance = totalTradeNotional
      ? parsedTrades.reduce((total, trade) => total + (trade.side === "buy" ? -trade.notional : trade.notional), 0) / totalTradeNotional
      : null;

    return {
      assetSymbol,
      capturedAt: new Date().toISOString(),
      bidDepthUsd,
      askDepthUsd,
      orderBookImbalance: (bidDepthUsd - askDepthUsd) / (bidDepthUsd + askDepthUsd),
      // Coinbase REST trade side is the resting order side, so taker pressure is inverted.
      tradeFlowImbalance,
      spreadPercent: (asks[0].price - bids[0].price) / midPrice,
      tradeCount: parsedTrades.length
    };
  } catch {
    return null;
  }
}

export function appendMicrostructureSnapshot(
  snapshots: MicrostructureSnapshot[],
  snapshot: MicrostructureSnapshot | null
): MicrostructureSnapshot[] {
  const cutoff = Date.now() - RETENTION_IN_MS;
  const retained = snapshots.filter((item) => Date.parse(item.capturedAt) >= cutoff);
  if (!snapshot) return retained;

  const sameAssetThisHour = retained.findIndex((item) =>
    item.assetSymbol === snapshot.assetSymbol &&
    Math.abs(Date.parse(item.capturedAt) - Date.parse(snapshot.capturedAt)) < HOUR_IN_MS
  );
  if (sameAssetThisHour === -1) return [...retained, snapshot];
  const next = [...retained];
  next[sameAssetThisHour] = snapshot;
  return next;
}

export function calculateMicrostructureAdjustment(
  latest: MicrostructureSnapshot | null,
  snapshots: MicrostructureSnapshot[]
) {
  if (!latest) return 0;
  const comparable = snapshots.filter((item) => item.assetSymbol === latest.assetSymbol).slice(-24);
  if (comparable.length < 12) return 0;

  const orderBookBaseline = average(comparable.map((item) => item.orderBookImbalance));
  const tradeFlowBaseline = average(comparable.map((item) => item.tradeFlowImbalance ?? 0));
  const depthPressure = latest.orderBookImbalance - orderBookBaseline;
  const tradePressure = (latest.tradeFlowImbalance ?? 0) - tradeFlowBaseline;
  return clamp(depthPressure * 0.003 + tradePressure * 0.002, -0.0035, 0.0035);
}

function parseLevels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).flatMap((level) => {
    if (!Array.isArray(level) || level.length < 2) return [];
    const price = Number(level[0]);
    const size = Number(level[1]);
    return Number.isFinite(price) && Number.isFinite(size) && price > 0 && size > 0 ? [{ price, size }] : [];
  });
}

function totalNotional(levels: Array<{ price: number; size: number }>) {
  return levels.reduce((total, level) => total + level.price * level.size, 0);
}

function parseTrade(value: CoinbaseTrade) {
  const side = value.side === "buy" || value.side === "sell" ? value.side : null;
  const price = Number(value.price);
  const size = Number(value.size);
  if (!side || !Number.isFinite(price) || !Number.isFinite(size) || price <= 0 || size <= 0) return null;
  return { side, notional: price * size };
}
