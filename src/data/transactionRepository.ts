import type {
  Transaction,
  TransactionsByProfileId
} from "../types/portfolio";
import { SUPPORTED_ASSETS } from "../constants/assets";

const LEGACY_STORAGE_KEY = "crypto-portfolio-transactions";
const PROFILE_STORAGE_KEY = "crypto-portfolio-transactions-by-profile";

export function createTransactionRepository() {
  return {
    hasTransactionsByProfileIdStorage() {
      return readStorageItem(PROFILE_STORAGE_KEY) !== null;
    },
    loadTransactionsByProfileId(): TransactionsByProfileId {
      const raw = readStorageItem(PROFILE_STORAGE_KEY);
      if (raw === null) {
        return {};
      }

      try {
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed)) {
          return {};
        }

        return Object.fromEntries(
          Object.entries(parsed)
            .filter((entry): entry is [string, unknown[]] => {
              const [profileId, transactions] = entry;
              return typeof profileId === "string" && Array.isArray(transactions);
            })
            .map(([profileId, transactions]) => [
              profileId,
              transactions.filter(isTransaction)
            ])
        );
      } catch {
        return {};
      }
    },
    saveTransactionsByProfileId(
      transactionsByProfileId: TransactionsByProfileId
    ) {
      try {
        window.localStorage.setItem(
          PROFILE_STORAGE_KEY,
          JSON.stringify(transactionsByProfileId)
        );
        return { success: true as const };
      } catch {
        return {
          success: false as const,
          error: "Unable to save transaction. Please try again."
        };
      }
    },
    loadLegacyTransactions(): Transaction[] {
      const raw = readStorageItem(LEGACY_STORAGE_KEY);
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
    migrateLegacyTransactionsToProfileMap({
      legacyTransactions,
      defaultProfileId
    }: {
      legacyTransactions: Transaction[];
      defaultProfileId: string;
    }): TransactionsByProfileId {
      if (legacyTransactions.length === 0) {
        return {};
      }

      return {
        [defaultProfileId]: legacyTransactions
      };
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
