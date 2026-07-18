import type { ForecastAsset, ForecastRecord } from "../types/forecast.js";

export interface ForecastAlert {
  title: string;
  body: string;
}

export function detectForecastAlerts(
  previous: ForecastRecord | undefined,
  current: ForecastRecord,
  newlySettled: ForecastRecord[],
  assetSymbol: ForecastAsset = "BTC"
): ForecastAlert[] {
  const alerts: ForecastAlert[] = [];

  if (previous?.marketRegime && current.marketRegime && previous.marketRegime !== current.marketRegime) {
    alerts.push({ title: `${assetSymbol} market regime changed`, body: `Market state moved from ${previous.marketRegime} to ${current.marketRegime}.` });
  }
  if (previous?.direction && current.direction && previous.direction !== current.direction) {
    alerts.push({ title: `${assetSymbol} forecast direction changed`, body: `Daily forecast changed from ${previous.direction} to ${current.direction}.` });
  }
  if (previous && Math.abs(current.confidence - previous.confidence) >= 15) {
    alerts.push({ title: `${assetSymbol} forecast confidence changed`, body: `Confidence moved from ${previous.confidence}% to ${current.confidence}%.` });
  }
  newlySettled
    .filter((record) => record.actualClose! < record.lowerBound || record.actualClose! > record.upperBound)
    .forEach((record) => {
      alerts.push({ title: `${assetSymbol} moved outside its forecast range`, body: `${record.targetDate} closed at $${Math.round(record.actualClose!)}, outside the predicted range.` });
    });

  return alerts;
}
