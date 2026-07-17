import "./styles.css";
import { AllocationChart } from "./components/AllocationChart";
import { EmptyState } from "./components/EmptyState";
import { HoldingsTable } from "./components/HoldingsTable";
import { PriceStatus } from "./components/PriceStatus";
import { ProfileSwitcher } from "./components/ProfileSwitcher";
import { SummaryCards } from "./components/SummaryCards";
import { TransactionForm } from "./components/TransactionForm";
import { TransactionHistory } from "./components/TransactionHistory";
import { BitcoinForecastDashboard } from "./components/BitcoinForecastDashboard";
import { useProfiles } from "./hooks/useProfiles";
import { usePortfolio } from "./hooks/usePortfolio";
import { usePrices } from "./hooks/usePrices";
import { useState } from "react";

export default function App() {
  const [workspace, setWorkspace] = useState<"portfolio" | "forecast">("portfolio");
  const { prices, status, lastUpdated } = usePrices();
  const {
    profiles,
    activeProfile,
    activeTransactions,
    createProfile,
    renameProfile,
    deleteProfile,
    switchProfile,
    saveActiveTransactions
  } = useProfiles();
  const {
    transactions,
    snapshot,
    addTransaction,
    updateTransaction,
    deleteTransaction
  } = usePortfolio(prices, activeTransactions, saveActiveTransactions);

  return (
    <main className="app-shell">
      <section className="dashboard-shell">
        <nav className="app-navigation" aria-label="App workspace">
          <button className={workspace === "portfolio" ? "app-navigation__item app-navigation__item--active" : "app-navigation__item"} onClick={() => setWorkspace("portfolio")}>Portfolio</button>
          <button className={workspace === "forecast" ? "app-navigation__item app-navigation__item--active" : "app-navigation__item"} onClick={() => setWorkspace("forecast")}>Bitcoin Forecast</button>
        </nav>
        <header className="hero-card">
          <div className="hero-copy-block">
            <p className="eyebrow">{workspace === "portfolio" ? "Calm portfolio tracking" : "Adaptive market intelligence"}</p>
            <h1 className="hero-title">{workspace === "portfolio" ? "Crypto Portfolio Tracker" : "Bitcoin Forecast"}</h1>
            <p className="hero-copy">
              {workspace === "portfolio" ? "Track your crypto portfolio with clarity, confidence, and less stress." : "Understand the BTC trend, tomorrow's estimated close, and how the model learns from its past calls."}
            </p>
          </div>
          <div className="hero-status">
            <PriceStatus status={status} lastUpdated={lastUpdated} />
            <ProfileSwitcher
              profiles={profiles}
              activeProfile={activeProfile}
              onCreateProfile={createProfile}
              onRenameProfile={renameProfile}
              onDeleteProfile={deleteProfile}
              onSwitchProfile={switchProfile}
            />
          </div>
        </header>

        {workspace === "forecast" ? <BitcoinForecastDashboard /> : <>
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
        </>}
      </section>
    </main>
  );
}
