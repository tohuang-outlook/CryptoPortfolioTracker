# Purchase Shares Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create and edit transactions by entering either purchase price or purchase shares while keeping the stored transaction format normalized to amount invested, purchase price, and quantity.

**Architecture:** Extend the transaction form input model to track `purchaseShares` plus a `lastEditedField` marker so both the add form and inline edit form can behave like the same two-way calculator. Keep normalized output in the validation layer, then let the existing portfolio hook and storage model continue to operate on `amountInvested`, `purchasePrice`, and `quantity` only.

**Tech Stack:** React, TypeScript, Vitest, React Testing Library, existing portfolio/domain hooks

---

## File Structure

- `src/types/portfolio.ts`
  Shared form-input and helper types for transaction entry and edit flows.
- `src/domain/validation.ts`
  Normalizes price-first and shares-first input into persisted transaction data.
- `src/domain/validation.test.ts`
  Unit tests for validation and normalization rules.
- `src/components/TransactionForm.tsx`
  Add-transaction form with new `Purchase Shares` field and reciprocal calculation behavior.
- `src/components/TransactionHistory.tsx`
  Inline edit form with the same `Purchase Shares` behavior and conflict-resolution rules.
- `src/App.test.tsx`
  Integration tests for reciprocal field updates in add and edit flows.

### Task 1: Expand Validation To Support Price-First And Shares-First Input

**Files:**
- Modify: `src/types/portfolio.ts`
- Modify: `src/domain/validation.ts`
- Modify: `src/domain/validation.test.ts`

- [ ] **Step 1: Write the failing validation tests for shares-first support**

```ts
// src/domain/validation.test.ts
it("returns normalized price when amount and purchase shares are valid", () => {
  const result = validateTransactionInput({
    assetSymbol: "BTC",
    amountInvested: "1000",
    purchasePrice: "",
    purchaseShares: "0.02",
    purchaseDate: "2026-06-01",
    notes: ""
  });

  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.purchasePrice).toBe(50000);
    expect(result.data.quantity).toBe(0.02);
  }
});

it("rejects input when both purchase price and purchase shares are invalid", () => {
  const result = validateTransactionInput({
    assetSymbol: "ETH",
    amountInvested: "1000",
    purchasePrice: "",
    purchaseShares: "",
    purchaseDate: "2026-06-01",
    notes: ""
  });

  expect(result.success).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/domain/validation.test.ts`
Expected: FAIL because `purchaseShares` is not yet part of the input contract or normalization logic

- [ ] **Step 3: Add shared input types and validation normalization**

```ts
// src/types/portfolio.ts
export type PurchaseField = "purchasePrice" | "purchaseShares";

export interface TransactionFormInput {
  assetSymbol: string;
  amountInvested: string;
  purchasePrice: string;
  purchaseShares: string;
  purchaseDate: string;
  notes: string;
}
```

```ts
// src/domain/validation.ts
export function validateTransactionInput(input: TransactionFormInput) {
  const amountInvested = Number(input.amountInvested);
  const purchasePrice = Number(input.purchasePrice);
  const purchaseShares = Number(input.purchaseShares);
  const hasValidPrice = Number.isFinite(purchasePrice) && purchasePrice > 0;
  const hasValidShares = Number.isFinite(purchaseShares) && purchaseShares > 0;

  if (!supported) {
    return { success: false as const, error: "Please choose a supported asset." };
  }

  if (!Number.isFinite(amountInvested) || amountInvested <= 0) {
    return { success: false as const, error: "Amount invested must be greater than zero." };
  }

  if (!hasValidPrice && !hasValidShares) {
    return {
      success: false as const,
      error: "Enter either a valid purchase price or purchase shares."
    };
  }

  if (!input.purchaseDate) {
    return { success: false as const, error: "Please choose a purchase date." };
  }

  const normalizedPurchasePrice = hasValidPrice
    ? purchasePrice
    : amountInvested / purchaseShares;
  const normalizedQuantity = hasValidShares
    ? purchaseShares
    : amountInvested / purchasePrice;

  return {
    success: true as const,
    data: {
      assetSymbol: input.assetSymbol,
      amountInvested,
      purchasePrice: normalizedPurchasePrice,
      purchaseDate: input.purchaseDate,
      notes: input.notes.trim(),
      quantity: normalizedQuantity
    }
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/domain/validation.test.ts`
Expected: PASS with price-first, shares-first, and invalid-both coverage green

- [ ] **Step 5: Commit**

```bash
git add src/types/portfolio.ts src/domain/validation.ts src/domain/validation.test.ts
git commit -m "feat: support purchase shares validation"
```

### Task 2: Add Reciprocal Purchase Shares UI To The Add Transaction Form

**Files:**
- Modify: `src/components/TransactionForm.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write the failing add-form integration test for reciprocal updates**

```tsx
// src/App.test.tsx
test("recalculates purchase price when amount invested and purchase shares are entered", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText(/amount invested/i), "1000");
  await user.type(screen.getByLabelText(/purchase shares/i), "0.02");

  expect(screen.getByLabelText(/purchase price/i)).toHaveValue(50000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/App.test.tsx`
Expected: FAIL because the add form does not yet render `Purchase Shares` or reciprocal field updates

- [ ] **Step 3: Implement shared calculator-style add-form behavior**

```tsx
// src/components/TransactionForm.tsx
const INITIAL_FORM: TransactionFormValues = {
  assetSymbol: "BTC",
  amountInvested: "",
  purchasePrice: "",
  purchaseShares: "",
  purchaseDate: "",
  notes: ""
};

const [lastEditedField, setLastEditedField] = useState<PurchaseField>("purchasePrice");

function syncPurchaseFields(
  nextForm: TransactionFormValues,
  field: PurchaseField
): TransactionFormValues {
  const amountInvested = Number(nextForm.amountInvested);
  const purchasePrice = Number(nextForm.purchasePrice);
  const purchaseShares = Number(nextForm.purchaseShares);

  if (!(amountInvested > 0)) {
    return nextForm;
  }

  if (field === "purchasePrice" && purchasePrice > 0) {
    return {
      ...nextForm,
      purchaseShares: String(amountInvested / purchasePrice)
    };
  }

  if (field === "purchaseShares" && purchaseShares > 0) {
    return {
      ...nextForm,
      purchasePrice: String(amountInvested / purchaseShares)
    };
  }

  return nextForm;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/App.test.tsx`
Expected: PASS with the new add-form reciprocal calculation test green

- [ ] **Step 5: Commit**

```bash
git add src/components/TransactionForm.tsx src/App.test.tsx
git commit -m "feat: add purchase shares to transaction form"
```

### Task 3: Apply The Same Purchase Shares Logic To Inline Edit And Finish Verification

**Files:**
- Modify: `src/components/TransactionHistory.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write the failing inline-edit test for reciprocal updates**

```tsx
// src/App.test.tsx
test("recalculates purchase price inside inline edit when purchase shares is changed", async () => {
  seedSingleBtcTransaction();
  const user = userEvent.setup();
  render(<App />);

  const history = screen.getByRole("region", { name: /transaction history/i });
  await user.click(within(history).getByRole("button", { name: /edit bitcoin/i }));
  await user.clear(within(history).getByLabelText(/purchase shares/i));
  await user.type(within(history).getByLabelText(/purchase shares/i), "0.01");

  expect(within(history).getByLabelText(/purchase price/i)).toHaveValue(100000);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/App.test.tsx`
Expected: FAIL because inline edit does not yet render or synchronize `Purchase Shares`

- [ ] **Step 3: Reuse the same reciprocal-field model in inline edit**

```tsx
// src/components/TransactionHistory.tsx
const [form, setForm] = useState<TransactionFormInput>({
  assetSymbol: transaction.assetSymbol,
  amountInvested: String(transaction.amountInvested),
  purchasePrice: String(transaction.purchasePrice),
  purchaseShares: String(transaction.quantity),
  purchaseDate: transaction.purchaseDate,
  notes: transaction.notes
});
const [lastEditedField, setLastEditedField] =
  useState<PurchaseField>("purchasePrice");
```

- [ ] **Step 4: Run focused tests, full suite, and production build**

Run: `npm test -- --run src/App.test.tsx`
Expected: PASS with add-form and inline-edit reciprocal-field tests green

Run: `npm test -- --run`
Expected: PASS with zero failing tests across the suite

Run: `npm run build`
Expected: PASS with a successful production build

- [ ] **Step 5: Commit**

```bash
git add src/components/TransactionHistory.tsx src/App.test.tsx
git commit -m "feat: add purchase shares to inline transaction editing"
```

## Self-Review

### Spec Coverage

- Price-first and shares-first input support: covered by Task 1 validation changes.
- Last-edited-field conflict resolution: covered by Tasks 2 and 3 shared form-state behavior.
- Add form and inline edit parity: covered by Tasks 2 and 3.
- No storage schema change: preserved by Task 1 normalized validation output.
- Regression safety for holdings and summary values: covered by Task 3 full-suite verification and App-level integration checks.

### Placeholder Scan

- No `TBD`, `TODO`, or deferred-implementation markers remain.
- Each task includes exact files, commands, and concrete code direction.
- Validation behavior, reciprocal-field UI behavior, and verification commands are explicit.

### Type Consistency

- `TransactionFormInput` remains the shared contract across validation, add form, and inline edit form.
- `purchasePrice`, `purchaseShares`, and `lastEditedField` naming stays consistent across the plan.
- Persisted transaction output remains normalized to `amountInvested`, `purchasePrice`, and `quantity`, matching the approved design.
