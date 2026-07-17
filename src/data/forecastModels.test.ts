import { describe, expect, it } from "vitest";
import { buildDailyEnsemble } from "./forecastModels";
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
});
