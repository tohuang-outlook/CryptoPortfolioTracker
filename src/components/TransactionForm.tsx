import { useState } from "react";
import { SUPPORTED_ASSETS } from "../constants/assets";

interface TransactionFormValues {
  assetSymbol: string;
  amountInvested: string;
  purchasePrice: string;
  purchaseDate: string;
  notes: string;
}

type TransactionFormResult =
  | { success: true }
  | { success: false; error: string };

const INITIAL_FORM: TransactionFormValues = {
  assetSymbol: "BTC",
  amountInvested: "",
  purchasePrice: "",
  purchaseDate: "",
  notes: ""
};

export function TransactionForm({
  onSubmit
}: {
  onSubmit: (values: TransactionFormValues) => TransactionFormResult;
}) {
  const [form, setForm] = useState<TransactionFormValues>(INITIAL_FORM);
  const [error, setError] = useState("");

  const amountInvested = Number(form.amountInvested);
  const purchasePrice = Number(form.purchasePrice);
  const quantity =
    amountInvested > 0 && purchasePrice > 0 ? amountInvested / purchasePrice : 0;

  return (
    <section aria-labelledby="transaction-form-heading">
      <h2 id="transaction-form-heading">Add transaction</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();

          const result = onSubmit(form);
          if (!result.success) {
            setError(result.error);
            return;
          }

          setError("");
          setForm(INITIAL_FORM);
        }}
      >
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

        <p>Estimated Quantity: {quantity.toFixed(8)} {form.assetSymbol}</p>
        {error ? <p role="alert">{error}</p> : null}

        <button type="submit">Save Transaction</button>
      </form>
    </section>
  );
}
