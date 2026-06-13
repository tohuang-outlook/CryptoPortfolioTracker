import type { Transaction } from "../types/portfolio";

const STORAGE_KEY = "crypto-portfolio-transactions";

export function createTransactionRepository() {
  return {
    loadAll(): Transaction[] {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }

      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    saveAll(transactions: Transaction[]) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    }
  };
}
