import { describe, expect, it } from "vitest";
import {
  buildDailyEnsemble,
  buildDirectionModel,
  buildForecastDecision,
  buildMultiTimeframeSignal,
  buildVolatilityModel,
  calculateDirectionProbabilityCalibration,
  calculateDerivativeAdjustment,
  calculateProbabilisticRange,
  calculateRangeCalibration,
  detectMarketRegime,
  evaluateFeatureAblation,
  evaluateForecastBenchmark,
  getAutoExcludedFeatures
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

function makeHourlyCandles(count: number, hourlyMove = 0.002): BitcoinCandle[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 60000 * (1 + hourlyMove) ** index;
    return {
      date: new Date(Date.UTC(2026, 3, 1, index)).toISOString().slice(0, 10),
      timestamp: Date.UTC(2026, 3, 1, index),
      open: close * 0.999,
      high: close * 1.002,
      low: close * 0.998,
      close,
      volume: 1000
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

  it("keeps the minimum usable history inside the available candle range", () => {
    expect(buildDailyEnsemble(makeCandles(31)).leaderboard).toHaveLength(3);
  });

  it("identifies a rising market state and prioritizes the trend model", () => {
    const result = buildDailyEnsemble(makeCandles(90));

    expect(detectMarketRegime(makeCandles(90)).id).toBe("uptrend");
    expect(result.leaderboard.find((model) => model.id === "trend")!.weight).toBeGreaterThan(0);
  });

  it("widens the probability range when model disagreement and regime risk increase", () => {
    const calmRange = calculateProbabilisticRange({
      volatility: 0.015,
      modelDispersion: 0.003,
      marketRegime: "range",
      calibrationMultiplier: 1
    });
    const volatileRange = calculateProbabilisticRange({
      volatility: 0.035,
      modelDispersion: 0.02,
      marketRegime: "volatile",
      calibrationMultiplier: 1
    });

    expect(volatileRange).toBeGreaterThan(calmRange);
  });

  it("returns normalized direction probabilities and a walk-forward score", () => {
    const direction = buildDirectionModel(makeCandles(100), 0.012);

    expect(direction.probabilityUp + direction.probabilityDown + direction.probabilityNeutral).toBeCloseTo(1, 8);
    expect(direction.probabilityUp).toBeGreaterThan(direction.probabilityDown);
    expect(direction.evaluatedDays).toBeGreaterThan(0);
  });

  it("shrinks return influence until the active market regime has enough evidence", () => {
    const result = buildDailyEnsemble(makeCandles(90));

    expect(result.regimeReliability.marketRegime).toBe("uptrend");
    expect(result.regimeReliability.returnMultiplier).toBeLessThanOrEqual(1.06);
    expect(result.regimeReliability.confidencePenalty).toBeGreaterThanOrEqual(0);
  });

  it("calibrates direction probabilities from settled forecasts and flags poor calibration", () => {
    const records = Array.from({ length: 12 }, (_, index) => ({
      horizon: "daily" as const,
      baseClose: 100,
      actualClose: index < 9 ? 101 : 99,
      directionModel: {
        direction: "Bullish" as const,
        probabilityUp: 0.72,
        probabilityDown: 0.16,
        probabilityNeutral: 0.12,
        directionalAccuracy: 55,
        evaluatedDays: 60
      }
    }));
    const calibrated = calculateDirectionProbabilityCalibration(records);
    const caution = calculateDirectionProbabilityCalibration(records.map((record) => ({ ...record, actualClose: 99 })));

    expect(calibrated.status).toBe("calibrated");
    expect(calibrated.realizedAccuracy).toBeCloseTo(0.75, 8);
    expect(caution.status).toBe("caution");
  });

  it("uses a higher expected move when recent closes are more volatile", () => {
    const calm = buildVolatilityModel(makeCandles(100));
    const volatileCandles = makeCandles(100).map((candle, index) => ({
      ...candle,
      close: candle.close * (index % 2 === 0 ? 1.09 : 0.91)
    }));
    const volatile = buildVolatilityModel(volatileCandles);

    expect(volatile.expectedDailyMovePercent).toBeGreaterThan(calm.expectedDailyMovePercent);
  });

  it("uses aligned hourly, four-hour, and daily trends as a bounded confirmation signal", () => {
    const signal = buildMultiTimeframeSignal(makeHourlyCandles(72), makeCandles(90));

    expect(signal.alignment).toBe("bullish");
    expect(signal.hourlyTrend).not.toBeNull();
    expect(signal.fourHourTrend).not.toBeNull();
    expect(signal.adjustment).toBeGreaterThan(0);
  });

  it("only opens the decision gate when a validated signal is aligned and strong", () => {
    const multiTimeframe = buildMultiTimeframeSignal(makeHourlyCandles(72), makeCandles(90));
    const decision = buildForecastDecision({
      expectedReturn: 0.01,
      confidence: 70,
      hasForecastEdge: true,
      dataQualityScore: 100,
      multiTimeframe
    });

    expect(decision.status).toBe("trade");
    expect(buildForecastDecision({
      expectedReturn: 0.001,
      confidence: 70,
      hasForecastEdge: true,
      dataQualityScore: 100,
      multiTimeframe
    }).status).toBe("noEdge");

    expect(buildForecastDecision({
      expectedReturn: 0.01,
      confidence: 70,
      hasForecastEdge: true,
      dataQualityScore: 100,
      multiTimeframe,
      directionModel: { direction: "Bullish", probabilityUp: 0.72, probabilityDown: 0.16, probabilityNeutral: 0.12, directionalAccuracy: 60, evaluatedDays: 60 },
      returnDirection: "Bullish",
      directionCalibration: { settledCount: 20, averageProbability: 0.72, realizedAccuracy: 0.4, calibrationGap: 0.32, status: "caution" }
    }).status).toBe("noEdge");
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

  it("uses a time-ordered ablation test before excluding a feature", () => {
    const results = evaluateFeatureAblation(makeCandles(90));

    expect(results).toHaveLength(4);
    expect(results.map((result) => result.id)).toEqual(expect.arrayContaining(["technical", "trend", "meanReversion", "volume"]));
    expect(results.every((result) => result.evaluatedDays > 0 && Number.isFinite(result.meanAbsolutePercentError))).toBe(true);
    expect(getAutoExcludedFeatures(results.filter((result) => result.status !== "paused"))).toEqual([]);
  });
});
