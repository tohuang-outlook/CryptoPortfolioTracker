# Transaction Edit And Delete Design

## Summary

This update adds transaction-level editing and deletion to the existing Crypto Portfolio Tracker MVP. The goal is to let users correct mistakes and remove obsolete entries without leaving the main dashboard flow or manually clearing local storage.

## Product Goal

- Let users safely update a single buy transaction after it has been created.
- Let users safely delete a single buy transaction with confirmation.
- Keep the interaction model lightweight and close to the existing transaction-history workflow.
- Ensure all portfolio summaries, holdings, allocation, and history views refresh immediately after a successful edit or delete.

## Non-Goals

- No bulk edit
- No bulk delete
- No undo stack
- No modal-based editor
- No sell-transaction support
- No separate transaction detail page

## User Problem

Users can currently add transactions but cannot fix mistakes or remove an incorrect entry. Because portfolio summaries are derived from those transactions, one wrong buy record can distort total invested, holdings, profit and loss, and allocation.

## Scope

This design applies only to the transaction history area of the existing responsive web app and the related local portfolio state logic.

## Core User Stories

- As a user, I can edit one transaction directly from the transaction history list.
- As a user, I can cancel an edit without changing stored data.
- As a user, I can delete one transaction from the history list.
- As a user, I must confirm before deletion happens.
- As a user, I immediately see dashboard totals and holdings update after a successful edit or delete.
- As a user, I see an error if an edit or delete cannot be persisted locally.

## Interaction Model

### Transaction History Default State

Each transaction item remains readable by default and shows its normal summary content plus two actions:

- `Edit`
- `Delete`

Only one transaction can be in edit mode at a time.
Only one transaction can be in delete-confirm mode at a time.

### Edit Flow

When the user clicks `Edit` on a transaction:

- That specific transaction item switches into inline edit mode.
- Other transactions remain in read-only mode.
- The editable fields are prefilled with the transaction's current values.
- The editable fields are:
  - `asset`
  - `amount invested`
  - `purchase price`
  - `purchase date`
  - `notes`
- `quantity` is shown as a derived value and updates automatically from `amount invested / purchase price`.

Inline edit mode provides these actions:

- `Save`
- `Cancel`

### Save Behavior

- Save uses the same validation rules as new transaction creation.
- If validation fails, the transaction stays in edit mode and shows the error inline.
- If persistence succeeds, the transaction exits edit mode and the app recomputes:
  - portfolio summary
  - holdings
  - allocation
  - transaction history
- If persistence fails, the transaction stays in edit mode and shows a persistence error.

### Cancel Behavior

- Cancel discards unsaved changes for that transaction.
- The item returns to read-only mode.
- No local storage writes happen.

### Delete Flow

When the user clicks `Delete` on a transaction:

- The item enters a confirmation state instead of deleting immediately.
- The confirmation UI asks the user to confirm deletion.
- The confirmation state provides:
  - `Confirm Delete`
  - `Cancel`

### Confirm Delete Behavior

- If the user confirms, the app removes that transaction from state and local storage.
- The app immediately recomputes portfolio summary, holdings, allocation, and history.
- If persistence fails, the transaction is not removed from the visible state and the item shows an error.

### Delete Cancel Behavior

- If the user cancels deletion, the item returns to normal read-only mode.
- No data changes occur.

## UX Direction

- Editing should feel integrated into the history list rather than like a separate workflow.
- Destructive actions should be visually clear but not alarming.
- Confirmation should be compact and local to the transaction row/card, not a blocking modal.
- Mobile layout should stack controls cleanly without making the item feel crowded.

## State Management

The portfolio state layer should gain two new operations:

- `updateTransaction`
- `deleteTransaction`

These operations should:

- work from transaction `id`
- update local in-memory state
- persist to local storage
- return success or failure results
- avoid reporting success if persistence fails

The same stale-state and rapid-update protections used for create flow should be preserved for edit and delete paths.

## Validation Rules

The edit flow reuses the existing validation rules already used for adding a transaction:

- supported asset only
- `amount invested > 0`
- `purchase price > 0`
- valid purchase date required
- `notes` trimmed before save
- `quantity` derived automatically

## Component Changes

### Transaction History

`TransactionHistory` becomes interactive and is responsible for:

- rendering default read-only transaction items
- switching one item into edit mode
- switching one item into delete-confirm mode
- surfacing inline errors for edit/delete actions

The component should not own portfolio calculations. It should only manage row-level interaction state and call handlers provided by the parent.

### Portfolio Hook

`usePortfolio` should own:

- create
- update
- delete
- persistence result handling
- recomputation through existing derived snapshot logic

### Data Layer

The local transaction repository should support saving edited and deleted transaction arrays through the existing persistence mechanism. If persistence fails, the calling hook must receive a failure result and leave committed UI data intact.

## Error Handling

- Validation errors remain inline within the edited transaction item.
- Persistence failures for edit/delete remain inline within the affected transaction item.
- Failed delete must not visually remove the transaction.
- Failed edit must not replace stored data with partial or invalid values.

## Testing Strategy

The implementation should include:

- integration test for editing an existing transaction and seeing summary data update
- integration test for cancelling an inline edit
- integration test for delete confirmation flow
- integration test for cancelling delete
- integration test for persistence failure during edit or delete
- coverage that only one transaction can be edited at a time

## Success Criteria

This feature is successful if:

- a user can edit any single transaction inline
- a user can delete any single transaction with confirmation
- the app recomputes all derived portfolio views immediately after a successful change
- persistence failures are surfaced honestly
- the interaction remains lightweight and understandable on desktop and mobile
