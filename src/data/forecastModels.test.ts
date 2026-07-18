import { describe, expect, it } from "vitest";
import {
  buildDailyEnsemble,
  calculateDerivativeAdjustment,
  calculateRangeCalibration,
  detectMarketRegime,
  evaluateForecastBenchmark
} from "./forecastModels";
import type { BitcoinCandle } from "../types/forecast";

function makeCandles(count: number): BitcoinCandle[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 60000 + index * 120 + Math.sin(index / 3) * 900;
    return {
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
      timestamp: Date.UTC(2026, 0, index + 1),
      open: close - 120,
      high: close + 350,
      low: close - 350,
      close,
      volume: 1000 + (index % 9) * 130
    };
  });
}

describe("daily forecast ensemble", () => {
  it("evaluates every candidate with walk-forward samples and normalizes model weights", () => {
    const result = buildDailyEnsemble(makeCandles(90));

    expect(result.leaderboard).toHaveLength(3);
    expect(result.leaderboard.map((model) => model.id)).toEqual(
      expect.arrayContaining(["technical", "trend", "meanReversion"])
    );
    expect(result.leaderboard.every((model) => model.evaluatedDays > 0)).toBe(true);
    expect(result.leaderboard.reduce((total, model) => total + model.weight, 0)).toBeCloseTo(1, 8);
    expect(result.expectedReturn).toBeGreaterThanOrEqual(-0.12);
    expect(result.expectedReturn).toBeLessThanOrEqual(0.12);
  });

  it("needs enough history for a walk-forward forecast", () => {
    expect(() => buildDailyEnsemble(makeCandles(30))).toThrow("Not enough Bitcoin history");
  });

  it("identifies a rising market state and prioritizes the trend model", () => {
    const result = buildDailyEnsemble(makeCandles(90));

    expect(detectMarketRegime(makeCandles(90)).id).toBe("uptrend");
    expect(result.leaderboard.find((model) => model.id === "trend")!.weight).toBeGreaterThan(0);
  });

  it("widens future ranges when settled forecasts miss the target coverage", () => {
    const calibration = calculateRangeCalibration(
      Array.from({ length: 10 }, () => ({
        horizon: "daily" as const,
        lowerBound: 99,
        upperBound: 101,
        actualClose: 105
      })),
      "daily"
    );

    expect(calibration.observedCoverage).toBe(0);
    expect(calibration.multiplier).toBeGreaterThan(1);
  });

  it("compares the ensemble against naive and trend baselines without future candles", () => {
    const benchmark = evaluateForecastBenchmark(makeCandles(90));

    expect(benchmark.ensemble.evaluatedDays).toBeGreaterThan(0);
    expect(benchmark.naive.evaluatedDays).toBe(benchmark.ensemble.evaluatedDays);
    expect(benchmark.trend.evaluatedDays).toBe(benchmark.ensemble.evaluatedDays);
  });

  it("keeps derivative adjustments bounded", () => {
    const adjustment = calculateDerivativeAdjustment({
      fundingRate: 0.001,
      fundingRate30DayAverage: 0.0001,
      openInterestValue: 10_000_000_000,
      openInterestChange7Day: 0.2,
      asOfDate: "2026-07-19"
    }, 0.04);

    expect(adjustment).toBeGreaterThanOrEqual(-0.007);
    expect(adjustment).toBeLessThanOrEqual(0.007);
  });
});
