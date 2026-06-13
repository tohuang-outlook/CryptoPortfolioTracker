import "./styles.css";
import { PriceStatus } from "./components/PriceStatus";
import { TransactionForm } from "./components/TransactionForm";
import { usePortfolio } from "./hooks/usePortfolio";
import { usePrices } from "./hooks/usePrices";

export default function App() {
  const { prices, status, lastUpdated } = usePrices();
  const { snapshot, addTransaction } = usePortfolio(prices);

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Calm portfolio tracking</p>
        <h1>Crypto Portfolio Tracker</h1>
        <p className="hero-copy">
          Track your crypto portfolio with clarity, confidence, and less
          stress.
        </p>

        <PriceStatus status={status} lastUpdated={lastUpdated} />

        <section aria-labelledby="portfolio-summary-heading">
          <h2 id="portfolio-summary-heading">Portfolio summary</h2>
          <p>Total invested:</p>
          <p>{formatCurrency(snapshot.portfolio.totalInvested)}</p>
          <p>Portfolio value:</p>
          <p>{formatCurrency(snapshot.portfolio.portfolioValue)}</p>
        </section>

        <TransactionForm onSubmit={addTransaction} />

        <section aria-labelledby="holdings-heading">
          <h2 id="holdings-heading">Holdings</h2>
          {snapshot.assets.length === 0 ? (
            <p>No transactions yet.</p>
          ) : (
            <ul>
              {snapshot.assets.map((asset) => (
                <li key={asset.assetSymbol}>
                  <p>{asset.assetName}</p>
                  <p>{asset.totalQuantity.toFixed(8)} {asset.assetSymbol}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}
