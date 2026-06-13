import { useState } from "react";
import { SUPPORTED_ASSETS } from "../constants/assets";
import type { Transaction, TransactionFormInput } from "../types/portfolio";

type TransactionMutationResult =
  | { success: true }
  | { success: false; error: string };

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
  onUpdateTransaction?: (input: {
    id: string;
    assetSymbol: string;
    amountInvested: string;
    purchasePrice: string;
    purchaseDate: string;
    notes: string;
  }) => TransactionMutationResult;
  onDeleteTransaction?: (id: string) => TransactionMutationResult;
}) {
  const [mode, setMode] = useState<RowMode>({ type: "view" });
  const [rowError, setRowError] = useState("");

  const orderedTransactions = [...transactions].sort((left, right) => {
    const leftTimestamp = Date.parse(left.createdAt || left.purchaseDate);
    const rightTimestamp = Date.parse(right.createdAt || right.purchaseDate);
    return rightTimestamp - leftTimestamp;
  });

  return (
    <section
      className="panel"
      aria-labelledby="transaction-history-heading"
    >
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

          if (isEditing) {
            return (
              <EditableTransactionRow
                key={transaction.id}
                transaction={transaction}
                error={rowError}
                onCancel={() => {
                  setRowError("");
                  setMode({ type: "view" });
                }}
                onSave={(input) => {
                  const result = onUpdateTransaction?.(input) ?? {
                    success: false as const,
                    error: "Editing is unavailable right now."
                  };

                  if (!result.success) {
                    setRowError(result.error);
                    return;
                  }

                  setRowError("");
                  setMode({ type: "view" });
                }}
              />
            );
          }

          return (
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
                const result = onDeleteTransaction?.(transaction.id) ?? {
                  success: false as const,
                  error: "Deleting is unavailable right now."
                };

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

function EditableTransactionRow({
  transaction,
  error,
  onCancel,
  onSave
}: {
  transaction: Transaction;
  error: string;
  onCancel: () => void;
  onSave: (input: TransactionFormInput & { id: string }) => void;
}) {
  const [form, setForm] = useState<TransactionFormInput>({
    assetSymbol: transaction.assetSymbol,
    amountInvested: String(transaction.amountInvested),
    purchasePrice: String(transaction.purchasePrice),
    purchaseDate: transaction.purchaseDate,
    notes: transaction.notes
  });

  const amountInvested = Number(form.amountInvested);
  const purchasePrice = Number(form.purchasePrice);
  const quantity =
    amountInvested > 0 && purchasePrice > 0 ? amountInvested / purchasePrice : 0;

  return (
    <article
      className="history-item history-item--editing"
      role="listitem"
    >
      <form
        className="history-edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ ...form, id: transaction.id });
        }}
      >
        <div className="history-edit-grid">
          <label>
            Asset
            <select
              value={form.assetSymbol}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  assetSymbol: event.target.value
                }))
              }
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
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              value={form.amountInvested}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  amountInvested: event.target.value
                }))
              }
            />
          </label>

          <label>
            Purchase Price
            <input
              type="number"
              inputMode="decimal"
              min="0.00000001"
              step="0.00000001"
              required
              value={form.purchasePrice}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  purchasePrice: event.target.value
                }))
              }
            />
          </label>

          <label>
            Purchase Date
            <input
              type="date"
              required
              value={form.purchaseDate}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  purchaseDate: event.target.value
                }))
              }
            />
          </label>
        </div>

        <label>
          Notes
          <textarea
            value={form.notes}
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                notes: event.target.value
              }))
            }
          />
        </label>

        <p className="history-item__derived">
          Estimated Quantity: {quantity.toFixed(8)} {form.assetSymbol}
        </p>

        {error ? <p role="alert">{error}</p> : null}

        <div className="history-item__actions">
          <button
            type="submit"
            aria-label={`Save ${transaction.assetName}`}
          >
            Save
          </button>
          <button
            type="button"
            className="button-secondary"
            aria-label={`Cancel edit ${transaction.assetName}`}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </form>
    </article>
  );
}

function ReadOnlyTransactionRow({
  transaction,
  isConfirmingDelete,
  error,
  onEdit,
  onDelete,
  onCancelDelete,
  onConfirmDelete
}: {
  transaction: Transaction;
  isConfirmingDelete: boolean;
  error: string;
  onEdit: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  return (
    <article
      className="history-item"
      role="listitem"
    >
      <div className="history-item__main">
        <p className="history-item__title">
          {transaction.assetName} ({transaction.assetSymbol})
        </p>
        <p className="history-item__meta">
          Buy · {formatDate(transaction.purchaseDate)} ·{" "}
          {transaction.quantity.toFixed(8)} {transaction.assetSymbol}
        </p>
        {transaction.notes ? (
          <p className="history-item__notes">{transaction.notes}</p>
        ) : null}
        {isConfirmingDelete ? (
          <div className="history-item__confirm">
            <p>Confirm deletion?</p>
            {error ? <p role="alert">{error}</p> : null}
            <div className="history-item__actions">
              <button
                type="button"
                className="button-danger"
                aria-label={`Confirm delete ${transaction.assetName}`}
                onClick={onConfirmDelete}
              >
                Confirm Delete
              </button>
              <button
                type="button"
                className="button-secondary"
                aria-label={`Cancel delete ${transaction.assetName}`}
                onClick={onCancelDelete}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="history-item__side">
        <div className="history-item__amounts">
          <p>{formatCurrency(transaction.amountInvested)}</p>
          <p>{formatCurrency(transaction.purchasePrice)} entry</p>
        </div>
        <div className="history-item__actions">
          <button
            type="button"
            className="button-secondary"
            aria-label={`Edit ${transaction.assetName}`}
            onClick={onEdit}
          >
            Edit
          </button>
          <button
            type="button"
            className="button-secondary button-danger-soft"
            aria-label={`Delete ${transaction.assetName}`}
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}
