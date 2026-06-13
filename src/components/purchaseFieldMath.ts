const PURCHASE_FIELD_DECIMALS = 8;

export function formatPurchaseFieldValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  return value.toFixed(PURCHASE_FIELD_DECIMALS).replace(/\.?0+$/, "");
}
