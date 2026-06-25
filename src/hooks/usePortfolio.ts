import { useEffect, useMemo, useRef, useState } from "react";
import { SUPPORTED_ASSETS } from "../constants/assets";
import { buildPortfolioSnapshot } from "../domain/portfolio";
import { validateTransactionInput } from "../domain/validation";
import type {
  PriceMap,
  Transaction,
  TransactionFormInput
} from "../types/portfolio";

interface MutateTransactionInput extends TransactionFormInput {
  id: string;
}

type TransactionMutationResult =
  | { success: true }
  | { success: false; error: string };

export function usePortfolio(
  prices: PriceMap,
  transactions: Transaction[],
  saveTransactions: (updatedTransactions: Transaction[]) => TransactionMutationResult
) {
  const transactionsRef = useRef(transactions);
  const [, forceRender] = useState(0);

  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  const snapshot = useMemo(
    () => buildPortfolioSnapshot(transactions, prices),
    [transactions, prices]
  );

  function addTransaction(
    input: TransactionFormInput
  ): TransactionMutationResult {
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

    const updatedTransactions = [nextTransaction, ...transactionsRef.current];
    const saveResult = saveTransactions(updatedTransactions);
    if (!saveResult.success) {
      return saveResult;
    }

    transactionsRef.current = updatedTransactions;
    forceRender((count) => count + 1);
    return { success: true };
  }

  function updateTransaction(
    input: MutateTransactionInput
  ): TransactionMutationResult {
    const result = validateTransactionInput(input);

    if (!result.success) {
      return result;
    }

    const existingTransaction = transactionsRef.current.find(
      (transaction) => transaction.id === input.id
    );

    if (!existingTransaction) {
      return {
        success: false,
        error: "Unable to find that transaction."
      };
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

    const updatedTransactions = transactionsRef.current.map((transaction) =>
      transaction.id === input.id
        ? {
            ...transaction,
            assetSymbol: asset.symbol,
            assetName: asset.name,
            amountInvested: result.data.amountInvested,
            purchasePrice: result.data.purchasePrice,
            quantity: result.data.quantity,
            purchaseDate: result.data.purchaseDate,
            notes: result.data.notes,
            updatedAt: new Date().toISOString()
          }
        : transaction
    );
    const saveResult = saveTransactions(updatedTransactions);
    if (!saveResult.success) {
      return saveResult;
    }

    transactionsRef.current = updatedTransactions;
    forceRender((count) => count + 1);
    return { success: true };
  }

  function deleteTransaction(id: string): TransactionMutationResult {
    const updatedTransactions = transactionsRef.current.filter(
      (transaction) => transaction.id !== id
    );

    if (updatedTransactions.length === transactionsRef.current.length) {
      return {
        success: false,
        error: "Unable to find that transaction."
      };
    }
    const saveResult = saveTransactions(updatedTransactions);
    if (!saveResult.success) {
      return saveResult;
    }

    transactionsRef.current = updatedTransactions;
    forceRender((count) => count + 1);
    return { success: true };
  }

  return {
    transactions,
    snapshot,
    addTransaction,
    updateTransaction,
    deleteTransaction
  };
}

function createTransactionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `transaction-${Date.now()}`;
}
