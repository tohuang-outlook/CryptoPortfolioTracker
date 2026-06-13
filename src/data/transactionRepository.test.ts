import { beforeEach, describe, expect, it } from "vitest";
import { createTransactionRepository } from "./transactionRepository";

describe("transactionRepository", () => {
  beforeEach(() => {
    const storage = createStorageMock();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      configurable: true
    });
  });

  it("persists and reads transactions", () => {
    const repo = createTransactionRepository();
    expect(repo.saveAll([validTransaction()])).toEqual({ success: true });

    expect(repo.loadAll()).toHaveLength(1);
  });

  it("falls back to an empty array for malformed storage", () => {
    window.localStorage.setItem("crypto-portfolio-transactions", "not-json");
    const repo = createTransactionRepository();
    expect(repo.loadAll()).toEqual([]);
  });

  it("returns an empty array when localStorage access throws during load", () => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("SecurityError");
      },
      configurable: true
    });

    const repo = createTransactionRepository();
    expect(repo.loadAll()).toEqual([]);
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

    expect(repo.saveAll([validTransaction()])).toEqual({
      success: false,
      error: "Unable to save transaction. Please try again."
    });
  });

  it("filters out structurally invalid persisted rows", () => {
    window.localStorage.setItem(
      "crypto-portfolio-transactions",
      JSON.stringify([
        {
          id: "btc-1",
          assetSymbol: "BTC",
          assetName: "Bitcoin",
          type: "buy",
          amountInvested: 1000,
          purchasePrice: 50000,
          quantity: 0.02,
          purchaseDate: "2026-06-01",
          notes: "",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z"
        },
        {
          id: 123,
          assetSymbol: "BTC"
        }
      ])
    );

    const repo = createTransactionRepository();

    expect(repo.loadAll()).toEqual([
      {
        id: "btc-1",
        assetSymbol: "BTC",
        assetName: "Bitcoin",
        type: "buy",
        amountInvested: 1000,
        purchasePrice: 50000,
        quantity: 0.02,
        purchaseDate: "2026-06-01",
        notes: "",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z"
      }
    ]);
  });

  it("filters out persisted rows with invalid transaction values", () => {
    window.localStorage.setItem(
      "crypto-portfolio-transactions",
      JSON.stringify([
        {
          id: "btc-1",
          assetSymbol: "BTC",
          assetName: "Bitcoin",
          type: "buy",
          amountInvested: 1000,
          purchasePrice: 50000,
          quantity: 0.02,
          purchaseDate: "2026-06-01",
          notes: "",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z"
        },
        {
          id: "bad-1",
          assetSymbol: "ETH",
          assetName: "Ethereum",
          type: "buy",
          amountInvested: 0,
          purchasePrice: -1,
          quantity: 0,
          purchaseDate: "",
          notes: "",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z"
        }
      ])
    );

    const repo = createTransactionRepository();

    expect(repo.loadAll()).toEqual([
      {
        id: "btc-1",
        assetSymbol: "BTC",
        assetName: "Bitcoin",
        type: "buy",
        amountInvested: 1000,
        purchasePrice: 50000,
        quantity: 0.02,
        purchaseDate: "2026-06-01",
        notes: "",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z"
      }
    ]);
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
