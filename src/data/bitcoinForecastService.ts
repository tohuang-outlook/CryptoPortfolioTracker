import type {
  BitcoinCandle,
  BitcoinForecast,
  ForecastHorizon,
  ForecastRecord,
  ForecastSignal
} from "../types/forecast";
import {
  average,
  buildDailyEnsemble,
  calculateRangeCalibration,
  calculateEma,
  calculateRsi,
  calculateVolatility,
  clamp
} from "./forecastModels";

const COINBASE_BTC_CANDLES_URL =
  "https://api.exchange.coinbase.com/products/BTC-USD/candles";
const FORECAST_STORAGE_KEY = "crypto-portfolio-tracker-btc-forecast-records-v1";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type CoinbaseCandle = [number, number, number, number, number, number];

export async function fetchBitcoinForecast(): Promise<BitcoinForecast> {
  const candles = await fetchBitcoinDailyCandles();
  const records = reconcileForecastRecords(await readForecastRecords(), candles);
  const forecast = buildForecast(candles, records);
  const nextRecords = upsertForecastRecords(records, forecast);

  await saveForecastRecords(nextRecords);

  return {
    ...forecast,
    records: nextRecords,
    accuracy: calculateAccuracy(nextRecords, "daily"),
    weeklyAccuracy: calculateAccuracy(nextRecords, "weekly")
  };
}

async function fetchBitcoinDailyCandles(): Promise<BitcoinCandle[]> {
  const end = new Date();
  const start = new Date(end.getTime() - 120 * DAY_IN_MS);
  const url = new URL(COINBASE_BTC_CANDLES_URL);
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("end", end.toISOString());
  url.searchParams.set("granularity", "86400");

  // Keep this request simple so Coinbase's public CORS policy accepts it in Electron.
  const response = await fetch(url);

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
): Omit<BitcoinForecast, "records" | "accuracy" | "weeklyAccuracy"> {
  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const currentClose = closes[closes.length - 1];
  const sma7 = average(closes.slice(-7));
  const sma30 = average(closes.slice(-30));
  const rsi14 = calculateRsi(closes.slice(-15));
  const ema12 = calculateEma(closes, 12);
  const ema26 = calculateEma(closes, 26);
  const macdPercent = (ema12 - ema26) / currentClose;
  const trendPercent = sma7 / sma30 - 1;
  const volatility = calculateVolatility(closes.slice(-15));
  const latestDailyReturn = currentClose / closes[closes.length - 2] - 1;
  const volumeRatio = volumes[volumes.length - 1] / average(volumes.slice(-21, -1));
  const volumeConfirmation = calculateVolumeConfirmation(
    latestDailyReturn,
    volumeRatio
  );
  const ensemble = buildDailyEnsemble(candles);
  const rangeCalibration = calculateRangeCalibration(records, "daily");
  const correction = calculateBiasCorrection(records, "daily");
  const expectedReturn = clamp(
    ensemble.expectedReturn + correction,
    -0.12,
    0.12
  );
  const predictedClose = currentClose * (1 + expectedReturn);
  const rangePercent = clamp(volatility * 1.6 * rangeCalibration.multiplier, 0.025, 0.16);
  const calibrationPenalty = rangeCalibration.observedCoverage === null
    ? 0
    : Math.abs(rangeCalibration.observedCoverage - rangeCalibration.targetCoverage) * 30;
  const confidence = Math.round(
    clamp(
      72 -
        volatility * 450 -
        Math.abs(rsi14 - 50) * 0.28 +
        calculateVolumeConfidenceAdjustment(latestDailyReturn, volumeRatio) -
        calibrationPenalty,
      38,
      78
    )
  );
  const latestCandle = candles[candles.length - 1];
  const asOfDate = latestCandle.date;
  const targetDate = new Date(
    latestCandle.timestamp + DAY_IN_MS
  ).toISOString().slice(0, 10);
  const direction = expectedReturn > 0.003 ? "Bullish" : expectedReturn < -0.003 ? "Bearish" : "Neutral";
  const weeklyForecast = buildWeeklyForecast({
    latestCandle,
    trendPercent,
    macdPercent,
    rsi14,
    volumeConfirmation,
    volatility,
    records
  });

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
      label: "Volume confirmation",
      value: `${volumeRatio.toFixed(2)}x 20D avg`,
      direction: getVolumeDirection(latestDailyReturn, volumeRatio),
      detail: getVolumeDetail(latestDailyReturn, volumeRatio)
    },
    {
      label: "Market regime",
      value: ensemble.marketRegime.label,
      direction: ensemble.marketRegime.id === "uptrend" ? "positive" : ensemble.marketRegime.id === "downtrend" ? "negative" : "neutral",
      detail: ensemble.marketRegime.detail
    },
    {
      label: "Ensemble model",
      value: `${ensemble.leaderboard.length} models`,
      direction: "neutral",
      detail: "Weights adapt to each model's recent walk-forward accuracy."
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
    weeklyForecast,
    signals,
    modelLeaderboard: ensemble.leaderboard,
    marketRegime: ensemble.marketRegime,
    rangeCalibration
  };
}

function reconcileForecastRecords(
  records: ForecastRecord[],
  candles: BitcoinCandle[]
): ForecastRecord[] {
  const closeByDate = new Map(candles.map((candle) => [candle.date, candle.close]));

  return records.map((record) => ({
    ...record,
    actualClose: closeByDate.get(record.targetDate) ?? record.actualClose
  }));
}

function upsertForecastRecords(
  records: ForecastRecord[],
  forecast: Omit<BitcoinForecast, "records" | "accuracy" | "weeklyAccuracy">
): ForecastRecord[] {
  const dailyRecord: ForecastRecord = {
    horizon: "daily",
    targetDate: forecast.targetDate,
    createdAt: new Date().toISOString(),
    baseClose: forecast.currentClose,
    predictedClose: forecast.predictedClose,
    lowerBound: forecast.lowerBound,
    upperBound: forecast.upperBound,
    confidence: forecast.confidence
  };
  const weeklyRecord: ForecastRecord = {
    horizon: "weekly",
    targetDate: forecast.weeklyForecast.targetDate,
    createdAt: new Date().toISOString(),
    baseClose: forecast.currentClose,
    predictedClose: forecast.weeklyForecast.predictedClose,
    lowerBound: forecast.weeklyForecast.lowerBound,
    upperBound: forecast.weeklyForecast.upperBound,
    confidence: forecast.weeklyForecast.confidence
  };

  return upsertForecastRecord(upsertForecastRecord(records, dailyRecord), weeklyRecord).slice(-180);
}

function upsertForecastRecord(records: ForecastRecord[], record: ForecastRecord) {
  const existingIndex = records.findIndex(
    (item) => item.targetDate === record.targetDate && getRecordHorizon(item) === record.horizon
  );
  const nextRecords = [...records];

  if (existingIndex === -1) {
    nextRecords.push(record);
  } else if (nextRecords[existingIndex].actualClose === undefined) {
    nextRecords[existingIndex] = record;
  }

  return nextRecords;
}

async function readForecastRecords(): Promise<ForecastRecord[]> {
  try {
    const rawValue = window.desktopApp
      ? await window.desktopApp.forecastStorage.load()
      : window.localStorage.getItem(FORECAST_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isForecastRecord) : [];
  } catch {
    return [];
  }
}

async function saveForecastRecords(records: ForecastRecord[]) {
  const value = JSON.stringify(records);

  if (window.desktopApp) {
    await window.desktopApp.forecastStorage.save(value);
    return;
  }

  window.localStorage.setItem(FORECAST_STORAGE_KEY, value);
}

function isForecastRecord(value: unknown): value is ForecastRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<ForecastRecord>;
  return typeof record.targetDate === "string" && typeof record.predictedClose === "number" && typeof record.baseClose === "number";
}

function calculateBiasCorrection(records: ForecastRecord[], horizon: "daily" | "weekly") {
  const settled = records
    .filter((record) => record.actualClose !== undefined && getRecordHorizon(record) === horizon)
    .slice(-14);
  if (settled.length === 0) {
    return 0;
  }

  const averageRelativeError = average(
    settled.map((record) => (record.actualClose! - record.predictedClose) / record.predictedClose)
  );
  return clamp(averageRelativeError * 0.35, -0.025, 0.025);
}

function calculateAccuracy(
  records: ForecastRecord[],
  horizon: "daily" | "weekly"
): BitcoinForecast["accuracy"] {
  const settled = records.filter(
    (record) => record.actualClose !== undefined && getRecordHorizon(record) === horizon
  );
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

function buildWeeklyForecast({
  latestCandle,
  trendPercent,
  macdPercent,
  rsi14,
  volumeConfirmation,
  volatility,
  records
}: {
  latestCandle: BitcoinCandle;
  trendPercent: number;
  macdPercent: number;
  rsi14: number;
  volumeConfirmation: number;
  volatility: number;
  records: ForecastRecord[];
}): ForecastHorizon {
  const correction = calculateBiasCorrection(records, "weekly");
  const rangeCalibration = calculateRangeCalibration(records, "weekly");
  const expectedReturn = clamp(
    trendPercent * 1.8 +
      macdPercent * 1.35 -
      ((rsi14 - 50) / 100) * 0.035 +
      volumeConfirmation * 1.4 +
      correction,
    -0.3,
    0.3
  );
  const predictedClose = latestCandle.close * (1 + expectedReturn);
  const rangePercent = clamp(volatility * Math.sqrt(7) * 1.7 * rangeCalibration.multiplier, 0.07, 0.32);
  const confidence = Math.round(
    clamp(
      66 - volatility * 520 - Math.abs(rsi14 - 50) * 0.36 -
        (rangeCalibration.observedCoverage === null ? 0 : Math.abs(rangeCalibration.observedCoverage - rangeCalibration.targetCoverage) * 28),
      32,
      70
    )
  );

  return {
    targetDate: new Date(latestCandle.timestamp + 7 * DAY_IN_MS)
      .toISOString()
      .slice(0, 10),
    predictedClose,
    lowerBound: predictedClose * (1 - rangePercent),
    upperBound: predictedClose * (1 + rangePercent),
    confidence,
    expectedReturnPercent: expectedReturn * 100,
    direction:
      expectedReturn > 0.012 ? "Bullish" : expectedReturn < -0.012 ? "Bearish" : "Neutral"
  };
}

function getRecordHorizon(record: ForecastRecord) {
  // Forecast records saved before weekly support are daily forecasts.
  return record.horizon ?? "daily";
}

function calculateVolumeConfirmation(dailyReturn: number, volumeRatio: number) {
  if (Math.abs(dailyReturn) < 0.002 || volumeRatio <= 1) {
    return 0;
  }

  return Math.sign(dailyReturn) * clamp((volumeRatio - 1) * 0.012, 0, 0.024);
}

function calculateVolumeConfidenceAdjustment(
  dailyReturn: number,
  volumeRatio: number
) {
  if (Math.abs(dailyReturn) < 0.002) {
    return 0;
  }

  if (volumeRatio >= 1.15) {
    return clamp((volumeRatio - 1) * 8, 0, 6);
  }

  if (volumeRatio <= 0.8) {
    return -4;
  }

  return 0;
}

function getVolumeDirection(
  dailyReturn: number,
  volumeRatio: number
): ForecastSignal["direction"] {
  if (Math.abs(dailyReturn) < 0.002 || volumeRatio < 1.05) {
    return "neutral";
  }

  return dailyReturn > 0 ? "positive" : "negative";
}

function getVolumeDetail(dailyReturn: number, volumeRatio: number) {
  if (Math.abs(dailyReturn) < 0.002) {
    return "Price was mostly unchanged, so volume is not adding directional weight.";
  }

  if (volumeRatio >= 1.15) {
    return dailyReturn > 0
      ? "Above-average volume confirms the latest upward move."
      : "Above-average volume confirms the latest downward move.";
  }

  if (volumeRatio <= 0.8) {
    return "Below-average volume lowers confidence in the latest price move.";
  }

  return "Volume is close to its 20-day average and adds little directional weight.";
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}
