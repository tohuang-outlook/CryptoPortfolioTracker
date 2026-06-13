# Purchase Shares Input Design

## Summary

This update expands transaction input so users can enter either `Purchase Price` or `Purchase Shares` when creating or editing a buy transaction. The app should behave like a lightweight calculator: `Amount Invested` stays required, and the app derives the missing value between price and shares while storing the same normalized transaction model as before.

## Product Goal

- Reduce friction when entering transactions by supporting either price-first or shares-first workflows.
- Keep transaction entry aligned with how investors often record buys in spreadsheets.
- Preserve the current normalized data model so downstream portfolio calculations do not need a different storage shape.

## Non-Goals

- No support for partial transactions without `Amount Invested`
- No separate advanced mode or calculator screen
- No changes to sell support
- No support for saving both raw user formulas and normalized output

## User Problem

Users do not always know or want to type `Purchase Price` first. In many real records they know how much they spent and how many coins they bought. The current form forces a price-first workflow, which makes transaction entry slower and less natural.

## Scope

This design applies to both:

- the `Add Transaction` form
- the inline transaction edit form in `TransactionHistory`

## Core User Stories

- As a user, I can enter `Amount Invested` plus `Purchase Price` and let the app calculate shares.
- As a user, I can enter `Amount Invested` plus `Purchase Shares` and let the app calculate purchase price.
- As a user, I can type into either `Purchase Price` or `Purchase Shares` and see the other value update immediately.
- As a user, if I change both fields, the last field I edited becomes the source of truth.
- As a user, I still get the same portfolio totals, holdings, and history behavior after saving.

## Interaction Model

### Input Fields

Transaction input should include:

- `Asset`
- `Amount Invested`
- `Purchase Price`
- `Purchase Shares`
- `Purchase Date`
- `Notes`

When editing an existing transaction, both `Purchase Price` and `Purchase Shares` should be prefilled from the normalized stored transaction so the user can start from either representation.

## Required Rules

- `Amount Invested` is always required.
- `Purchase Price` and `Purchase Shares` are no longer both required individually.
- At least one of `Purchase Price` or `Purchase Shares` must be valid and greater than zero.
- `Purchase Date` is required.

## Calculation Rules

The form behaves as a two-way calculator around `Amount Invested`.

### Price-First Entry

If the user provides:

- `Amount Invested`
- `Purchase Price`

then the app derives:

- `Purchase Shares = Amount Invested / Purchase Price`

### Shares-First Entry

If the user provides:

- `Amount Invested`
- `Purchase Shares`

then the app derives:

- `Purchase Price = Amount Invested / Purchase Shares`

## Conflict Resolution

If the user fills both `Purchase Price` and `Purchase Shares`, the last edited field becomes the source of truth.

This means:

- if the user last changes `Purchase Price`, the app recalculates `Purchase Shares`
- if the user last changes `Purchase Shares`, the app recalculates `Purchase Price`

The app should update the dependent field immediately in the UI rather than waiting for submit.

## Editing Behavior

This same two-way calculation model should be used in:

- the top-level add transaction form
- inline edit mode in transaction history

Both surfaces should behave the same way so the user does not have to learn two different input systems.

## Stored Data Model

No change to persisted transaction shape is required.

The app should still store normalized transaction data as:

- `amountInvested`
- `purchasePrice`
- `quantity`

`Purchase Shares` is a UI/input affordance, not a separate persisted field beyond the existing normalized `quantity`.

## Validation Rules

Validation should change from the current price-only rule to the following:

- supported asset only
- `amountInvested > 0`
- `purchasePrice > 0` or `purchaseShares > 0`, with at least one valid input present
- `purchaseDate` required
- `notes` trimmed before save

If the user enters invalid or zero values for both `Purchase Price` and `Purchase Shares`, save must fail with a clear inline error.

## State Handling

Form state should track:

- raw field strings for `amountInvested`
- raw field strings for `purchasePrice`
- raw field strings for `purchaseShares`
- the most recently edited field between `purchasePrice` and `purchaseShares`

That last-edited marker is required so the app can deterministically resolve conflicts and keep the UX stable.

## Component Impact

### Add Transaction Form

The add form should:

- render the new `Purchase Shares` field
- support immediate reciprocal updates between price and shares
- submit normalized transaction data to the existing portfolio state layer

### Inline Edit Form

The transaction edit form should:

- render the same `Purchase Shares` field
- prefill from normalized transaction data
- support the same reciprocal update rules
- preserve current edit/save/cancel behavior

### Validation Layer

The transaction validation helper should accept a form input shape that includes:

- `amountInvested`
- `purchasePrice`
- `purchaseShares`
- `purchaseDate`
- `notes`

It should return normalized output containing:

- `amountInvested`
- `purchasePrice`
- `quantity`
- `purchaseDate`
- `notes`

## Error Handling

- If `Amount Invested` is missing or invalid, show the existing style of inline error.
- If both `Purchase Price` and `Purchase Shares` are empty or invalid, show a clear inline error.
- If derived math would divide by zero, treat the input as invalid and do not save.
- Persistence behavior should remain unchanged: no false success on failed save.

## Testing Strategy

Implementation should include:

- validation tests for price-first input
- validation tests for shares-first input
- validation tests for both fields invalid
- component/integration tests that the add form recalculates the reciprocal field
- component/integration tests that the inline edit form recalculates the reciprocal field
- regression coverage that saved transactions still produce correct holdings and summary values

## Success Criteria

This feature is successful if:

- users can enter transactions with either `Purchase Price` or `Purchase Shares`
- the form immediately recalculates the dependent field
- last-edited-field conflict resolution behaves consistently
- saved transactions still use the existing normalized storage format
- existing portfolio calculations continue to work without schema changes
