import type { DerivativeMarketData, ForecastAsset } from "../types/forecast.js";

function fundingUrl(asset: ForecastAsset) {
  return `https://www.okx.com/api/v5/public/funding-rate-history?instId=${asset}-USDT-SWAP&limit=100`;
}

function openInterestUrl(asset: ForecastAsset) {
  return `https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=${asset}-USDT-SWAP`;
}

type ApiEnvelope<T> = { code?: string; data?: T };
type FundingRow = { fundingRate?: string; fundingTime?: string };
type OpenInterestRow = { oiUsd?: string; ts?: string };

export async function fetchAssetDerivatives(asset: ForecastAsset): Promise<DerivativeMarketData | null> {
  const [fundingResult, openInterestResult] = await Promise.allSettled([
    fetchData<FundingRow[]>(fundingUrl(asset)),
    fetchData<OpenInterestRow[]>(openInterestUrl(asset))
  ]);

  if (fundingResult.status !== "fulfilled" || openInterestResult.status !== "fulfilled") return null;

  const funding = fundingResult.value
    .map((row) => ({ rate: Number(row.fundingRate), timestamp: Number(row.fundingTime) }))
    .filter((row) => Number.isFinite(row.rate) && Number.isFinite(row.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp);
  const openInterest = openInterestResult.value
    .map((row) => ({ value: Number(row.oiUsd), timestamp: Number(row.ts) }))
    .filter((row) => Number.isFinite(row.value) && Number.isFinite(row.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp);

  if (funding.length === 0 || openInterest.length === 0) return null;

  const latestFunding = funding[funding.length - 1];
  const latestOpenInterest = openInterest[openInterest.length - 1];

  return {
    fundingRate: latestFunding.rate,
    fundingRate30DayAverage: average(funding.slice(-90).map((row) => row.rate)),
    openInterestValue: latestOpenInterest.value,
    openInterestChange7Day: null,
    asOfDate: new Date(Math.max(latestFunding.timestamp, latestOpenInterest.timestamp)).toISOString().slice(0, 10)
  };
}

export function fetchBitcoinDerivatives() {
  return fetchAssetDerivatives("BTC");
}

export function applyOpenInterestHistory<T extends { derivativeData?: DerivativeMarketData }>(
  data: DerivativeMarketData | null,
  records: T[]
): DerivativeMarketData | null {
  if (!data) return null;
  const comparisonTime = new Date(`${data.asOfDate}T00:00:00Z`).getTime() - 6 * 24 * 60 * 60 * 1000;
  const baselines = records
    .map((record) => record.derivativeData)
    .filter((snapshot): snapshot is DerivativeMarketData => Boolean(snapshot))
    .filter((snapshot) => new Date(`${snapshot.asOfDate}T00:00:00Z`).getTime() <= comparisonTime)
    .sort((left, right) => left.asOfDate.localeCompare(right.asOfDate));
  const baseline = baselines[baselines.length - 1];

  return {
    ...data,
    openInterestChange7Day: baseline && baseline.openInterestValue > 0
      ? data.openInterestValue / baseline.openInterestValue - 1
      : null
  };
}

async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Derivative market data request failed");
  const payload = await response.json() as ApiEnvelope<T>;
  if (payload.code !== "0" || !Array.isArray(payload.data)) throw new Error("Malformed derivative market data");
  return payload.data;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
