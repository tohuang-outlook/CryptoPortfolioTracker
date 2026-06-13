import { SUPPORTED_ASSETS } from "../constants/assets";
import type { TransactionFormInput } from "../types/portfolio";

export function validateTransactionInput(input: TransactionFormInput) {
  const amountInvested = Number(input.amountInvested);
  const purchasePrice = Number(input.purchasePrice);
  const supported = SUPPORTED_ASSETS.some((asset) => asset.symbol === input.assetSymbol);

  if (!supported) {
    return { success: false as const, error: "Please choose a supported asset." };
  }

  if (!Number.isFinite(amountInvested) || amountInvested <= 0) {
    return { success: false as const, error: "Amount invested must be greater than zero." };
  }

  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
    return { success: false as const, error: "Purchase price must be greater than zero." };
  }

  if (!input.purchaseDate) {
    return { success: false as const, error: "Please choose a purchase date." };
  }

  return {
    success: true as const,
    data: {
      assetSymbol: input.assetSymbol,
      amountInvested,
      purchasePrice,
      purchaseDate: input.purchaseDate,
      notes: input.notes.trim(),
      quantity: amountInvested / purchasePrice
    }
  };
}
