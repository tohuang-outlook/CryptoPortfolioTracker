import type { Transaction } from "../types/portfolio";

export function TransactionHistory({
  transactions
}: {
  transactions: Transaction[];
  onUpdateTransaction?: (input: {
    id: string;
    assetSymbol: string;
    amountInvested: string;
    purchasePrice: string;
    purchaseDate: string;
    notes: string;
  }) => { success: true } | { success: false; error: string };
  onDeleteTransaction?: (id: string) => { success: true } | { success: false; error: string };
}) {
  const orderedTransactions = [...transactions].sort((left, right) => {
    const leftTimestamp = Date.parse(left.createdAt || left.purchaseDate);
    const rightTimestamp = Date.parse(right.createdAt || right.purchaseDate);
    return rightTimestamp - leftTimestamp;
  });

  return (
    <section className="panel" aria-labelledby="transaction-history-heading">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Most recent activity</p>
          <h2 id="transaction-history-heading">Transaction history</h2>
        </div>
      </div>

      <div className="history-list" role="list">
        {orderedTransactions.map((transaction) => (
          <article
            key={transaction.id}
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
            </div>
            <div className="history-item__amounts">
              <p>{formatCurrency(transaction.amountInvested)}</p>
              <p>{formatCurrency(transaction.purchasePrice)} entry</p>
            </div>
          </article>
        ))}
      </div>
    </section>
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
