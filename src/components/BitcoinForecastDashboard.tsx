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

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

export function BitcoinForecastDashboard() {
  const { forecast, status, error } = useBitcoinForecast();

  if (status === "loading" && !forecast) {
    return <section className="forecast-loading panel">Preparing the Bitcoin forecast from daily market data...</section>;
  }

  if (status === "error" || !forecast) {
    return <section className="forecast-loading panel forecast-loading--error">{error}</section>;
  }

  const forecastDirectionClass = forecast.direction.toLowerCase();
  const settledRecords = forecast.records.filter((record) => record.actualClose !== undefined).slice(-14);
  const errorChart = settledRecords.map((record) => ({
    date: shortDate(record.targetDate),
    forecast: Math.round(record.predictedClose),
    actual: Math.round(record.actualClose!)
  }));

  return (
    <section className="forecast-dashboard">
      <header className="forecast-hero panel">
        <div>
          <p className="panel__eyebrow">Adaptive daily forecast</p>
          <h2>Bitcoin Forecast</h2>
          <p className="forecast-hero__copy">
            A transparent next-day estimate based on BTC daily trend, momentum, volatility, and prior forecast error.
          </p>
        </div>
        <div className={`forecast-bias forecast-bias--${forecastDirectionClass}`}>
          <span>24h bias</span>
          <strong>{forecast.direction}</strong>
          <small>{forecast.expectedReturnPercent >= 0 ? "+" : ""}{forecast.expectedReturnPercent.toFixed(2)}%</small>
        </div>
      </header>

      <section className="forecast-summary-grid">
        <ForecastMetric label="BTC daily close" value={currency.format(forecast.currentClose)} detail={`Closed ${shortDate(forecast.asOfDate)}`} />
        <ForecastMetric label="Next daily close" value={currency.format(forecast.predictedClose)} detail={shortDate(forecast.targetDate)} />
        <ForecastMetric label="Expected range" value={`${currency.format(forecast.lowerBound)} - ${currency.format(forecast.upperBound)}`} detail="Volatility-adjusted" />
        <ForecastMetric label="Confidence" value={`${forecast.confidence}%`} detail="Model confidence, not certainty" />
      </section>

      <section className="forecast-layout">
        <article className="panel forecast-panel">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">What is influencing today&apos;s estimate</p>
              <h2>Active signals</h2>
            </div>
          </div>
          <div className="signal-list">
            {forecast.signals.map((signal) => (
              <article className="signal-row" key={signal.label}>
                <span className={`signal-row__dot signal-row__dot--${signal.direction}`} />
                <div>
                  <strong>{signal.label}</strong>
                  <p>{signal.detail}</p>
                </div>
                <b className={`signal-row__value signal-row__value--${signal.direction}`}>{signal.value}</b>
              </article>
            ))}
          </div>
        </article>

        <article className="panel forecast-panel forecast-panel--accuracy">
          <p className="panel__eyebrow">Self-correction record</p>
          <h2>Forecast accuracy</h2>
          {forecast.accuracy.settledCount === 0 ? (
            <p className="forecast-empty">The first forecast is now saved. Once the next daily close arrives, this model will begin measuring and correcting its error.</p>
          ) : (
            <div className="accuracy-stats">
              <div><span>Settled forecasts</span><strong>{forecast.accuracy.settledCount}</strong></div>
              <div><span>Average error</span><strong>{forecast.accuracy.meanAbsolutePercentError!.toFixed(2)}%</strong></div>
              <div><span>Direction accuracy</span><strong>{forecast.accuracy.directionalAccuracy!.toFixed(0)}%</strong></div>
            </div>
          )}
        </article>
      </section>

      <article className="panel forecast-panel forecast-panel--wide">
        <div className="panel__header">
          <div>
            <p className="panel__eyebrow">Forecast calibration</p>
            <h2>Forecast vs actual close</h2>
          </div>
        </div>
        {errorChart.length < 2 ? (
          <p className="forecast-empty">This chart will grow once two daily forecasts have settled.</p>
        ) : (
          <div className="forecast-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={errorChart} margin={{ top: 12, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="#dbe9e8" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} axisLine={false} tickLine={false} width={52} />
                <Tooltip formatter={(value) => currency.format(Number(value))} />
                <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#2a7a71" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="actual" name="Actual" stroke="#c26b49" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>

      <article className="forecast-disclaimer">
        This is an educational probabilistic forecast, not financial advice. Crypto prices are volatile and the model can be wrong.
      </article>
    </section>
  );
}

function ForecastMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="forecast-metric"><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
