import { describe, expect, it } from "vitest";
import { FORECAST_EVALUATION_VERSION, isComparableForecastRecord, isUtcForecastCreationWindow } from "./forecastSchedule";

describe("forecast schedule", () => {
  it("only opens the record-creation window during the first three UTC hours", () => {
    expect(isUtcForecastCreationWindow(Date.UTC(2026, 8, 8, 0, 15))).toBe(true);
    expect(isUtcForecastCreationWindow(Date.UTC(2026, 8, 8, 2, 59))).toBe(true);
    expect(isUtcForecastCreationWindow(Date.UTC(2026, 8, 8, 3, 0))).toBe(false);
  });

  it("keeps accuracy reporting separate from legacy records", () => {
    expect(isComparableForecastRecord({ targetDate: "2026-09-08", createdAt: "2026-09-08T00:15:00.000Z", baseClose: 100, predictedClose: 101, lowerBound: 99, upperBound: 103, confidence: 50, evaluationVersion: FORECAST_EVALUATION_VERSION })).toBe(true);
    expect(isComparableForecastRecord({ targetDate: "2026-09-08", createdAt: "2026-09-08T00:15:00.000Z", baseClose: 100, predictedClose: 101, lowerBound: 99, upperBound: 103, confidence: 50 })).toBe(false);
  });
});
