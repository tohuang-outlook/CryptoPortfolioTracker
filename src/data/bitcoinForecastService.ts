import type {
  BitcoinCandle,
  BitcoinForecast,
  ForecastRecord,
  ForecastSignal
} from "../types/forecast";

const COINBASE_BTC_CANDLES_URL =
  "https://api.exchange.coinbase.com/products/BTC-USD/candles";
const FORECAST_STORAGE_KEY = "crypto-portfolio-tracker-btc-forecast-records-v1";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type CoinbaseCandle = [number, number, number, number, number, number];

export async function fetchBitcoinForecast(): Promise<BitcoinForecast> {
  const candles = await fetchBitcoinDailyCandles();
  const records = reconcileForecastRecords(candles);
  const forecast = buildForecast(candles, records);
  const nextRecords = upsertForecastRecord(records, forecast);

  saveForecastRecords(nextRecords);

  return {
    ...forecast,
    records: nextRecords,
    accuracy: calculateAccuracy(nextRecords)
  };
}

async function fetchBitcoinDailyCandles(): Promise<BitcoinCandle[]> {
  const end = new Date();
  const start = new Date(end.getTime() - 120 * DAY_IN_MS);
  const url = new URL(COINBASE_BTC_CANDLES_URL);
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("end", end.toISOString());
  url.searchParams.set("granularity", "86400");

  const response = await fetch(url, {
    headers: { "Cache-Control": "no-cache" }
  });

  if (!response.ok) {
    throw new Error("Unable to fetch Bitcoin daily candles");
  }

  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload)) {
    throw new Error("Malformed Bitcoin candle payload");
  }

  const now = Date.now();
  const candles = payload
    .map(readCoinbaseCandle)
    .filter((candle): candle is BitcoinCandle => candle !== null)
    // The current UTC candle is still changing, so it is not a daily close.
    .filter((candle) => candle.timestamp + DAY_IN_MS <= now)
    .sort((left, right) => left.timestamp - right.timestamp);

  if (candles.length < 35) {
    throw new Error("Not enough Bitcoin history to calculate a forecast");
  }

  return candles;
}

function readCoinbaseCandle(value: unknown): BitcoinCandle | null {
  if (!Array.isArray(value) || value.length < 6) {
    return null;
  }

  const [timestamp, low, high, open, close, volume] = value as CoinbaseCandle;
  const values = [timestamp, low, high, open, close, volume];

  if (!values.every((item) => typeof item === "number" && Number.isFinite(item))) {
    return null;
  }

  return {
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    timestamp: timestamp * 1000,
    low,
    high,
    open,
    close,
    volume
  };
}

function buildForecast(
  candles: BitcoinCandle[],
  records: ForecastRecord[]
): Omit<BitcoinForecast, "records" | "accuracy"> {
  const closes = candles.map((candle) => candle.close);
  const currentClose = closes[closes.length - 1];
  const sma7 = average(closes.slice(-7));
  const sma30 = average(closes.slice(-30));
  const rsi14 = calculateRsi(closes.slice(-15));
  const ema12 = calculateEma(closes, 12);
  const ema26 = calculateEma(closes, 26);
  const macdPercent = (ema12 - ema26) / currentClose;
  const trendPercent = sma7 / sma30 - 1;
  const volatility = calculateVolatility(closes.slice(-15));
  const correction = calculateBiasCorrection(records);
  const expectedReturn = clamp(
    trendPercent * 0.7 + macdPercent * 0.55 - ((rsi14 - 50) / 100) * 0.012 + correction,
    -0.12,
    0.12
  );
  const predictedClose = currentClose * (1 + expectedReturn);
  const rangePercent = clamp(volatility * 1.6, 0.025, 0.12);
  const confidence = Math.round(
    clamp(72 - volatility * 450 - Math.abs(rsi14 - 50) * 0.28, 38, 78)
  );
  const latestCandle = candles[candles.length - 1];
  const asOfDate = latestCandle.date;
  const targetDate = new Date(
    latestCandle.timestamp + DAY_IN_MS
  ).toISOString().slice(0, 10);
  const direction = expectedReturn > 0.003 ? "Bullish" : expectedReturn < -0.003 ? "Bearish" : "Neutral";

  const signals: ForecastSignal[] = [
    {
      label: "7D vs 30D trend",
      value: formatSignedPercent(trendPercent),
      direction: trendPercent > 0.003 ? "positive" : trendPercent < -0.003 ? "negative" : "neutral",
      detail: sma7 > sma30 ? "Short-term price is above its 30-day trend." : "Short-term price is below its 30-day trend."
    },
    {
      label: "RSI (14 days)",
      value: rsi14.toFixed(1),
      direction: rsi14 < 40 ? "positive" : rsi14 > 60 ? "negative" : "neutral",
      detail: rsi14 < 40 ? "Lower RSI supports a possible rebound." : rsi14 > 60 ? "Higher RSI adds pullback risk." : "RSI is in a balanced range."
    },
    {
      label: "MACD momentum",
      value: formatSignedPercent(macdPercent),
      direction: macdPercent > 0 ? "positive" : "negative",
      detail: macdPercent > 0 ? "Momentum remains above its longer baseline." : "Momentum remains below its longer baseline."
    },
    {
      label: "Model correction",
      value: formatSignedPercent(correction),
      direction: correction > 0.001 ? "positive" : correction < -0.001 ? "negative" : "neutral",
      detail: records.some((record) => record.actualClose !== undefined)
        ? "Adjusted using the model's settled forecast errors."
        : "Waiting for settled forecasts before applying an error correction."
    }
  ];

  return {
    asOfDate,
    currentClose,
    targetDate,
    predictedClose,
    lowerBound: predictedClose * (1 - rangePercent),
    upperBound: predictedClose * (1 + rangePercent),
    confidence,
    expectedReturnPercent: expectedReturn * 100,
    direction,
    signals
  };
}

function reconcileForecastRecords(candles: BitcoinCandle[]): ForecastRecord[] {
  const closeByDate = new Map(candles.map((candle) => [candle.date, candle.close]));

  return readForecastRecords().map((record) => ({
    ...record,
    actualClose: closeByDate.get(record.targetDate) ?? record.actualClose
  }));
}

function upsertForecastRecord(
  records: ForecastRecord[],
  forecast: Omit<BitcoinForecast, "records" | "accuracy">
): ForecastRecord[] {
  const record: ForecastRecord = {
    targetDate: forecast.targetDate,
    createdAt: new Date().toISOString(),
    baseClose: forecast.currentClose,
    predictedClose: forecast.predictedClose,
    lowerBound: forecast.lowerBound,
    upperBound: forecast.upperBound,
    confidence: forecast.confidence
  };
  const existingIndex = records.findIndex((item) => item.targetDate === record.targetDate);
  const nextRecords = [...records];

  if (existingIndex === -1) {
    nextRecords.push(record);
  } else if (nextRecords[existingIndex].actualClose === undefined) {
    nextRecords[existingIndex] = record;
  }

  return nextRecords.slice(-90);
}

function readForecastRecords(): ForecastRecord[] {
  try {
    const rawValue = window.localStorage.getItem(FORECAST_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isForecastRecord) : [];
  } catch {
    return [];
  }
}

function saveForecastRecords(records: ForecastRecord[]) {
  window.localStorage.setItem(FORECAST_STORAGE_KEY, JSON.stringify(records));
}

function isForecastRecord(value: unknown): value is ForecastRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<ForecastRecord>;
  return typeof record.targetDate === "string" && typeof record.predictedClose === "number" && typeof record.baseClose === "number";
}

function calculateBiasCorrection(records: ForecastRecord[]) {
  const settled = records.filter((record) => record.actualClose !== undefined).slice(-14);
  if (settled.length === 0) {
    return 0;
  }

  const averageRelativeError = average(
    settled.map((record) => (record.actualClose! - record.predictedClose) / record.predictedClose)
  );
  return clamp(averageRelativeError * 0.35, -0.025, 0.025);
}

function calculateAccuracy(records: ForecastRecord[]): BitcoinForecast["accuracy"] {
  const settled = records.filter((record) => record.actualClose !== undefined);
  if (settled.length === 0) {
    return { settledCount: 0, meanAbsolutePercentError: null, directionalAccuracy: null };
  }

  const absoluteErrors = settled.map(
    (record) => Math.abs(record.actualClose! - record.predictedClose) / record.actualClose!
  );
  const correctDirections = settled.filter((record) =>
    Math.sign(record.predictedClose - record.baseClose) === Math.sign(record.actualClose! - record.baseClose)
  ).length;

  return {
    settledCount: settled.length,
    meanAbsolutePercentError: average(absoluteErrors) * 100,
    directionalAccuracy: (correctDirections / settled.length) * 100
  };
}

function calculateRsi(closes: number[]) {
  const changes = closes.slice(1).map((close, index) => close - closes[index]);
  const gains = changes.map((change) => Math.max(change, 0));
  const losses = changes.map((change) => Math.max(-change, 0));
  const averageGain = average(gains);
  const averageLoss = average(losses);

  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function calculateEma(values: number[], period: number) {
  const multiplier = 2 / (period + 1);
  return values.reduce((ema, value) => value * multiplier + ema * (1 - multiplier), values[0]);
}

function calculateVolatility(closes: number[]) {
  const returns = closes.slice(1).map((close, index) => close / closes[index] - 1);
  const mean = average(returns);
  return Math.sqrt(average(returns.map((value) => (value - mean) ** 2)));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}
