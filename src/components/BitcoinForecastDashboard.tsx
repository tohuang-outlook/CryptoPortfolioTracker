import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useBitcoinForecast } from "../hooks/useBitcoinForecast";
import { useTranslation } from "../i18n";
import type { ForecastAsset } from "../types/forecast";
import { useState } from "react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

export function BitcoinForecastDashboard() {
  const [assetSymbol, setAssetSymbol] = useState<ForecastAsset>("BTC");
  const [chartRange, setChartRange] = useState<14 | 30 | 90 | "all">(90);
  const { forecast, status, error } = useBitcoinForecast(assetSymbol);
  const { language, t } = useTranslation();

  if (status === "loading" && !forecast) {
    return <section className="forecast-loading panel">{t("Preparing the {asset} forecast from daily market data...", { asset: assetSymbol })}</section>;
  }

  if (status === "error" || !forecast) {
    return <section className="forecast-loading panel forecast-loading--error">{t(error ?? "Coinbase daily market data is unavailable right now. Please try again shortly.")}</section>;
  }

  const forecastDirectionClass = forecast.direction.toLowerCase();
  const allSettledRecords = forecast.records
    .filter((record) => (record.horizon ?? "daily") === "daily" && record.actualClose !== undefined)
    .sort((left, right) => left.targetDate.localeCompare(right.targetDate));
  const settledRecords = chartRange === "all" ? allSettledRecords : allSettledRecords.slice(-chartRange);
  const errorChart = settledRecords.map((record) => ({
    date: shortDate(record.targetDate, language),
    forecast: Math.round(record.predictedClose),
    actual: Math.round(record.actualClose!)
  }));
  const journalRecords = forecast.records
    .filter((record) => (record.horizon ?? "daily") === "daily")
    .sort((left, right) => right.targetDate.localeCompare(left.targetDate))
    .slice(0, 14);

  return (
    <section className="forecast-dashboard">
      <div className="forecast-asset-switcher" aria-label={t("Forecast asset")}>
        {(["BTC", "ETH", "ADA", "SOL", "XRP", "DOGE"] as const).map((symbol) => (
          <button key={symbol} type="button" className={assetSymbol === symbol ? "forecast-asset-switcher__item forecast-asset-switcher__item--active" : "forecast-asset-switcher__item"} onClick={() => setAssetSymbol(symbol)}>{symbol}</button>
        ))}
      </div>
      <header className="forecast-hero panel">
        <div>
          <p className="panel__eyebrow">{t("Adaptive daily forecast")}</p>
          <h2>{forecast.assetName} {t("Forecast")}</h2>
          <p className="forecast-hero__copy">
            {t("A transparent next-day estimate based on {asset} daily trend, momentum, volatility, and prior forecast error.", { asset: assetSymbol })}
          </p>
        </div>
        <div className="forecast-hero__outlook">
          <div className={`forecast-bias forecast-bias--${forecastDirectionClass}`}>
            <span>{t("24h bias")}</span>
            <strong>{t(forecast.direction)}</strong>
            <small>{forecast.expectedReturnPercent >= 0 ? "+" : ""}{forecast.expectedReturnPercent.toFixed(2)}%</small>
          </div>
          <div className={`forecast-decision forecast-decision--${forecast.decision.status}`}>
            <span>{t("Decision gate")}</span>
            <strong>{t(decisionLabel(forecast.decision.status))}</strong>
            <small>{t(forecast.decision.detail)}</small>
            <b>{t("Quality score: {score}%", { score: forecast.decision.score })}</b>
          </div>
        </div>
      </header>

      <section className="forecast-summary-grid">
        <ForecastMetric label={t("{asset} daily close", { asset: assetSymbol })} value={currency.format(forecast.currentClose)} detail={`${t("Closed")} ${shortDate(forecast.asOfDate, language)}`} />
        <ForecastMetric label={t("Base case (50%)")} value={currency.format(forecast.predictedClose)} detail={shortDate(forecast.targetDate, language)} />
        <ForecastMetric label={t("Lower case (16%)")} value={currency.format(forecast.lowerBound)} detail={t("Central 68% range")} />
        <ForecastMetric label={t("Upper case (84%)")} value={currency.format(forecast.upperBound)} detail={t("Central 68% range")} />
        <ForecastMetric label={t("Confidence")} value={`${forecast.confidence}%`} detail={t("Model confidence, not certainty")} />
      </section>

      <section className="weekly-forecast panel">
        <div>
          <p className="panel__eyebrow">{t("7-day forecast")}</p>
          <h2>{t("Expected {asset} close in one week", { asset: assetSymbol })}</h2>
          <p>{t("Uses longer trend weighting and a wider volatility range than the next-day estimate.")}</p>
        </div>
        <div className={`weekly-forecast__bias weekly-forecast__bias--${forecast.weeklyForecast.direction.toLowerCase()}`}>
          <span>{t("7D bias")}</span>
          <strong>{t(forecast.weeklyForecast.direction)}</strong>
          <small>{forecast.weeklyForecast.expectedReturnPercent >= 0 ? "+" : ""}{forecast.weeklyForecast.expectedReturnPercent.toFixed(2)}%</small>
        </div>
        <div className="weekly-forecast__metric"><span>{t("Projected close")}</span><strong>{currency.format(forecast.weeklyForecast.predictedClose)}</strong><small>{shortDate(forecast.weeklyForecast.targetDate, language)}</small></div>
        <div className="weekly-forecast__metric"><span>{t("Expected range")}</span><strong>{currency.format(forecast.weeklyForecast.lowerBound)} - {currency.format(forecast.weeklyForecast.upperBound)}</strong><small>{forecast.weeklyForecast.confidence}% {t("confidence")}</small></div>
      </section>

      <article className="panel forecast-panel forecast-panel--daily-chart">
        <div className="panel__header forecast-chart__header">
          <div>
            <p className="panel__eyebrow">{t("Daily forecast tracking")}</p>
            <h2>{t("Forecast vs actual close")}</h2>
          </div>
          <div className="forecast-chart__controls">
            <div className="forecast-chart__range" aria-label={t("Forecast chart range")}>
              {([14, 30, 90, "all"] as const).map((range) => (
                <button key={range} type="button" className={chartRange === range ? "forecast-chart__range-item forecast-chart__range-item--active" : "forecast-chart__range-item"} onClick={() => setChartRange(range)}>{range === "all" ? t("All") : `${range}D`}</button>
              ))}
            </div>
            <div className="forecast-chart__legend" aria-label={t("Chart legend")}>
              <span><i className="forecast-chart__legend-dot forecast-chart__legend-dot--forecast" />{t("Forecast")}</span>
              <span><i className="forecast-chart__legend-dot forecast-chart__legend-dot--actual" />{t("Actual")}</span>
            </div>
          </div>
        </div>
        {errorChart.length < 2 ? (
          <p className="forecast-empty">{t("This chart will grow once two daily forecasts have settled.")}</p>
        ) : (
          <div className="forecast-chart forecast-chart--daily">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={errorChart} margin={{ top: 12, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="#dbe9e8" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} axisLine={false} tickLine={false} width={52} />
                <Tooltip formatter={(value) => currency.format(Number(value))} />
                <Line type="monotone" dataKey="forecast" name={t("Forecast")} stroke="#2a7a71" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="actual" name={t("Actual")} stroke="#c26b49" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>

      <section className="forecast-status-grid">
        <article className="panel forecast-status-card">
          <p className="panel__eyebrow">{t("Data quality")}</p>
          <h2>{forecast.dataQuality.score}%</h2>
          <p>{forecast.dataQuality.missingSources.length ? t("Missing: {sources}. Confidence was reduced.", { sources: forecast.dataQuality.missingSources.join(", ") }) : t("Price, derivatives, and on-chain inputs are available.")}</p>
          <span className="forecast-status-card__tag">{t("Holdout validation: 14 days")}</span>
        </article>
        <article className="panel forecast-status-card">
          <p className="panel__eyebrow">{t("Macro event risk")}</p>
          <h2>{forecast.macroRisk ? t("Cautious") : t("Clear")}</h2>
          <p>{forecast.macroRisk
            ? t("{event} is in {days} day(s). Confidence is reduced and the price range is widened.", { event: forecast.macroRisk.eventName, days: forecast.macroRisk.daysUntil })
            : t("No scheduled CPI, employment, or FOMC event is within the next three days.")}</p>
          <span className="forecast-status-card__tag">{forecast.macroRisk ? forecast.macroRisk.eventDate : t("Normal range")}</span>
        </article>
        <article className="panel forecast-status-card">
          <p className="panel__eyebrow">{t("Market regime")}</p>
          <h2>{t(forecast.marketRegime.label)}</h2>
          <p>{t(forecast.marketRegime.detail)}</p>
          <span className={`forecast-status-card__tag forecast-status-card__tag--${forecast.marketRegime.id}`}>{t("Weights are tuned for this market state")}</span>
        </article>
        <article className="panel forecast-status-card">
          <p className="panel__eyebrow">{t("Multi-timeframe confirmation")}</p>
          <h2>{t(timeframeAlignmentLabel(forecast.multiTimeframe.alignment))}</h2>
          <p>{t(timeframeSignalDetail(forecast.multiTimeframe.alignment))}</p>
          <span className="forecast-status-card__tag">{formatTimeframeTrend(forecast.multiTimeframe.hourlyTrend, "1H")} · {formatTimeframeTrend(forecast.multiTimeframe.fourHourTrend, "4H")} · {formatTimeframeTrend(forecast.multiTimeframe.dailyTrend, "1D")}</span>
        </article>
        <article className="panel forecast-status-card">
          <p className="panel__eyebrow">{t("Direction model")}</p>
          <h2>{t(forecast.directionModel.direction)}</h2>
          <p>{t("Up probability {up}, down probability {down}; the classifier is checked with walk-forward closes.", {
            up: `${(forecast.directionModel.probabilityUp * 100).toFixed(0)}%`,
            down: `${(forecast.directionModel.probabilityDown * 100).toFixed(0)}%`
          })}</p>
          <span className="forecast-status-card__tag">{t("{accuracy}% directional accuracy across {days} days", {
            accuracy: forecast.directionModel.directionalAccuracy.toFixed(0),
            days: forecast.directionModel.evaluatedDays
          })}</span>
        </article>
        <article className="panel forecast-status-card">
          <p className="panel__eyebrow">{t("Volatility model")}</p>
          <h2>±{forecast.volatilityModel.expectedDailyMovePercent.toFixed(1)}%</h2>
          <p>{t("Expected daily movement blends recent 7D, 21D, and 60D realized volatility before setting the forecast range.")}</p>
          <span className="forecast-status-card__tag">{t("{outlook} outlook", { outlook: t(volatilityOutlookLabel(forecast.volatilityModel.outlook)) })}</span>
        </article>
        <article className="panel forecast-status-card">
          <p className="panel__eyebrow">{t("Range calibration")}</p>
          <h2>{forecast.rangeCalibration.observedCoverage === null ? t("Learning") : `${(forecast.rangeCalibration.observedCoverage * 100).toFixed(0)}% ${t("coverage")}`}</h2>
          <p>{forecast.rangeCalibration.observedCoverage === null
            ? t("Calibration begins after 8 settled forecasts.")
            : t("Target is {target}; the next range is adjusted by {adjustment}.", {
              target: `${(forecast.rangeCalibration.targetCoverage * 100).toFixed(0)}%`,
              adjustment: `${(forecast.rangeCalibration.multiplier * 100).toFixed(0)}%`
            })}</p>
          <span className="forecast-status-card__tag">{t("{count} settled forecasts", { count: forecast.rangeCalibration.settledCount })}</span>
        </article>
        <article className="panel forecast-status-card">
          <p className="panel__eyebrow">{t("Derivatives positioning")}</p>
          <h2>{forecast.derivatives ? `${(forecast.derivatives.fundingRate * 100).toFixed(3)}%` : t("Unavailable")}</h2>
          <p>{forecast.derivatives
            ? forecast.derivatives.openInterestChange7Day === null
              ? t("Funding rate is available; open-interest history is still building.")
              : t("Open interest changed {change} over 7 days.", { change: `${(forecast.derivatives.openInterestChange7Day * 100).toFixed(1)}%` })
            : t("Funding rate and open interest are temporarily unavailable. The price-only ensemble remains active.")}</p>
          <span className="forecast-status-card__tag">{forecast.derivatives ? `${t("Open interest")}: ${formatBillions(forecast.derivatives.openInterestValue)}` : t("No derivatives weight")}</span>
        </article>
        <article className="panel forecast-status-card">
          <p className="panel__eyebrow">{t("Order book & trade flow")}</p>
          <h2>{forecast.microstructure ? `${(forecast.microstructure.orderBookImbalance * 100).toFixed(1)}%` : t("Unavailable")}</h2>
          <p>{!forecast.microstructure
            ? t("Coinbase market depth is temporarily unavailable, so this signal has no weight.")
            : forecast.microstructureSamples < 12
              ? t("Collecting hourly snapshots: {count}/12. The signal stays inactive until it has enough context.", { count: forecast.microstructureSamples })
              : t("Depth and recent trade pressure are compared with the latest 24 hourly snapshots.")}</p>
          <span className="forecast-status-card__tag">{forecast.microstructure ? `${t("Spread")}: ${(forecast.microstructure.spreadPercent * 100).toFixed(3)}%` : t("Collecting data")}</span>
        </article>
        <article className="panel forecast-status-card">
          <p className="panel__eyebrow">{t("Forecast edge gate")}</p>
          <h2>{forecast.benchmark.hasEdge ? t("Edge established") : t("No edge established")}</h2>
          <p>{t("Ensemble error {ensemble} vs best baseline {baseline} across {days} walk-forward days.", {
            ensemble: `${forecast.benchmark.ensemble.meanAbsolutePercentError.toFixed(2)}%`,
            baseline: `${Math.min(forecast.benchmark.naive.meanAbsolutePercentError, forecast.benchmark.trend.meanAbsolutePercentError).toFixed(2)}%`,
            days: forecast.benchmark.ensemble.evaluatedDays
          })}</p>
          <span className="forecast-status-card__tag">{forecast.benchmark.hasEdge ? t("Full confidence allowed") : t("Confidence reduced until proven")}</span>
        </article>
      </section>

      <article className="panel forecast-panel">
        <div className="panel__header"><div><p className="panel__eyebrow">{t("Confidence calibration")}</p><h2>{t("Does confidence match outcomes?")}</h2></div></div>
        <div className="model-leaderboard" role="table">
          <div className="model-leaderboard__header"><span>{t("Confidence band")}</span><span>{t("Average confidence")}</span><span>{t("Range hit rate")}</span><span>{t("Settled forecasts")}</span></div>
          {forecast.confidenceCalibration.map((band) => <div className="model-leaderboard__row" role="row" key={band.label}><strong>{band.label}</strong><span>{band.settledCount ? `${band.averageConfidence.toFixed(0)}%` : "-"}</span><span>{band.rangeHitRate === null ? "-" : `${(band.rangeHitRate * 100).toFixed(0)}%`}</span><span>{band.settledCount}</span></div>)}
        </div>
      </article>

      <article className="panel forecast-panel">
        <div className="panel__header">
          <div>
            <p className="panel__eyebrow">{t("Feature ablation")}</p>
            <h2>{t("Evidence-based signal selection")}</h2>
            <p className="forecast-panel__copy">{t("Each row removes one input in a time-ordered backtest. A paused input is automatically excluded until future evidence supports it again.")}</p>
          </div>
        </div>
        <div className="feature-ablation" role="table" aria-label={t("Feature ablation")}>
          <div className="feature-ablation__header" role="row">
            <span role="columnheader">{t("Signal")}</span>
            <span role="columnheader">{t("Status")}</span>
            <span role="columnheader">{t("Average error")}</span>
            <span role="columnheader">{t("Removed impact")}</span>
            <span role="columnheader">{t("Test days")}</span>
          </div>
          {forecast.featureAblation.map((feature) => (
            <div className="feature-ablation__row" role="row" key={feature.id}>
              <strong role="cell">{t(feature.label)}</strong>
              <span role="cell" className={`feature-ablation__status feature-ablation__status--${feature.status}`}>{t(ablationStatus(feature.status))}</span>
              <span role="cell">{feature.meanAbsolutePercentError.toFixed(2)}%</span>
              <span role="cell" className={feature.errorDelta > 0.04 ? "forecast-journal__negative" : feature.errorDelta < -0.04 ? "forecast-journal__positive" : ""}>{formatErrorDelta(feature.errorDelta)}</span>
              <span role="cell">{feature.evaluatedDays}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="panel forecast-panel">
        <div className="panel__header">
          <div>
            <p className="panel__eyebrow">{t("Daily forecast journal")}</p>
            <h2>{t("Daily decision record")}</h2>
            <p className="forecast-panel__copy">{t("Each entry preserves the forecast state that was known before that daily close." )}</p>
          </div>
        </div>
        <div className="forecast-journal" role="table" aria-label={t("Daily forecast journal")}>
          <div className="forecast-journal__header" role="row">
            <span role="columnheader">{t("Date")}</span>
            <span role="columnheader">{t("Market regime")}</span>
            <span role="columnheader">{t("Forecast")}</span>
            <span role="columnheader">{t("Expected return")}</span>
            <span role="columnheader">{t("Actual")}</span>
          </div>
          {journalRecords.map((record) => (
            <div className="forecast-journal__row" role="row" key={`${record.horizon ?? "daily"}-${record.targetDate}`}>
              <strong role="cell">{shortDate(record.targetDate, language)}</strong>
              <span role="cell">{record.marketRegime ? t(regimeLabel(record.marketRegime)) : "-"}</span>
              <span role="cell">{currency.format(record.predictedClose)}<small>{formatWeights(record, t)}</small></span>
              <span role="cell" className={record.expectedReturnPercent && record.expectedReturnPercent < 0 ? "forecast-journal__negative" : "forecast-journal__positive"}>{formatExpectedReturn(record)}</span>
              <span role="cell">{record.actualClose === undefined ? t("Awaiting close") : currency.format(record.actualClose)}</span>
            </div>
          ))}
        </div>
      </article>

      <section className="forecast-layout">
        <article className="panel forecast-panel">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">{t("What is influencing today's estimate")}</p>
              <h2>{t("Active signals")}</h2>
            </div>
          </div>
          <div className="signal-list">
            {forecast.signals.map((signal) => (
              <article className="signal-row" key={signal.label}>
                <span className={`signal-row__dot signal-row__dot--${signal.direction}`} />
                <div>
                  <strong>{t(signal.label)}</strong>
                  <p>{t(signal.detail)}</p>
                </div>
                <b className={`signal-row__value signal-row__value--${signal.direction}`}>{signal.value}</b>
              </article>
            ))}
          </div>
        </article>

        <article className="panel forecast-panel forecast-panel--accuracy">
          <p className="panel__eyebrow">{t("Self-correction record")}</p>
          <h2>{t("Forecast accuracy")}</h2>
          {forecast.accuracy.settledCount === 0 ? (
            <p className="forecast-empty">{t("The first forecast is now saved. Once the next daily close arrives, this model will begin measuring and correcting its error.")}</p>
          ) : (
            <div className="accuracy-stats">
              <div><span>{t("Settled forecasts")}</span><strong>{forecast.accuracy.settledCount}</strong></div>
              <div><span>{t("Average error")}</span><strong>{forecast.accuracy.meanAbsolutePercentError!.toFixed(2)}%</strong></div>
              <div><span>{t("Direction accuracy")}</span><strong>{forecast.accuracy.directionalAccuracy!.toFixed(0)}%</strong></div>
            </div>
          )}
        </article>
      </section>

      <article className="panel forecast-panel">
        <div className="panel__header">
          <div>
            <p className="panel__eyebrow">{t("Walk-forward testing")}</p>
            <h2>{t("Model leaderboard")}</h2>
            <p className="forecast-panel__copy">{t("Recent 60-day forecasts are evaluated without using future closes. Lower error receives more ensemble weight.")}</p>
          </div>
        </div>
        <div className="model-leaderboard" role="table" aria-label={t("Model leaderboard")}>
          <div className="model-leaderboard__header" role="row">
            <span role="columnheader">{t("Model")}</span>
            <span role="columnheader">{t("Weight")}</span>
            <span role="columnheader">{t("Average error")}</span>
            <span role="columnheader">{t("Direction accuracy")}</span>
            <span role="columnheader">{t("Test days")}</span>
          </div>
          {forecast.modelLeaderboard.map((model) => (
            <div className="model-leaderboard__row" role="row" key={model.id}>
              <strong role="cell">{t(model.label)}<small className={`model-leaderboard__status model-leaderboard__status--${model.status}`}>{t(model.status)}</small></strong>
              <span role="cell"><b>{(model.weight * 100).toFixed(0)}%</b></span>
              <span role="cell">{model.meanAbsolutePercentError.toFixed(2)}%</span>
              <span role="cell">{model.directionalAccuracy.toFixed(0)}%</span>
              <span role="cell">{model.evaluatedDays}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="forecast-disclaimer">
        {t("This is an educational probabilistic forecast, not financial advice. Crypto prices are volatile and the model can be wrong.")}
      </article>
    </section>
  );
}

function ForecastMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="forecast-metric"><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}

function shortDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language === "zh-TW" ? "zh-TW" : "en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function regimeLabel(regime: "uptrend" | "downtrend" | "range" | "volatile") {
  return { uptrend: "Uptrend", downtrend: "Downtrend", range: "Range-bound", volatile: "High volatility" }[regime];
}

function formatExpectedReturn(record: { expectedReturnPercent?: number; predictedClose: number; baseClose: number }) {
  const value = record.expectedReturnPercent ?? ((record.predictedClose / record.baseClose) - 1) * 100;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatWeights(record: { modelWeights?: Partial<Record<"technical" | "trend" | "meanReversion", number>> }, t: (key: string) => string) {
  if (!record.modelWeights) return null;
  const names = { technical: "Technical signals", trend: "Trend follow", meanReversion: "Mean reversion" };
  return Object.entries(record.modelWeights)
    .sort(([, left], [, right]) => (right ?? 0) - (left ?? 0))
    .map(([id, weight]) => `${t(names[id as keyof typeof names])} ${(weight! * 100).toFixed(0)}%`)
    .join(" · ");
}

function formatBillions(value: number) {
  return `$${(value / 1_000_000_000).toFixed(1)}B`;
}

function formatErrorDelta(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)} pp`;
}

function ablationStatus(status: "helpful" | "neutral" | "paused" | "learning") {
  return { helpful: "Helpful", neutral: "Neutral", paused: "Paused", learning: "Learning" }[status];
}

function decisionLabel(status: "trade" | "watch" | "noEdge") {
  return { trade: "Trade", watch: "Watch", noEdge: "No edge" }[status];
}

function timeframeAlignmentLabel(alignment: "bullish" | "bearish" | "neutral" | "mixed" | "unavailable") {
  return { bullish: "Aligned bullish", bearish: "Aligned bearish", neutral: "Neutral", mixed: "Mixed", unavailable: "Unavailable" }[alignment];
}

function volatilityOutlookLabel(outlook: "calm" | "normal" | "elevated") {
  return { calm: "Calm", normal: "Normal", elevated: "Elevated" }[outlook];
}

function timeframeSignalDetail(alignment: "bullish" | "bearish" | "neutral" | "mixed" | "unavailable") {
  return {
    bullish: "1H, 4H, and daily trends are confirming the same upside direction.",
    bearish: "1H, 4H, and daily trends are confirming the same downside direction.",
    neutral: "Short and long timeframes are close to flat.",
    mixed: "Timeframes disagree, so the short-term contribution is reduced.",
    unavailable: "Intraday candles are unavailable, so the daily model remains conservative."
  }[alignment];
}

function formatTimeframeTrend(value: number | null, label: string) {
  return value === null ? `${label} -` : `${label} ${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}
