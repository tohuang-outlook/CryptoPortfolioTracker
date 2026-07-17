import type { PortfolioSummary } from "../types/portfolio";
import { useTranslation } from "../i18n";

export function SummaryCards({
  portfolio
}: {
  portfolio: PortfolioSummary;
}) {
  const { t } = useTranslation();
  const cards = [
    {
      label: t("Total invested"),
      value: formatCurrency(portfolio.totalInvested),
      tone: "neutral"
    },
    {
      label: t("Portfolio value"),
      value: formatCurrency(portfolio.portfolioValue),
      tone: "neutral"
    },
    {
      label: t("Unrealized P&L"),
      value: formatSignedCurrency(portfolio.totalUnrealizedPnL),
      tone: portfolio.totalUnrealizedPnL >= 0 ? "positive" : "negative"
    },
    {
      label: t("Total return"),
      value: formatPercent(portfolio.totalReturnPercent),
      tone: portfolio.totalReturnPercent >= 0 ? "positive" : "negative"
    }
  ] as const;

  return (
    <section
      className="summary-grid"
      aria-label={t("Portfolio summary")}
    >
      {cards.map((card) => (
        <article
          key={card.label}
          className={`summary-card summary-card--${card.tone}`}
        >
          <p className="summary-card__label">{card.label}</p>
          <p className="summary-card__value">{card.value}</p>
        </article>
      ))}
    </section>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatSignedCurrency(value: number) {
  const formattedValue = formatCurrency(Math.abs(value));
  return value >= 0 ? `+${formattedValue}` : `-${formattedValue}`;
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : "-"}${Math.abs(value * 100).toFixed(2)}%`;
}
