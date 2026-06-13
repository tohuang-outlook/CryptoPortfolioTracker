import type { Transaction } from "../types/portfolio";
import { SUPPORTED_ASSETS } from "../constants/assets";

const STORAGE_KEY = "crypto-portfolio-transactions";

export function createTransactionRepository() {
  return {
    loadAll(): Transaction[] {
      const raw = readStorageItem(STORAGE_KEY);
      if (raw === null) {
        return [];
      }

      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          return [];
        }

        return parsed.filter(isTransaction);
      } catch {
        return [];
      }
    },
    saveAll(transactions: Transaction[]) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      } catch {
        // Swallow storage failures so persistence does not crash the app.
      }
    }
  };
}

function readStorageItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function isTransaction(value: unknown): value is Transaction {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    isSupportedAssetSymbol(value.assetSymbol) &&
    typeof value.assetName === "string" &&
    value.type === "buy" &&
    isPositiveNumber(value.amountInvested) &&
    isPositiveNumber(value.purchasePrice) &&
    isPositiveNumber(value.quantity) &&
    isValidPurchaseDate(value.purchaseDate) &&
    typeof value.notes === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isSupportedAssetSymbol(value: unknown): value is Transaction["assetSymbol"] {
  return SUPPORTED_ASSETS.some((asset) => asset.symbol === value);
}

function isValidPurchaseDate(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}
