import { describe, expect, it } from "vitest";
import { appendMicrostructureSnapshot, calculateMicrostructureAdjustment } from "./microstructureService";
import type { MicrostructureSnapshot } from "../types/forecast";

function snapshot(overrides: Partial<MicrostructureSnapshot> = {}): MicrostructureSnapshot {
  return {
    assetSymbol: "BTC",
    capturedAt: new Date().toISOString(),
    bidDepthUsd: 1_000_000,
    askDepthUsd: 1_000_000,
    orderBookImbalance: 0,
    tradeFlowImbalance: 0,
    spreadPercent: 0.0001,
    tradeCount: 100,
    ...overrides
  };
}

describe("microstructure snapshots", () => {
  it("keeps one latest snapshot per asset per hour and removes expired history", () => {
    const current = snapshot();
    const replacement = snapshot({ orderBookImbalance: 0.2 });
    const expired = snapshot({ capturedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString() });

    const result = appendMicrostructureSnapshot(appendMicrostructureSnapshot([expired], current), replacement);

    expect(result).toHaveLength(1);
    expect(result[0].orderBookImbalance).toBe(0.2);
  });

  it("does not apply order-book pressure until enough hourly context exists", () => {
    const latest = snapshot({ orderBookImbalance: 0.3, tradeFlowImbalance: 0.2 });
    const history = Array.from({ length: 12 }, (_, index) => snapshot({
      capturedAt: new Date(Date.now() - (12 - index) * 60 * 60 * 1000).toISOString()
    }));

    expect(calculateMicrostructureAdjustment(latest, history.slice(0, 11))).toBe(0);
    expect(calculateMicrostructureAdjustment(latest, history)).toBeGreaterThan(0);
  });
});
