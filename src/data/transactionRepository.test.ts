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
    repo.saveAll([
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

    expect(repo.loadAll()).toHaveLength(1);
  });

  it("falls back to an empty array for malformed storage", () => {
    window.localStorage.setItem("crypto-portfolio-transactions", "not-json");
    const repo = createTransactionRepository();
    expect(repo.loadAll()).toEqual([]);
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
