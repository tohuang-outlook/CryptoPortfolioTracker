import { SUPPORTED_ASSETS } from "../constants/assets";
import type { TransactionFormInput } from "../types/portfolio";

export function validateTransactionInput(input: TransactionFormInput) {
  const amountInvested = Number(input.amountInvested);
  const purchasePrice = Number(input.purchasePrice);
  const purchaseShares = Number(input.purchaseShares);
  const hasValidPrice =
    Number.isFinite(purchasePrice) && purchasePrice > 0;
  const hasValidShares =
    Number.isFinite(purchaseShares) && purchaseShares > 0;
  const supported = SUPPORTED_ASSETS.some((asset) => asset.symbol === input.assetSymbol);

  if (!supported) {
    return { success: false as const, error: "Please choose a supported asset." };
  }

  if (!Number.isFinite(amountInvested) || amountInvested <= 0) {
    return { success: false as const, error: "Amount invested must be greater than zero." };
  }

  if (!hasValidPrice && !hasValidShares) {
    return {
      success: false as const,
      error: "Enter either a valid purchase price or purchase shares."
    };
  }

  if (!input.purchaseDate) {
    return { success: false as const, error: "Please choose a purchase date." };
  }

  const normalizedPurchasePrice = hasValidPrice
    ? purchasePrice
    : amountInvested / purchaseShares;
  const normalizedQuantity = hasValidShares
    ? purchaseShares
    : amountInvested / purchasePrice;

  return {
    success: true as const,
    data: {
      assetSymbol: input.assetSymbol,
      amountInvested,
      purchasePrice: normalizedPurchasePrice,
      purchaseDate: input.purchaseDate,
      notes: input.notes.trim(),
      quantity: normalizedQuantity
    }
  };
}
