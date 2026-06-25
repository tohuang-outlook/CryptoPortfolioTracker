import { beforeEach, describe, expect, it } from "vitest";
import { createTransactionRepository } from "./transactionRepository";

const defaultProfileId = "profile-1";

describe("transactionRepository", () => {
  beforeEach(() => {
    const storage = createStorageMock();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      configurable: true
    });
  });

  it("persists and reads transactions by profile id", () => {
    const repo = createTransactionRepository();
    expect(
      repo.saveTransactionsByProfileId({
        [defaultProfileId]: [validTransaction()]
      })
    ).toEqual({ success: true });

    expect(repo.loadTransactionsByProfileId()).toEqual({
      [defaultProfileId]: [validTransaction()]
    });
  });

  it("falls back to an empty map for malformed profile storage", () => {
    window.localStorage.setItem(
      "crypto-portfolio-transactions-by-profile",
      "not-json"
    );
    const repo = createTransactionRepository();
    expect(repo.loadTransactionsByProfileId()).toEqual({});
  });

  it("returns an empty map when localStorage access throws during load", () => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("SecurityError");
      },
      configurable: true
    });

    const repo = createTransactionRepository();
    expect(repo.loadTransactionsByProfileId()).toEqual({});
  });

  it("returns a failure result when localStorage throws during save", () => {
    const storage = createStorageMock();
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };

    Object.defineProperty(window, "localStorage", {
      value: storage,
      configurable: true
    });

    const repo = createTransactionRepository();

    expect(
      repo.saveTransactionsByProfileId({
        [defaultProfileId]: [validTransaction()]
      })
    ).toEqual({
      success: false,
      error: "Unable to save transaction. Please try again."
    });
  });

  it("filters out structurally invalid persisted rows inside transaction maps", () => {
    window.localStorage.setItem(
      "crypto-portfolio-transactions-by-profile",
      JSON.stringify({
        [defaultProfileId]: [
          validTransaction(),
          {
            id: 123,
            assetSymbol: "BTC"
          }
        ]
      })
    );

    const repo = createTransactionRepository();

    expect(repo.loadTransactionsByProfileId()).toEqual({
      [defaultProfileId]: [validTransaction()]
    });
  });

  it("filters out malformed transaction-map entries entirely", () => {
    window.localStorage.setItem(
      "crypto-portfolio-transactions-by-profile",
      JSON.stringify({
        [defaultProfileId]: [validTransaction()],
        broken: "not-an-array"
      })
    );

    const repo = createTransactionRepository();

    expect(repo.loadTransactionsByProfileId()).toEqual({
      [defaultProfileId]: [validTransaction()]
    });
  });

  it("loads legacy transactions from the old storage key", () => {
    window.localStorage.setItem(
      "crypto-portfolio-transactions",
      JSON.stringify([validTransaction()])
    );

    const repo = createTransactionRepository();

    expect(repo.loadLegacyTransactions()).toEqual([validTransaction()]);
  });

  it("migrates legacy transactions into a default profile map", () => {
    const repo = createTransactionRepository();

    expect(
      repo.migrateLegacyTransactionsToProfileMap({
        legacyTransactions: [validTransaction()],
        defaultProfileId
      })
    ).toEqual({
      [defaultProfileId]: [validTransaction()]
    });
  });

  it("returns an empty map when there are no legacy transactions to migrate", () => {
    const repo = createTransactionRepository();

    expect(
      repo.migrateLegacyTransactionsToProfileMap({
        legacyTransactions: [],
        defaultProfileId
      })
    ).toEqual({});
  });
});

function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.get(key) ?? null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, value);
    }
  };
}

function validTransaction() {
  return {
    id: "btc-1",
    assetSymbol: "BTC" as const,
    assetName: "Bitcoin",
    type: "buy" as const,
    amountInvested: 1000,
    purchasePrice: 50000,
    quantity: 0.02,
    purchaseDate: "2026-06-01",
    notes: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  };
}
