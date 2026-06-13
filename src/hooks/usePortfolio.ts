import { useMemo, useState } from "react";
import { SUPPORTED_ASSETS } from "../constants/assets";
import { createTransactionRepository } from "../data/transactionRepository";
import { buildPortfolioSnapshot } from "../domain/portfolio";
import { validateTransactionInput } from "../domain/validation";
import type { PriceMap, Transaction } from "../types/portfolio";

const repository = createTransactionRepository();

interface AddTransactionInput {
  assetSymbol: string;
  amountInvested: string;
  purchasePrice: string;
  purchaseDate: string;
  notes: string;
}

type AddTransactionResult =
  | { success: true }
  | { success: false; error: string };

export function usePortfolio(prices: PriceMap) {
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    repository.loadAll()
  );

  const snapshot = useMemo(
    () => buildPortfolioSnapshot(transactions, prices),
    [transactions, prices]
  );

  function addTransaction(input: AddTransactionInput): AddTransactionResult {
    const result = validateTransactionInput(input);

    if (!result.success) {
      return result;
    }

    const asset = SUPPORTED_ASSETS.find(
      (supportedAsset) => supportedAsset.symbol === result.data.assetSymbol
    );

    if (!asset) {
      return {
        success: false,
        error: "Please choose a supported asset."
      };
    }

    const timestamp = new Date().toISOString();
    const nextTransaction: Transaction = {
      id: createTransactionId(),
      assetSymbol: asset.symbol,
      assetName: asset.name,
      type: "buy",
      amountInvested: result.data.amountInvested,
      purchasePrice: result.data.purchasePrice,
      quantity: result.data.quantity,
      purchaseDate: result.data.purchaseDate,
      notes: result.data.notes,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const updatedTransactions = [nextTransaction, ...transactions];
    const saveResult = repository.saveAll(updatedTransactions);

    if (!saveResult.success) {
      return saveResult;
    }

    setTransactions(updatedTransactions);

    return { success: true };
  }

  return { transactions, snapshot, addTransaction };
}

function createTransactionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `transaction-${Date.now()}`;
}
