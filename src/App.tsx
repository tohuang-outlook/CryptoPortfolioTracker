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
  const {
    transactions,
    snapshot,
    addTransaction,
    updateTransaction,
    deleteTransaction
  } = usePortfolio(prices);

  return (
    <main className="app-shell">
      <section className="dashboard-shell">
        <header className="hero-card">
          <div className="hero-copy-block">
            <p className="eyebrow">Calm portfolio tracking</p>
            <h1 className="hero-title">Crypto Portfolio Tracker</h1>
            <p className="hero-copy">
              Track your crypto portfolio with clarity, confidence, and less
              stress.
            </p>
          </div>
          <div className="hero-status">
            <PriceStatus status={status} lastUpdated={lastUpdated} />
          </div>
        </header>

        <SummaryCards portfolio={snapshot.portfolio} />

        <section className="content-grid">
          <div className="content-grid__primary">
            <TransactionForm onSubmit={addTransaction} />
            {transactions.length === 0 ? (
              <EmptyState />
            ) : (
              <TransactionHistory
                transactions={transactions}
                onUpdateTransaction={updateTransaction}
                onDeleteTransaction={deleteTransaction}
              />
            )}
          </div>

          {transactions.length > 0 ? (
            <div className="content-grid__secondary">
              <>
                <HoldingsTable assets={snapshot.assets} />
                <AllocationChart assets={snapshot.assets} />
              </>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
