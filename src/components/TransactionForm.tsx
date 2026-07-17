import { useState } from "react";
import { SUPPORTED_ASSETS } from "../constants/assets";
import { formatPurchaseFieldValue } from "./purchaseFieldMath";
import type {
  PurchaseField,
  TransactionFormInput
} from "../types/portfolio";
import { useTranslation } from "../i18n";

type TransactionFormResult =
  | { success: true }
  | { success: false; error: string };

const INITIAL_FORM: TransactionFormInput = {
  assetSymbol: "BTC",
  amountInvested: "",
  purchasePrice: "",
  purchaseShares: "",
  purchaseDate: "",
  notes: ""
};

export function TransactionForm({
  onSubmit
}: {
  onSubmit: (values: TransactionFormInput) => TransactionFormResult;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<TransactionFormInput>(INITIAL_FORM);
  const [error, setError] = useState("");
  const [lastEditedField, setLastEditedField] =
    useState<PurchaseField>("purchasePrice");

  const amountInvested = Number(form.amountInvested);
  const purchasePrice = Number(form.purchasePrice);
  const purchaseShares = Number(form.purchaseShares);
  const quantity =
    amountInvested > 0 && purchasePrice > 0
      ? amountInvested / purchasePrice
      : amountInvested > 0 && purchaseShares > 0
        ? purchaseShares
        : 0;

  function syncPurchaseFields(
    nextForm: TransactionFormInput,
    field: PurchaseField
  ): TransactionFormInput {
    const nextAmountInvested = Number(nextForm.amountInvested);
    const nextPurchasePrice = Number(nextForm.purchasePrice);
    const nextPurchaseShares = Number(nextForm.purchaseShares);

    if (!(nextAmountInvested > 0)) {
      return nextForm;
    }

    if (field === "purchasePrice" && nextPurchasePrice > 0) {
      return {
        ...nextForm,
        purchaseShares: formatPurchaseFieldValue(
          nextAmountInvested / nextPurchasePrice
        )
      };
    }

    if (field === "purchaseShares" && nextPurchaseShares > 0) {
      return {
        ...nextForm,
        purchasePrice: formatPurchaseFieldValue(
          nextAmountInvested / nextPurchaseShares
        )
      };
    }

    return nextForm;
  }

  function updateAmountInvested(value: string) {
    setForm((currentForm) =>
      syncPurchaseFields(
        {
          ...currentForm,
          amountInvested: value
        },
        lastEditedField
      )
    );
  }

  function updatePurchaseField(field: PurchaseField, value: string) {
    setLastEditedField(field);
    setForm((currentForm) =>
      syncPurchaseFields(
        {
          ...currentForm,
          [field]: value
        },
        field
      )
    );
  }

  return (
    <section aria-labelledby="transaction-form-heading">
      <h2 id="transaction-form-heading">{t("Add transaction")}</h2>
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
          setLastEditedField("purchasePrice");
        }}
      >
        <label>
          {t("Asset")}
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
          {t("Amount Invested")}
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            value={form.amountInvested}
            onChange={(event) => updateAmountInvested(event.target.value)}
          />
        </label>

        <label>
          {t("Purchase Price")}
          <input
            type="number"
            inputMode="decimal"
            min="0.00000001"
            step="0.00000001"
            value={form.purchasePrice}
            onChange={(event) =>
              updatePurchaseField("purchasePrice", event.target.value)
            }
          />
        </label>

        <label>
          {t("Purchase Shares")}
          <input
            type="number"
            inputMode="decimal"
            min="0.00000001"
            step="0.00000001"
            value={form.purchaseShares}
            onChange={(event) =>
              updatePurchaseField("purchaseShares", event.target.value)
            }
          />
        </label>

        <label>
          {t("Purchase Date")}
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
          {t("Notes")}
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

        <p>{t("Estimated Quantity: {quantity} {symbol}", { quantity: quantity.toFixed(8), symbol: form.assetSymbol })}</p>
        {error ? <p role="alert">{error}</p> : null}

        <button type="submit">{t("Save Transaction")}</button>
      </form>
    </section>
  );
}
