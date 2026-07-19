import type { ForecastAsset, OnChainMarketData } from "../types/forecast.js";

const METRICS_URL = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics";

type MetricRow = {
  time?: string;
  AdrActCnt?: string;
  TxCnt?: string;
  FeeTotNtv?: string;
};

export async function fetchOnChainMetrics(asset: ForecastAsset): Promise<OnChainMarketData | null> {
  const url = new URL(METRICS_URL);
  url.searchParams.set("assets", asset.toLowerCase());
  url.searchParams.set("metrics", "AdrActCnt,TxCnt,FeeTotNtv");
  url.searchParams.set("frequency", "1d");
  url.searchParams.set("page_size", "14");

  const response = await fetch(url);
  if (!response.ok) return null;
  const payload = await response.json() as { data?: MetricRow[] };
  const rows = (payload.data ?? [])
    .map((row) => ({
      date: row.time?.slice(0, 10) ?? "",
      activeAddresses: Number(row.AdrActCnt),
      transactionCount: Number(row.TxCnt),
      totalFeesNative: Number(row.FeeTotNtv)
    }))
    .filter((row) => row.date && Number.isFinite(row.activeAddresses) && Number.isFinite(row.transactionCount))
    .sort((left, right) => left.date.localeCompare(right.date));
  if (rows.length < 8) return null;

  const latest = rows[rows.length - 1];
  const baseline = average(rows.slice(-8, -1));
  return {
    activeAddresses: latest.activeAddresses,
    transactionCount: latest.transactionCount,
    totalFeesNative: Number.isFinite(latest.totalFeesNative) ? latest.totalFeesNative : 0,
    activeAddressesChange7Day: latest.activeAddresses / baseline.activeAddresses - 1,
    transactionCountChange7Day: latest.transactionCount / baseline.transactionCount - 1,
    asOfDate: latest.date
  };
}

export function calculateOnChainAdjustment(data: OnChainMarketData | null) {
  if (!data) return 0;
  const activity = (data.activeAddressesChange7Day + data.transactionCountChange7Day) / 2;
  return Math.max(-0.004, Math.min(0.004, activity * 0.015));
}

function average(rows: Array<{ activeAddresses: number; transactionCount: number }>) {
  return rows.reduce((total, row) => ({
    activeAddresses: total.activeAddresses + row.activeAddresses / rows.length,
    transactionCount: total.transactionCount + row.transactionCount / rows.length
  }), { activeAddresses: 0, transactionCount: 0 });
}
