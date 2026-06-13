# Transaction Edit And Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline transaction editing and confirmed deletion to the dashboard so users can safely correct or remove a single buy entry and immediately see all derived portfolio views update.

**Architecture:** Extend the existing local-first portfolio state layer with `updateTransaction` and `deleteTransaction` operations that reuse current validation and persistence protections. Keep row-level UI state inside `TransactionHistory`, where each item can enter read-only, edit, or delete-confirm mode, while `usePortfolio` remains the source of truth for transaction mutations and derived snapshot recomputation.

**Tech Stack:** React, TypeScript, Vitest, React Testing Library, localStorage, existing portfolio/domain hooks

---

## File Structure

- `src/types/portfolio.ts`
  Shared transaction type definitions. May gain a reusable transaction-input type for edit flow.
- `src/domain/validation.ts`
  Validation helpers reused for both add and edit transaction flows.
- `src/hooks/usePortfolio.ts`
  Source of truth for create, update, delete, persistence result handling, and derived snapshot recomputation.
- `src/components/TransactionHistory.tsx`
  Interactive history list with inline edit state, delete-confirm state, and row-level errors.
- `src/components/TransactionForm.tsx`
  Existing create form. Should remain unchanged unless shared helpers need small extraction.
- `src/App.tsx`
  Passes new update/delete handlers into `TransactionHistory`.
- `src/App.test.tsx`
  Integration coverage for edit, cancel edit, delete confirm, delete cancel, and persistence failure behavior.
- `src/data/transactionRepository.ts`
  Existing persistence layer. May need a small type helper alignment but should keep save-array semantics.
- `src/data/transactionRepository.test.ts`
  Tests only if repository result typing or persistence behavior changes.

### Task 1: Add Transaction Update And Delete State Operations

**Files:**
- Modify: `src/types/portfolio.ts`
- Modify: `src/domain/validation.ts`
- Modify: `src/hooks/usePortfolio.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write the failing integration tests for edit and delete mutations**

```tsx
// src/App.test.tsx
test("edits an existing transaction and updates portfolio summary", async () => {
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
        notes: "starter",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z"
      }
    ])
  );

  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /edit bitcoin/i }));
  await user.clear(screen.getByLabelText(/amount invested/i));
  await user.type(screen.getByLabelText(/amount invested/i), "1500");
  await user.click(screen.getByRole("button", { name: /save bitcoin/i }));

  expect(screen.getByText("$1,500.00")).toBeInTheDocument();
});

test("deletes an existing transaction after confirmation", async () => {
  window.localStorage.setItem(
    "crypto-portfolio-transactions",
    JSON.stringify([
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
    ])
  );

  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /delete ethereum/i }));
  await user.click(screen.getByRole("button", { name: /confirm delete ethereum/i }));

  expect(screen.getByRole("heading", { name: /add your first crypto buy/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/App.test.tsx`
Expected: FAIL because edit/delete handlers and history actions do not exist yet

- [ ] **Step 3: Add typed update/delete operations to the portfolio hook**

```ts
// src/hooks/usePortfolio.ts
interface MutateTransactionInput {
  id: string;
  assetSymbol: string;
  amountInvested: string;
  purchasePrice: string;
  purchaseDate: string;
  notes: string;
}

type MutationResult =
  | { success: true }
  | { success: false; error: string };

function persistTransactions(nextTransactions: Transaction[]): MutationResult {
  const saveResult = repository.saveAll(nextTransactions);
  if (!saveResult.success) {
    return saveResult;
  }

  transactionsRef.current = nextTransactions;
  setTransactions(nextTransactions);
  return { success: true };
}

function updateTransaction(input: MutateTransactionInput): MutationResult {
  const validation = validateTransactionInput({
    assetSymbol: input.assetSymbol,
    amountInvested: input.amountInvested,
    purchasePrice: input.purchasePrice,
    purchaseDate: input.purchaseDate,
    notes: input.notes
  });

  if (!validation.success) {
    return validation;
  }

  const existing = transactionsRef.current.find((transaction) => transaction.id === input.id);
  if (!existing) {
    return { success: false, error: "Unable to find that transaction." };
  }

  const asset = SUPPORTED_ASSETS.find((item) => item.symbol === validation.data.assetSymbol);
  if (!asset) {
    return { success: false, error: "Please choose a supported asset." };
  }

  const nextTransactions = transactionsRef.current.map((transaction) =>
    transaction.id === input.id
      ? {
          ...transaction,
          assetSymbol: asset.symbol,
          assetName: asset.name,
          amountInvested: validation.data.amountInvested,
          purchasePrice: validation.data.purchasePrice,
          quantity: validation.data.quantity,
          purchaseDate: validation.data.purchaseDate,
          notes: validation.data.notes,
          updatedAt: new Date().toISOString()
        }
      : transaction
  );

  return persistTransactions(nextTransactions);
}

function deleteTransaction(id: string): MutationResult {
  const nextTransactions = transactionsRef.current.filter(
    (transaction) => transaction.id !== id
  );

  if (nextTransactions.length === transactionsRef.current.length) {
    return { success: false, error: "Unable to find that transaction." };
  }

  return persistTransactions(nextTransactions);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/App.test.tsx`
Expected: PASS for the new edit and delete mutation tests, though UI details may still be rough

- [ ] **Step 5: Commit**

```bash
git add src/types/portfolio.ts src/domain/validation.ts src/hooks/usePortfolio.ts src/App.test.tsx
git commit -m "feat: add transaction update and delete state"
```

### Task 2: Build Inline Edit And Delete-Confirm UI In Transaction History

**Files:**
- Modify: `src/components/TransactionHistory.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Expand the failing UI tests for inline edit and delete-confirm interaction**

```tsx
// src/App.test.tsx
test("cancels inline edit without changing stored values", async () => {
  const user = userEvent.setup();
  seedSingleBtcTransaction();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /edit bitcoin/i }));
  await user.clear(screen.getByLabelText(/amount invested/i));
  await user.type(screen.getByLabelText(/amount invested/i), "1800");
  await user.click(screen.getByRole("button", { name: /cancel edit bitcoin/i }));

  expect(screen.getByText("$1,000.00")).toBeInTheDocument();
  expect(screen.queryByDisplayValue("1800")).not.toBeInTheDocument();
});

test("requires delete confirmation and supports cancel", async () => {
  const user = userEvent.setup();
  seedSingleBtcTransaction();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /delete bitcoin/i }));
  expect(screen.getByText(/confirm deletion/i)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /cancel delete bitcoin/i }));
  expect(screen.getByText(/bitcoin/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/App.test.tsx`
Expected: FAIL because the transaction history does not yet expose edit/delete UI states

- [ ] **Step 3: Implement interactive transaction rows with row-local mode state**

```tsx
// src/components/TransactionHistory.tsx
type RowMode =
  | { type: "view" }
  | { type: "edit"; id: string }
  | { type: "confirm-delete"; id: string };

export function TransactionHistory({
  transactions,
  onUpdateTransaction,
  onDeleteTransaction
}: {
  transactions: Transaction[];
  onUpdateTransaction: (input: {
    id: string;
    assetSymbol: string;
    amountInvested: string;
    purchasePrice: string;
    purchaseDate: string;
    notes: string;
  }) => { success: true } | { success: false; error: string };
  onDeleteTransaction: (id: string) => { success: true } | { success: false; error: string };
}) {
  const [mode, setMode] = useState<RowMode>({ type: "view" });
  const [rowError, setRowError] = useState<string>("");

  return (
    <section className="panel" aria-labelledby="transaction-history-heading">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Most recent activity</p>
          <h2 id="transaction-history-heading">Transaction history</h2>
        </div>
      </div>

      <div className="history-list" role="list">
        {orderedTransactions.map((transaction) => {
          const isEditing = mode.type === "edit" && mode.id === transaction.id;
          const isConfirmingDelete =
            mode.type === "confirm-delete" && mode.id === transaction.id;

          return isEditing ? (
            <EditableTransactionRow
              key={transaction.id}
              transaction={transaction}
              error={rowError}
              onCancel={() => {
                setRowError("");
                setMode({ type: "view" });
              }}
              onSave={(input) => {
                const result = onUpdateTransaction(input);
                if (!result.success) {
                  setRowError(result.error);
                  return;
                }
                setRowError("");
                setMode({ type: "view" });
              }}
            />
          ) : (
            <ReadOnlyTransactionRow
              key={transaction.id}
              transaction={transaction}
              isConfirmingDelete={isConfirmingDelete}
              error={isConfirmingDelete ? rowError : ""}
              onEdit={() => {
                setRowError("");
                setMode({ type: "edit", id: transaction.id });
              }}
              onDelete={() => {
                setRowError("");
                setMode({ type: "confirm-delete", id: transaction.id });
              }}
              onCancelDelete={() => {
                setRowError("");
                setMode({ type: "view" });
              }}
              onConfirmDelete={() => {
                const result = onDeleteTransaction(transaction.id);
                if (!result.success) {
                  setRowError(result.error);
                  return;
                }
                setRowError("");
                setMode({ type: "view" });
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/App.test.tsx`
Expected: PASS with inline edit, cancel, delete-confirm, and delete-cancel coverage green

- [ ] **Step 5: Commit**

```bash
git add src/components/TransactionHistory.tsx src/App.tsx src/styles.css src/App.test.tsx
git commit -m "feat: add inline transaction editing UI"
```

### Task 3: Harden Failure Paths And Finish Regression Coverage

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/components/TransactionHistory.tsx`
- Modify: `src/hooks/usePortfolio.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Add the failing regression tests for persistence failure and single-row mode**

```tsx
// src/App.test.tsx
test("shows an inline error when edited transaction persistence fails", async () => {
  Object.defineProperty(window, "localStorage", {
    value: createStorageMock({ failOnSet: true }),
    configurable: true
  });
  seedSingleBtcTransaction();

  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /edit bitcoin/i }));
  await user.clear(screen.getByLabelText(/amount invested/i));
  await user.type(screen.getByLabelText(/amount invested/i), "1500");
  await user.click(screen.getByRole("button", { name: /save bitcoin/i }));

  expect(screen.getByText(/unable to save transaction/i)).toBeInTheDocument();
  expect(screen.getByDisplayValue("1500")).toBeInTheDocument();
});

test("only one transaction can be in edit mode at a time", async () => {
  seedTwoTransactions();
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /edit bitcoin/i }));
  expect(screen.getByRole("button", { name: /save bitcoin/i })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /edit ethereum/i }));

  expect(screen.queryByRole("button", { name: /save bitcoin/i })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /save ethereum/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/App.test.tsx`
Expected: FAIL because inline persistence-error handling and single-row mode guarantees are incomplete

- [ ] **Step 3: Finish the inline error states and row-mode reset behavior**

```tsx
// src/components/TransactionHistory.tsx
function EditableTransactionRow(...) {
  const [form, setForm] = useState({
    id: transaction.id,
    assetSymbol: transaction.assetSymbol,
    amountInvested: String(transaction.amountInvested),
    purchasePrice: String(transaction.purchasePrice),
    purchaseDate: transaction.purchaseDate,
    notes: transaction.notes
  });

  const quantity =
    Number(form.amountInvested) > 0 && Number(form.purchasePrice) > 0
      ? Number(form.amountInvested) / Number(form.purchasePrice)
      : 0;

  return (
    <article className="history-item history-item--editing" role="listitem">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(form);
        }}
      >
        {/* field controls */}
        <p className="history-item__derived">
          Estimated Quantity: {quantity.toFixed(8)} {form.assetSymbol}
        </p>
        {error ? <p role="alert">{error}</p> : null}
        <div className="history-item__actions">
          <button type="submit" aria-label={`Save ${transaction.assetName}`}>
            Save
          </button>
          <button type="button" aria-label={`Cancel edit ${transaction.assetName}`} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </article>
  );
}
```

- [ ] **Step 4: Run the focused tests, full suite, and build**

Run: `npm test -- --run src/App.test.tsx`
Expected: PASS with all edit/delete integration tests green

Run: `npm test -- --run`
Expected: PASS with zero failing tests across the suite

Run: `npm run build`
Expected: PASS with a successful production build

- [ ] **Step 5: Commit**

```bash
git add src/App.test.tsx src/components/TransactionHistory.tsx src/hooks/usePortfolio.ts src/styles.css
git commit -m "fix: harden transaction edit and delete flows"
```

## Self-Review

### Spec Coverage

- Inline edit from transaction history: covered by Task 2 row-mode UI.
- Delete with confirmation: covered by Task 2 confirm-delete state and tests.
- Shared validation and derived quantity: covered by Task 1 hook reuse and Task 2 edit-row UI.
- Immediate recomputation of summary, holdings, allocation, and history: covered by Task 1 state operations and Task 2 integration checks.
- Honest persistence failure behavior: covered by Task 3 failure-path tests and inline row errors.
- One-row-at-a-time edit/delete state: covered by Task 2 mode model and Task 3 regression tests.

### Placeholder Scan

- No `TBD`, `TODO`, or deferred-implementation markers remain.
- Each task includes concrete files, commands, and code-level direction.
- Validation, confirmation, persistence-failure, and testing expectations are explicit.

### Type Consistency

- `Transaction`, `updateTransaction`, `deleteTransaction`, and the shared mutation input shape remain consistent across tasks.
- `TransactionHistory` receives parent-owned mutation handlers and manages only row-level UI state, matching the approved design.
- Edit flow continues using existing validation and derived quantity semantics rather than introducing a competing transaction model.
