import type { ForecastAsset, OnChainMarketData, OnChainRegime } from "../types/forecast.js";

const METRICS_URL = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics";

type MetricRow = {
  time?: string;
  AdrActCnt?: string;
  TxCnt?: string;
  FeeTotNtv?: string;
  CapMVRVCur?: string;
};

export async function fetchOnChainMetrics(asset: ForecastAsset): Promise<OnChainMarketData | null> {
  const url = new URL(METRICS_URL);
  url.searchParams.set("assets", asset.toLowerCase());
  // MVRV is publicly available for BTC. Other assets keep their activity signal.
  url.searchParams.set("metrics", asset === "BTC" ? "AdrActCnt,TxCnt,FeeTotNtv,CapMVRVCur" : "AdrActCnt,TxCnt,FeeTotNtv");
  url.searchParams.set("frequency", "1d");
  url.searchParams.set("page_size", "45");

  const response = await fetch(url);
  if (!response.ok) return null;
  const payload = await response.json() as { data?: MetricRow[] };
  const rows = (payload.data ?? [])
    .map((row) => ({
      date: row.time?.slice(0, 10) ?? "",
      activeAddresses: Number(row.AdrActCnt),
      transactionCount: Number(row.TxCnt),
      totalFeesNative: Number(row.FeeTotNtv),
      mvrv: Number(row.CapMVRVCur)
    }))
    .filter((row) => row.date && Number.isFinite(row.activeAddresses) && Number.isFinite(row.transactionCount))
    .sort((left, right) => left.date.localeCompare(right.date));
  if (rows.length < 8) return null;

  const latest = rows[rows.length - 1];
  const baseline = average(rows.slice(-8, -1));
  const mvrvRows = rows.filter((row) => Number.isFinite(row.mvrv));
  const mvrvBaseline = mvrvRows.slice(-31, -1);
  return {
    assetSymbol: asset,
    activeAddresses: latest.activeAddresses,
    transactionCount: latest.transactionCount,
    totalFeesNative: Number.isFinite(latest.totalFeesNative) ? latest.totalFeesNative : 0,
    activeAddressesChange7Day: latest.activeAddresses / baseline.activeAddresses - 1,
    transactionCountChange7Day: latest.transactionCount / baseline.transactionCount - 1,
    mvrv: Number.isFinite(latest.mvrv) ? latest.mvrv : null,
    mvrvChange30Day: mvrvBaseline.length >= 20 && Number.isFinite(latest.mvrv)
      ? latest.mvrv / averageNumber(mvrvBaseline.map((row) => row.mvrv)) - 1
      : null,
    asOfDate: latest.date
  };
}

export function calculateOnChainAdjustment(data: OnChainMarketData | null) {
  if (!data) return 0;
  const activity = (data.activeAddressesChange7Day + data.transactionCountChange7Day) / 2;
  return Math.max(-0.004, Math.min(0.004, activity * 0.015));
}

/**
 * Uses slow-moving on-chain valuation to set forecast caution, never to force a price direction.
 * The regime is BTC-only because the public feed does not provide equivalent valuation data for every asset.
 */
export function buildOnChainRegime(data: OnChainMarketData | null): OnChainRegime {
  if (!data || data.assetSymbol !== "BTC" || data.mvrv === null || data.mvrvChange30Day === null) {
    return { id: "unavailable", label: "Unavailable", detail: "BTC valuation data is unavailable, so on-chain regime has no weight.", rangeMultiplier: 1, confidencePenalty: 0 };
  }

  const activityChange = (data.activeAddressesChange7Day + data.transactionCountChange7Day) / 2;
  if (data.mvrv < 1) {
    return { id: "capitulation", label: "Capitulation", detail: "MVRV is below 1.0, indicating stress versus the aggregate on-chain cost basis. The forecast range is widened.", rangeMultiplier: 1.15, confidencePenalty: 5 };
  }
  if (data.mvrv < 1.2 && activityChange >= -0.05) {
    return { id: "accumulation", label: "Accumulation", detail: "MVRV is near the realized-value zone while network activity remains stable. The model stays cautious rather than forcing a bullish call.", rangeMultiplier: 1.06, confidencePenalty: 2 };
  }
  if (data.mvrv > 2.4 && data.mvrvChange30Day > 0.04) {
    return { id: "distribution", label: "Distribution risk", detail: "MVRV is elevated and rising versus its 30-day baseline. The model widens its range and reduces confidence.", rangeMultiplier: 1.14, confidencePenalty: 5 };
  }
  return { id: "neutral", label: "Neutral valuation", detail: "MVRV and network activity are not at an extreme. On-chain data provides context without changing the price target.", rangeMultiplier: 1, confidencePenalty: 0 };
}

function average(rows: Array<{ activeAddresses: number; transactionCount: number }>) {
  return rows.reduce((total, row) => ({
    activeAddresses: total.activeAddresses + row.activeAddresses / rows.length,
    transactionCount: total.transactionCount + row.transactionCount / rows.length
  }), { activeAddresses: 0, transactionCount: 0 });
}

function averageNumber(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}
