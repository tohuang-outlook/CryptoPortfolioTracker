import { describe, expect, it } from "vitest";
import { validateTransactionInput } from "./validation";

describe("validateTransactionInput", () => {
  it("returns derived quantity when amount and purchase price are valid", () => {
    const result = validateTransactionInput({
      assetSymbol: "BTC",
      amountInvested: "1000",
      purchasePrice: "50000",
      purchaseShares: "",
      purchaseDate: "2026-06-01",
      notes: ""
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(0.02);
    }
  });

  it("rejects zero and negative numeric values", () => {
    const result = validateTransactionInput({
      assetSymbol: "ETH",
      amountInvested: "0",
      purchasePrice: "-10",
      purchaseShares: "",
      purchaseDate: "2026-06-01",
      notes: ""
    });

    expect(result.success).toBe(false);
  });

  it("returns normalized price when amount and purchase shares are valid", () => {
    const result = validateTransactionInput({
      assetSymbol: "BTC",
      amountInvested: "1000",
      purchasePrice: "",
      purchaseShares: "0.02",
      purchaseDate: "2026-06-01",
      notes: ""
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.purchasePrice).toBe(50000);
      expect(result.data.quantity).toBe(0.02);
    }
  });

  it("preserves a sell transaction type", () => {
    const result = validateTransactionInput({
      transactionType: "sell",
      assetSymbol: "ETH",
      amountInvested: "3000",
      purchasePrice: "3000",
      purchaseShares: "1",
      purchaseDate: "2026-06-03",
      notes: "Partial sale"
    });

    expect(result).toMatchObject({
      success: true,
      data: { transactionType: "sell", quantity: 1 }
    });
  });

  it("rejects input when both purchase price and purchase shares are invalid", () => {
    const result = validateTransactionInput({
      assetSymbol: "ETH",
      amountInvested: "1000",
      purchasePrice: "",
      purchaseShares: "",
      purchaseDate: "2026-06-01",
      notes: ""
    });

    expect(result.success).toBe(false);
  });
});
