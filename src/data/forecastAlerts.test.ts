import { describe, expect, it } from "vitest";
import { detectForecastAlerts } from "./forecastAlerts";
import type { ForecastRecord } from "../types/forecast";

function record(overrides: Partial<ForecastRecord> = {}): ForecastRecord {
  return {
    horizon: "daily",
    targetDate: "2026-07-17",
    createdAt: "2026-07-16T00:00:00.000Z",
    baseClose: 100000,
    predictedClose: 101000,
    lowerBound: 99000,
    upperBound: 103000,
    confidence: 60,
    marketRegime: "range",
    direction: "Neutral",
    ...overrides
  };
}

describe("forecast alerts", () => {
  it("alerts when regime, direction, and confidence materially change", () => {
    const alerts = detectForecastAlerts(
      record(),
      record({ marketRegime: "uptrend", direction: "Bullish", confidence: 77 }),
      []
    );

    expect(alerts).toHaveLength(3);
  });

  it("alerts when a newly settled close is outside its range", () => {
    const alerts = detectForecastAlerts(undefined, record(), [record({ actualClose: 104000 })]);

    expect(alerts[0].title).toBe("BTC moved outside its forecast range");
  });
});
