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

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

export function BitcoinForecastDashboard() {
  const { forecast, status, error } = useBitcoinForecast();
  const { language, t } = useTranslation();

  if (status === "loading" && !forecast) {
    return <section className="forecast-loading panel">{t("Preparing the Bitcoin forecast from daily market data...")}</section>;
  }

  if (status === "error" || !forecast) {
    return <section className="forecast-loading panel forecast-loading--error">{t(error ?? "Coinbase daily market data is unavailable right now. Please try again shortly.")}</section>;
  }

  const forecastDirectionClass = forecast.direction.toLowerCase();
  const settledRecords = forecast.records.filter((record) => record.actualClose !== undefined).slice(-14);
  const errorChart = settledRecords.map((record) => ({
    date: shortDate(record.targetDate, language),
    forecast: Math.round(record.predictedClose),
    actual: Math.round(record.actualClose!)
  }));

  return (
    <section className="forecast-dashboard">
      <header className="forecast-hero panel">
        <div>
          <p className="panel__eyebrow">{t("Adaptive daily forecast")}</p>
          <h2>{t("Bitcoin Forecast")}</h2>
          <p className="forecast-hero__copy">
            {t("A transparent next-day estimate based on BTC daily trend, momentum, volatility, and prior forecast error.")}
          </p>
        </div>
        <div className={`forecast-bias forecast-bias--${forecastDirectionClass}`}>
          <span>{t("24h bias")}</span>
          <strong>{t(forecast.direction)}</strong>
          <small>{forecast.expectedReturnPercent >= 0 ? "+" : ""}{forecast.expectedReturnPercent.toFixed(2)}%</small>
        </div>
      </header>

      <section className="forecast-summary-grid">
        <ForecastMetric label={t("BTC daily close")} value={currency.format(forecast.currentClose)} detail={`${t("Closed")} ${shortDate(forecast.asOfDate, language)}`} />
        <ForecastMetric label={t("Next daily close")} value={currency.format(forecast.predictedClose)} detail={shortDate(forecast.targetDate, language)} />
        <ForecastMetric label={t("Expected range")} value={`${currency.format(forecast.lowerBound)} - ${currency.format(forecast.upperBound)}`} detail={t("Volatility-adjusted")} />
        <ForecastMetric label={t("Confidence")} value={`${forecast.confidence}%`} detail={t("Model confidence, not certainty")} />
      </section>

      <section className="weekly-forecast panel">
        <div>
          <p className="panel__eyebrow">{t("7-day forecast")}</p>
          <h2>{t("Expected BTC close in one week")}</h2>
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

      <section className="forecast-status-grid">
        <article className="panel forecast-status-card">
          <p className="panel__eyebrow">{t("Market regime")}</p>
          <h2>{t(forecast.marketRegime.label)}</h2>
          <p>{t(forecast.marketRegime.detail)}</p>
          <span className={`forecast-status-card__tag forecast-status-card__tag--${forecast.marketRegime.id}`}>{t("Weights are tuned for this market state")}</span>
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
      </section>

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
              <strong role="cell">{t(model.label)}</strong>
              <span role="cell"><b>{(model.weight * 100).toFixed(0)}%</b></span>
              <span role="cell">{model.meanAbsolutePercentError.toFixed(2)}%</span>
              <span role="cell">{model.directionalAccuracy.toFixed(0)}%</span>
              <span role="cell">{model.evaluatedDays}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="panel forecast-panel forecast-panel--wide">
        <div className="panel__header">
          <div>
            <p className="panel__eyebrow">{t("Forecast calibration")}</p>
            <h2>{t("Forecast vs actual close")}</h2>
          </div>
        </div>
        {errorChart.length < 2 ? (
          <p className="forecast-empty">{t("This chart will grow once two daily forecasts have settled.")}</p>
        ) : (
          <div className="forecast-chart">
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
