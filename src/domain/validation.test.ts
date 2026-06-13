import { describe, expect, it } from "vitest";
import { validateTransactionInput } from "./validation";

describe("validateTransactionInput", () => {
  it("returns derived quantity when amount and purchase price are valid", () => {
    const result = validateTransactionInput({
      assetSymbol: "BTC",
      amountInvested: "1000",
      purchasePrice: "50000",
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
      purchaseDate: "2026-06-01",
      notes: ""
    });

    expect(result.success).toBe(false);
  });
});
