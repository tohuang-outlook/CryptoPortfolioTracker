import { describe, expect, it } from "vitest";
import { buildPortfolioSnapshot } from "./portfolio";

describe("buildPortfolioSnapshot", () => {
  it("returns a zeroed snapshot when there are no transactions", () => {
    const snapshot = buildPortfolioSnapshot([], {
      BTC: 60000,
      ETH: 2500,
      SOL: 150,
      XRP: 0.5,
      ADA: 0.4,
      DOGE: 0.1
    });

    expect(snapshot).toEqual({
      assets: [],
      portfolio: {
        totalInvested: 0,
        portfolioValue: 0,
        totalUnrealizedPnL: 0,
        totalReturnPercent: 0
      }
    });
  });

  it("aggregates invested amount, quantity, value, pnl, and allocation", () => {
    const snapshot = buildPortfolioSnapshot(
      [
        {
          id: "btc-1",
          assetSymbol: "BTC",
          assetName: "Bitcoin",
          type: "buy",
          amountInvested: 10000,
          purchasePrice: 50000,
          quantity: 0.2,
          purchaseDate: "2026-06-01",
          notes: "",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z"
        },
        {
          id: "eth-1",
          assetSymbol: "ETH",
          assetName: "Ethereum",
          type: "buy",
          amountInvested: 4000,
          purchasePrice: 2000,
          quantity: 2,
          purchaseDate: "2026-06-02",
          notes: "",
          createdAt: "2026-06-02T00:00:00.000Z",
          updatedAt: "2026-06-02T00:00:00.000Z"
        }
      ],
      { BTC: 60000, ETH: 1500, SOL: 0, XRP: 0, ADA: 0, DOGE: 0 }
    );

    expect(snapshot.portfolio).toEqual({
      totalInvested: 14000,
      portfolioValue: 15000,
      totalUnrealizedPnL: 1000,
      totalReturnPercent: 1000 / 14000
    });

    expect(snapshot.assets).toEqual([
      {
        assetSymbol: "BTC",
        assetName: "Bitcoin",
        totalInvested: 10000,
        totalQuantity: 0.2,
        averageBuyPrice: 50000,
        currentPrice: 60000,
        currentValue: 12000,
        unrealizedPnL: 2000,
        unrealizedPnLPercent: 0.2,
        allocationPercent: 0.8
      },
      {
        assetSymbol: "ETH",
        assetName: "Ethereum",
        totalInvested: 4000,
        totalQuantity: 2,
        averageBuyPrice: 2000,
        currentPrice: 1500,
        currentValue: 3000,
        unrealizedPnL: -1000,
        unrealizedPnLPercent: -0.25,
        allocationPercent: 0.2
      }
    ]);
  });

  it("falls back to zero when price data is missing at runtime", () => {
    const snapshot = buildPortfolioSnapshot(
      [
        {
          id: "btc-1",
          assetSymbol: "BTC",
          assetName: "Bitcoin",
          type: "buy",
          amountInvested: 10000,
          purchasePrice: 50000,
          quantity: 0.2,
          purchaseDate: "2026-06-01",
          notes: "",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z"
        }
      ],
      {} as never
    );

    expect(snapshot.assets).toEqual([
      {
        assetSymbol: "BTC",
        assetName: "Bitcoin",
        totalInvested: 10000,
        totalQuantity: 0.2,
        averageBuyPrice: 50000,
        currentPrice: 0,
        currentValue: 0,
        unrealizedPnL: -10000,
        unrealizedPnLPercent: -1,
        allocationPercent: 0
      }
    ]);
    expect(snapshot.portfolio).toEqual({
      totalInvested: 10000,
      portfolioValue: 0,
      totalUnrealizedPnL: -10000,
      totalReturnPercent: -1
    });
  });

  it("guards zero divisors when an asset has no invested value and no quantity", () => {
    const snapshot = buildPortfolioSnapshot(
      [
        {
          id: "btc-1",
          assetSymbol: "BTC",
          assetName: "Bitcoin",
          type: "buy",
          amountInvested: 0,
          purchasePrice: 0,
          quantity: 0,
          purchaseDate: "2026-06-01",
          notes: "",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z"
        }
      ],
      { BTC: 60000, ETH: 0, SOL: 0, XRP: 0, ADA: 0, DOGE: 0 }
    );

    expect(snapshot.assets).toEqual([
      {
        assetSymbol: "BTC",
        assetName: "Bitcoin",
        totalInvested: 0,
        totalQuantity: 0,
        averageBuyPrice: 0,
        currentPrice: 60000,
        currentValue: 0,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        allocationPercent: 0
      }
    ]);
    expect(snapshot.portfolio).toEqual({
      totalInvested: 0,
      portfolioValue: 0,
      totalUnrealizedPnL: 0,
      totalReturnPercent: 0
    });
  });
});
