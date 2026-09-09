import type { ForecastRecord } from "../types/forecast.js";

export const FORECAST_EVALUATION_VERSION = 2;

// Daily candles close at 00:00 UTC. Keeping a short, fixed window gives every
// saved daily forecast nearly a full session before its target close.
export function isUtcForecastCreationWindow(now = Date.now()) {
  return new Date(now).getUTCHours() < 3;
}

export function isComparableForecastRecord(record: ForecastRecord) {
  return record.evaluationVersion === FORECAST_EVALUATION_VERSION;
}
