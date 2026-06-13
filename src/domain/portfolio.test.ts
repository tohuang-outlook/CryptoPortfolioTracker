import { describe, expect, it } from "vitest";
import { buildPortfolioSnapshot } from "./portfolio";

describe("buildPortfolioSnapshot", () => {
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
});
