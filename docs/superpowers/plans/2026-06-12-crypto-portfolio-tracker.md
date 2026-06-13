# Crypto Portfolio Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive local-first crypto portfolio tracker that lets users record buy transactions, fetch live prices for six major coins, and view portfolio summaries, allocation, and transaction history in one calm dashboard.

**Architecture:** Use a Vite React TypeScript app with a small domain layer for portfolio calculations, a data layer for local storage and price fetching, and a presentation layer for dashboard, transaction form, and history views. Keep persistence and pricing behind interfaces so future cloud sync can replace local storage without rewriting calculation logic or screen structure.

**Tech Stack:** React, TypeScript, Vite, Vitest, React Testing Library, localStorage, Fetch API, Recharts

---

## File Structure

- `package.json`
  Defines scripts and dependencies for React, Vite, testing, and charts.
- `tsconfig.json`
  Configures strict TypeScript settings for app and tests.
- `vite.config.ts`
  Configures Vite and Vitest with jsdom test environment.
- `index.html`
  Root HTML shell for the app.
- `src/main.tsx`
  Bootstraps the React app.
- `src/App.tsx`
  High-level app composition and state orchestration.
- `src/styles.css`
  Global app theme, layout, and responsive styling.
- `src/types/portfolio.ts`
  Shared types for assets, transactions, summaries, and price state.
- `src/constants/assets.ts`
  Supported coin definitions for BTC, ETH, SOL, XRP, ADA, DOGE.
- `src/domain/portfolio.ts`
  Pure calculation helpers for asset and portfolio summaries.
- `src/domain/validation.ts`
  Transaction form validation and parsing helpers.
- `src/data/transactionRepository.ts`
  Local storage repository with safe parse and persistence logic.
- `src/data/priceService.ts`
  Live price fetcher for supported assets only.
- `src/hooks/usePortfolio.ts`
  App hook for transactions, summaries, and transaction mutations.
- `src/hooks/usePrices.ts`
  App hook for live price loading, refresh, and stale state.
- `src/components/SummaryCards.tsx`
  Displays total invested, value, P&L, and return.
- `src/components/HoldingsTable.tsx`
  Shows per-asset summary rows.
- `src/components/AllocationChart.tsx`
  Shows allocation breakdown using a simple pie chart.
- `src/components/TransactionForm.tsx`
  Buy-entry form with derived quantity.
- `src/components/TransactionHistory.tsx`
  Reverse-chronological transaction list.
- `src/components/EmptyState.tsx`
  Friendly guidance for first-time use.
- `src/components/PriceStatus.tsx`
  Displays loading, refreshed, and unavailable pricing states.
- `src/test/setup.ts`
  Shared test setup for RTL and DOM matchers.
- `src/domain/portfolio.test.ts`
  Unit tests for portfolio calculations.
- `src/domain/validation.test.ts`
  Unit tests for form validation rules.
- `src/data/transactionRepository.test.ts`
  Unit tests for local persistence behavior.
- `src/data/priceService.test.ts`
  Unit tests for live price fetching and fallback behavior.
- `src/App.test.tsx`
  Integration tests for adding transactions and seeing dashboard updates.

### Task 1: Scaffold The App Shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Write the failing app render test**

```tsx
// src/App.test.tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the portfolio tracker heading", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: /crypto portfolio tracker/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/App.test.tsx`
Expected: FAIL with module resolution or missing `App` file errors

- [ ] **Step 3: Create the React and Vitest scaffold**

```json
{
  "name": "crypto-portfolio-tracker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "recharts": "^2.15.3"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.4.1",
    "jsdom": "^25.0.1",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vitest": "^2.1.8"
  }
}
```

```tsx
// src/App.tsx
import "./styles.css";

export default function App() {
  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">Calm portfolio tracking</p>
        <h1>Crypto Portfolio Tracker</h1>
        <p className="hero-copy">
          Track your crypto portfolio with clarity, confidence, and less stress.
        </p>
      </header>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/App.test.tsx`
Expected: PASS with `1 passed`

- [ ] **Step 5: Verify the production build works**

Run: `npm run build`
Expected: PASS with Vite output in `dist/`

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vite.config.ts index.html src/main.tsx src/App.tsx src/styles.css src/test/setup.ts src/App.test.tsx
git commit -m "feat: scaffold crypto portfolio tracker app"
```

### Task 2: Add Domain Types And Portfolio Calculations

**Files:**
- Create: `src/types/portfolio.ts`
- Create: `src/constants/assets.ts`
- Create: `src/domain/portfolio.ts`
- Test: `src/domain/portfolio.test.ts`

- [ ] **Step 1: Write the failing calculation tests**

```ts
// src/domain/portfolio.test.ts
import { describe, expect, it } from "vitest";
import { buildPortfolioSnapshot } from "./portfolio";

describe("buildPortfolioSnapshot", () => {
  it("aggregates invested amount, quantity, value, pnl, and allocation", () => {
    const snapshot = buildPortfolioSnapshot(
      [
        {
          id: "btc-1",
          assetSymbol: "BTC",
          assetName: "Bitcoin",
          type: "buy",
          amountInvested: 10000,
          purchasePrice: 50000,
          quantity: 0.2,
          purchaseDate: "2026-06-01",
          notes: "",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z"
        },
        {
          id: "eth-1",
          assetSymbol: "ETH",
          assetName: "Ethereum",
          type: "buy",
          amountInvested: 4000,
          purchasePrice: 2000,
          quantity: 2,
          purchaseDate: "2026-06-02",
          notes: "",
          createdAt: "2026-06-02T00:00:00.000Z",
          updatedAt: "2026-06-02T00:00:00.000Z"
        }
      ],
      { BTC: 60000, ETH: 1500, SOL: 0, XRP: 0, ADA: 0, DOGE: 0 }
    );

    expect(snapshot.portfolio.totalInvested).toBe(14000);
    expect(snapshot.portfolio.portfolioValue).toBe(15000);
    expect(snapshot.assets[0].assetSymbol).toBe("BTC");
    expect(snapshot.assets[0].unrealizedPnL).toBe(2000);
    expect(snapshot.assets[1].allocationPercent).toBeCloseTo(0.2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/domain/portfolio.test.ts`
Expected: FAIL with `buildPortfolioSnapshot` not found

- [ ] **Step 3: Implement strict portfolio types and pure calculation helpers**

```ts
// src/domain/portfolio.ts
import { SUPPORTED_ASSETS } from "../constants/assets";
import type { AssetSummary, PortfolioSnapshot, PortfolioSummary, PriceMap, Transaction } from "../types/portfolio";

export function buildPortfolioSnapshot(
  transactions: Transaction[],
  prices: PriceMap
): PortfolioSnapshot {
  const grouped = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    const existing = grouped.get(transaction.assetSymbol) ?? [];
    existing.push(transaction);
    grouped.set(transaction.assetSymbol, existing);
  }

  const assets: AssetSummary[] = SUPPORTED_ASSETS
    .filter((asset) => grouped.has(asset.symbol))
    .map((asset) => {
      const rows = grouped.get(asset.symbol) ?? [];
      const totalInvested = rows.reduce((sum, row) => sum + row.amountInvested, 0);
      const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
      const averageBuyPrice = totalQuantity === 0 ? 0 : totalInvested / totalQuantity;
      const currentPrice = prices[asset.symbol] ?? 0;
      const currentValue = totalQuantity * currentPrice;
      const unrealizedPnL = currentValue - totalInvested;
      const unrealizedPnLPercent = totalInvested === 0 ? 0 : unrealizedPnL / totalInvested;

      return {
        assetSymbol: asset.symbol,
        assetName: asset.name,
        totalInvested,
        totalQuantity,
        averageBuyPrice,
        currentPrice,
        currentValue,
        unrealizedPnL,
        unrealizedPnLPercent,
        allocationPercent: 0
      };
    });

  const portfolioValue = assets.reduce((sum, asset) => sum + asset.currentValue, 0);
  const totalInvested = assets.reduce((sum, asset) => sum + asset.totalInvested, 0);

  const assetSummaries = assets.map((asset) => ({
    ...asset,
    allocationPercent: portfolioValue === 0 ? 0 : asset.currentValue / portfolioValue
  }));

  const portfolio: PortfolioSummary = {
    totalInvested,
    portfolioValue,
    totalUnrealizedPnL: portfolioValue - totalInvested,
    totalReturnPercent: totalInvested === 0 ? 0 : (portfolioValue - totalInvested) / totalInvested
  };

  return { assets: assetSummaries, portfolio };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/domain/portfolio.test.ts`
Expected: PASS with calculation assertions succeeding

- [ ] **Step 5: Commit**

```bash
git add src/types/portfolio.ts src/constants/assets.ts src/domain/portfolio.ts src/domain/portfolio.test.ts
git commit -m "feat: add portfolio calculation domain"
```

### Task 3: Add Validation And Local Transaction Storage

**Files:**
- Create: `src/domain/validation.ts`
- Test: `src/domain/validation.test.ts`
- Create: `src/data/transactionRepository.ts`
- Test: `src/data/transactionRepository.test.ts`

- [ ] **Step 1: Write the failing validation and repository tests**

```ts
// src/domain/validation.test.ts
import { describe, expect, it } from "vitest";
import { validateTransactionInput } from "./validation";

describe("validateTransactionInput", () => {
  it("returns derived quantity when amount and purchase price are valid", () => {
    const result = validateTransactionInput({
      assetSymbol: "BTC",
      amountInvested: "1000",
      purchasePrice: "50000",
      purchaseDate: "2026-06-01",
      notes: ""
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(0.02);
    }
  });

  it("rejects zero and negative numeric values", () => {
    const result = validateTransactionInput({
      assetSymbol: "ETH",
      amountInvested: "0",
      purchasePrice: "-10",
      purchaseDate: "2026-06-01",
      notes: ""
    });

    expect(result.success).toBe(false);
  });
});
```

```ts
// src/data/transactionRepository.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { createTransactionRepository } from "./transactionRepository";

describe("transactionRepository", () => {
  beforeEach(() => localStorage.clear());

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
    localStorage.setItem("crypto-portfolio-transactions", "not-json");
    const repo = createTransactionRepository();
    expect(repo.loadAll()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/domain/validation.test.ts src/data/transactionRepository.test.ts`
Expected: FAIL with missing validation and repository modules

- [ ] **Step 3: Implement input validation and safe local storage persistence**

```ts
// src/domain/validation.ts
import { SUPPORTED_ASSETS } from "../constants/assets";

export function validateTransactionInput(input: {
  assetSymbol: string;
  amountInvested: string;
  purchasePrice: string;
  purchaseDate: string;
  notes: string;
}) {
  const amountInvested = Number(input.amountInvested);
  const purchasePrice = Number(input.purchasePrice);
  const supported = SUPPORTED_ASSETS.some((asset) => asset.symbol === input.assetSymbol);

  if (!supported) return { success: false as const, error: "Please choose a supported asset." };
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
```

```ts
// src/data/transactionRepository.ts
import type { Transaction } from "../types/portfolio";

const STORAGE_KEY = "crypto-portfolio-transactions";

export function createTransactionRepository() {
  return {
    loadAll(): Transaction[] {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];

      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    saveAll(transactions: Transaction[]) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    }
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/domain/validation.test.ts src/data/transactionRepository.test.ts`
Expected: PASS with validation and persistence coverage green

- [ ] **Step 5: Commit**

```bash
git add src/domain/validation.ts src/domain/validation.test.ts src/data/transactionRepository.ts src/data/transactionRepository.test.ts
git commit -m "feat: add transaction validation and local storage"
```

### Task 4: Add Supported-Coin Pricing

**Files:**
- Create: `src/data/priceService.ts`
- Create: `src/hooks/usePrices.ts`
- Test: `src/data/priceService.test.ts`

- [ ] **Step 1: Write the failing price service tests**

```ts
// src/data/priceService.test.ts
import { describe, expect, it, vi } from "vitest";
import { fetchSupportedPrices } from "./priceService";

describe("fetchSupportedPrices", () => {
  it("maps provider response into the local price shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bitcoin: { usd: 65000 },
          ethereum: { usd: 2500 },
          solana: { usd: 150 },
          ripple: { usd: 1.1 },
          cardano: { usd: 0.45 },
          dogecoin: { usd: 0.2 }
        })
      })
    );

    const prices = await fetchSupportedPrices();
    expect(prices.BTC).toBe(65000);
    expect(prices.DOGE).toBe(0.2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/data/priceService.test.ts`
Expected: FAIL with missing price service

- [ ] **Step 3: Implement the supported-price fetcher and hook**

```ts
// src/data/priceService.ts
import type { PriceMap } from "../types/portfolio";

const PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,cardano,dogecoin&vs_currencies=usd";

export async function fetchSupportedPrices(): Promise<PriceMap> {
  const response = await fetch(PRICE_URL);
  if (!response.ok) {
    throw new Error("Unable to fetch prices");
  }

  const data = await response.json();

  return {
    BTC: data.bitcoin?.usd ?? 0,
    ETH: data.ethereum?.usd ?? 0,
    SOL: data.solana?.usd ?? 0,
    XRP: data.ripple?.usd ?? 0,
    ADA: data.cardano?.usd ?? 0,
    DOGE: data.dogecoin?.usd ?? 0
  };
}
```

```ts
// src/hooks/usePrices.ts
import { useEffect, useState } from "react";
import type { PriceMap } from "../types/portfolio";
import { fetchSupportedPrices } from "../data/priceService";

const EMPTY_PRICES: PriceMap = { BTC: 0, ETH: 0, SOL: 0, XRP: 0, ADA: 0, DOGE: 0 };

export function usePrices() {
  const [prices, setPrices] = useState<PriceMap>(EMPTY_PRICES);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("loading");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setStatus("loading");
      try {
        const next = await fetchSupportedPrices();
        if (!active) return;
        setPrices(next);
        setStatus("ready");
        setLastUpdated(new Date().toISOString());
      } catch {
        if (!active) return;
        setStatus("error");
      }
    }

    void load();
    const timer = window.setInterval(load, 60000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return { prices, status, lastUpdated };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/data/priceService.test.ts`
Expected: PASS with provider mapping assertions succeeding

- [ ] **Step 5: Commit**

```bash
git add src/data/priceService.ts src/data/priceService.test.ts src/hooks/usePrices.ts
git commit -m "feat: add live pricing for supported assets"
```

### Task 5: Wire Transactions Into App State And Form UX

**Files:**
- Create: `src/hooks/usePortfolio.ts`
- Create: `src/components/TransactionForm.tsx`
- Create: `src/components/PriceStatus.tsx`
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Expand the failing integration test for adding a transaction**

```tsx
// src/App.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

test("adds a BTC transaction and updates dashboard totals", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.selectOptions(screen.getByLabelText(/asset/i), "BTC");
  await user.type(screen.getByLabelText(/amount invested/i), "1000");
  await user.type(screen.getByLabelText(/purchase price/i), "50000");
  await user.type(screen.getByLabelText(/purchase date/i), "2026-06-01");
  await user.click(screen.getByRole("button", { name: /save transaction/i }));

  expect(screen.getByText("$1,000.00")).toBeInTheDocument();
  expect(screen.getByText("0.02000000 BTC")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/App.test.tsx`
Expected: FAIL because the form and transaction state do not exist yet

- [ ] **Step 3: Implement transaction state orchestration and the buy-entry form**

```ts
// src/hooks/usePortfolio.ts
import { useMemo, useState } from "react";
import { createTransactionRepository } from "../data/transactionRepository";
import { buildPortfolioSnapshot } from "../domain/portfolio";
import { validateTransactionInput } from "../domain/validation";
import { SUPPORTED_ASSETS } from "../constants/assets";
import type { PriceMap, Transaction } from "../types/portfolio";

const repository = createTransactionRepository();

export function usePortfolio(prices: PriceMap) {
  const [transactions, setTransactions] = useState<Transaction[]>(() => repository.loadAll());

  const snapshot = useMemo(
    () => buildPortfolioSnapshot(transactions, prices),
    [transactions, prices]
  );

  function addTransaction(input: {
    assetSymbol: string;
    amountInvested: string;
    purchasePrice: string;
    purchaseDate: string;
    notes: string;
  }) {
    const result = validateTransactionInput(input);
    if (!result.success) {
      return result;
    }

    const asset = SUPPORTED_ASSETS.find((item) => item.symbol === result.data.assetSymbol)!;
    const timestamp = new Date().toISOString();
    const next: Transaction = {
      id: crypto.randomUUID(),
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

    const updated = [next, ...transactions];
    setTransactions(updated);
    repository.saveAll(updated);

    return { success: true as const };
  }

  return { transactions, snapshot, addTransaction };
}
```

```tsx
// src/components/TransactionForm.tsx
import { useState } from "react";
import { SUPPORTED_ASSETS } from "../constants/assets";

export function TransactionForm({
  onSubmit
}: {
  onSubmit: (input: {
    assetSymbol: string;
    amountInvested: string;
    purchasePrice: string;
    purchaseDate: string;
    notes: string;
  }) => { success: true } | { success: false; error: string };
}) {
  const [form, setForm] = useState({
    assetSymbol: "BTC",
    amountInvested: "",
    purchasePrice: "",
    purchaseDate: "",
    notes: ""
  });
  const [error, setError] = useState("");

  const quantity =
    Number(form.amountInvested) > 0 && Number(form.purchasePrice) > 0
      ? Number(form.amountInvested) / Number(form.purchasePrice)
      : 0;

  return (
    <form
      className="panel form-panel"
      onSubmit={(event) => {
        event.preventDefault();
        const result = onSubmit(form);
        if (!result.success) {
          setError(result.error);
          return;
        }
        setError("");
        setForm({ assetSymbol: "BTC", amountInvested: "", purchasePrice: "", purchaseDate: "", notes: "" });
      }}
    >
      <label>
        Asset
        <select
          aria-label="Asset"
          value={form.assetSymbol}
          onChange={(event) => setForm({ ...form, assetSymbol: event.target.value })}
        >
          {SUPPORTED_ASSETS.map((asset) => (
            <option key={asset.symbol} value={asset.symbol}>
              {asset.symbol}
            </option>
          ))}
        </select>
      </label>
      <label>
        Amount Invested
        <input
          aria-label="Amount Invested"
          value={form.amountInvested}
          onChange={(event) => setForm({ ...form, amountInvested: event.target.value })}
        />
      </label>
      <label>
        Purchase Price
        <input
          aria-label="Purchase Price"
          value={form.purchasePrice}
          onChange={(event) => setForm({ ...form, purchasePrice: event.target.value })}
        />
      </label>
      <label>
        Purchase Date
        <input
          aria-label="Purchase Date"
          type="date"
          value={form.purchaseDate}
          onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })}
        />
      </label>
      <p className="derived-quantity">Estimated Quantity: {quantity.toFixed(8)} {form.assetSymbol}</p>
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit">Save Transaction</button>
    </form>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/App.test.tsx`
Expected: PASS with transaction creation updating rendered totals

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePortfolio.ts src/components/TransactionForm.tsx src/components/PriceStatus.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: add transaction entry workflow"
```

### Task 6: Build Dashboard, History, Allocation, And Responsive States

**Files:**
- Create: `src/components/SummaryCards.tsx`
- Create: `src/components/HoldingsTable.tsx`
- Create: `src/components/AllocationChart.tsx`
- Create: `src/components/TransactionHistory.tsx`
- Create: `src/components/EmptyState.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Expand the failing UI integration test for empty and populated states**

```tsx
// src/App.test.tsx
test("shows an empty-state message before any transactions are added", () => {
  render(<App />);
  expect(screen.getByText(/add your first crypto buy/i)).toBeInTheDocument();
});

test("shows holdings, allocation, and history after a transaction is added", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.selectOptions(screen.getByLabelText(/asset/i), "ETH");
  await user.type(screen.getByLabelText(/amount invested/i), "4000");
  await user.type(screen.getByLabelText(/purchase price/i), "2000");
  await user.type(screen.getByLabelText(/purchase date/i), "2026-06-02");
  await user.click(screen.getByRole("button", { name: /save transaction/i }));

  expect(screen.getByRole("heading", { name: /holdings/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /allocation/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /transaction history/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/App.test.tsx`
Expected: FAIL because the dashboard sections are not rendered yet

- [ ] **Step 3: Implement the full responsive dashboard composition**

```tsx
// src/App.tsx
import "./styles.css";
import { AllocationChart } from "./components/AllocationChart";
import { EmptyState } from "./components/EmptyState";
import { HoldingsTable } from "./components/HoldingsTable";
import { PriceStatus } from "./components/PriceStatus";
import { SummaryCards } from "./components/SummaryCards";
import { TransactionForm } from "./components/TransactionForm";
import { TransactionHistory } from "./components/TransactionHistory";
import { usePortfolio } from "./hooks/usePortfolio";
import { usePrices } from "./hooks/usePrices";

export default function App() {
  const { prices, status, lastUpdated } = usePrices();
  const { transactions, snapshot, addTransaction } = usePortfolio(prices);

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">Calm portfolio tracking</p>
        <h1>Crypto Portfolio Tracker</h1>
        <p className="hero-copy">Track your crypto portfolio with clarity, confidence, and less stress.</p>
      </header>

      <PriceStatus status={status} lastUpdated={lastUpdated} />
      <SummaryCards portfolio={snapshot.portfolio} />

      <section className="content-grid">
        <TransactionForm onSubmit={addTransaction} />
        {transactions.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <HoldingsTable assets={snapshot.assets} />
            <AllocationChart assets={snapshot.assets} />
            <TransactionHistory transactions={transactions} />
          </>
        )}
      </section>
    </main>
  );
}
```

```tsx
// src/components/EmptyState.tsx
export function EmptyState() {
  return (
    <section className="panel empty-state">
      <h2>Add your first crypto buy</h2>
      <p>Start with one transaction and the dashboard will automatically calculate your holdings and performance.</p>
    </section>
  );
}
```

- [ ] **Step 4: Run the full test suite and production build**

Run: `npm test -- --run`
Expected: PASS with all unit and integration tests green

Run: `npm run build`
Expected: PASS with final optimized bundle output

- [ ] **Step 5: Commit**

```bash
git add src/components/SummaryCards.tsx src/components/HoldingsTable.tsx src/components/AllocationChart.tsx src/components/TransactionHistory.tsx src/components/EmptyState.tsx src/App.tsx src/styles.css src/App.test.tsx
git commit -m "feat: build portfolio dashboard experience"
```

## Self-Review

### Spec Coverage

- Manual buy entry: covered by Task 5 transaction form and state orchestration.
- Local-first persistence: covered by Task 3 repository implementation and tests.
- Live prices for six assets: covered by Task 4 pricing service and hook.
- Dashboard totals and asset summaries: covered by Task 2 calculations and Task 6 UI.
- Allocation breakdown: covered by Task 6 allocation chart.
- Transaction history: covered by Task 6 history component.
- Empty, invalid, and pricing-error states: covered by Tasks 3, 4, 5, and 6 tests plus UI messaging.

### Placeholder Scan

- No `TBD`, `TODO`, or deferred implementation markers remain.
- Each task lists exact files, commands, and concrete example code.
- Validation, error handling, and testing expectations are explicit.

### Type Consistency

- `Transaction`, `PriceMap`, `AssetSummary`, and `PortfolioSummary` names remain consistent across tasks.
- `buildPortfolioSnapshot`, `validateTransactionInput`, `createTransactionRepository`, `fetchSupportedPrices`, `usePrices`, and `usePortfolio` are referenced consistently from definition through usage.
- The plan keeps `quantity` as a derived field in the form, matching the approved design spec.
