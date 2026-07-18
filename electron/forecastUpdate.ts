import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  average,
  buildDailyEnsemble,
  calculateDerivativeAdjustment,
  calculateRangeCalibration,
  calculateEma,
  calculateRsi,
  calculateVolatility,
  clamp,
  evaluateForecastBenchmark
} from "../src/data/forecastModels.js";
import { detectForecastAlerts, type ForecastAlert } from "../src/data/forecastAlerts.js";
import { applyOpenInterestHistory, fetchBitcoinDerivatives } from "../src/data/derivativesService.js";
import type { DerivativeMarketData } from "../src/types/forecast.js";

const FORECAST_FILE_NAME = "bitcoin-forecast-records.json";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CANDLES_URL = "https://api.exchange.coinbase.com/products/BTC-USD/candles";

interface Candle {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface RecordItem {
  horizon?: "daily" | "weekly";
  targetDate: string;
  createdAt: string;
  baseClose: number;
  predictedClose: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  actualClose?: number;
  marketRegime?: "uptrend" | "downtrend" | "range" | "volatile";
  direction?: "Bullish" | "Bearish" | "Neutral";
  expectedReturnPercent?: number;
  modelWeights?: Partial<Record<"technical" | "trend" | "meanReversion", number>>;
  derivativeData?: DerivativeMarketData;
  hasForecastEdge?: boolean;
}

export async function runForecastUpdate(userDataPath: string): Promise<ForecastAlert[]> {
  const [candles, derivatives] = await Promise.all([fetchDailyCandles(), fetchBitcoinDerivatives()]);
  const filePath = path.join(userDataPath, FORECAST_FILE_NAME);
  const existingRecords = await readRecords(filePath);
  const records = reconcileRecords(existingRecords, candles);
  const newlySettled = records.filter(
    (record, index) => record.actualClose !== undefined && existingRecords[index]?.actualClose === undefined
  );
  const nextRecords = upsertForecasts(records, candles, applyOpenInterestHistory(derivatives, records));
  const currentDaily = nextRecords.filter((record) => getHorizon(record) === "daily").sort(byTargetDate).at(-1)!;
  const previousDaily = records.filter((record) => getHorizon(record) === "daily").sort(byTargetDate).at(-1);
  const alerts = detectForecastAlerts(previousDaily, currentDaily, newlySettled);

  await writeRecords(filePath, nextRecords);
  return alerts;
}

async function fetchDailyCandles(): Promise<Candle[]> {
  const end = new Date();
  const start = new Date(end.getTime() - 120 * DAY_IN_MS);
  const url = new URL(CANDLES_URL);
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("end", end.toISOString());
  url.searchParams.set("granularity", "86400");

  const response = await fetch(url);
  if (!response.ok) throw new Error("Coinbase daily candle request failed");

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) throw new Error("Malformed Coinbase candle payload");

  const now = Date.now();
  const candles = data
    .map(readCandle)
    .filter((value): value is Candle => value !== null)
    .filter((candle) => candle.timestamp + DAY_IN_MS <= now)
    .sort((left, right) => left.timestamp - right.timestamp);

  if (candles.length < 35) throw new Error("Not enough BTC history for forecast update");
  return candles;
}

function readCandle(value: unknown): Candle | null {
  if (!Array.isArray(value) || value.length < 6) return null;
  const [timestamp, low, high, open, close, volume] = value;
  if (![timestamp, low, high, open, close, volume].every((item) => typeof item === "number" && Number.isFinite(item))) return null;

  return {
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    timestamp: timestamp * 1000,
    open,
    high,
    low,
    close,
    volume
  };
}

function reconcileRecords(records: RecordItem[], candles: Candle[]) {
  const closeByDate = new Map(candles.map((candle) => [candle.date, candle.close]));
  return records.map((record) => ({
    ...record,
    actualClose: closeByDate.get(record.targetDate) ?? record.actualClose
  }));
}

function upsertForecasts(records: RecordItem[], candles: Candle[], derivatives: DerivativeMarketData | null) {
  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const latest = candles[candles.length - 1];
  const currentClose = latest.close;
  const trend = average(closes.slice(-7)) / average(closes.slice(-30)) - 1;
  const rsi = calculateRsi(closes.slice(-15));
  const macd = (calculateEma(closes, 12) - calculateEma(closes, 26)) / currentClose;
  const volatility = calculateVolatility(closes.slice(-15));
  const dailyReturn = currentClose / closes[closes.length - 2] - 1;
  const volumeRatio = volumes[volumes.length - 1] / average(volumes.slice(-21, -1));
  const volumeConfirmation = calculateVolumeConfirmation(dailyReturn, volumeRatio);
  const ensemble = buildDailyEnsemble(candles);
  const benchmark = evaluateForecastBenchmark(candles);
  const dailyCalibration = calculateRangeCalibration(records, "daily");
  const weeklyCalibration = calculateRangeCalibration(records, "weekly");

  const dailyExpectedReturn = clamp(
    ensemble.expectedReturn + calculateDerivativeAdjustment(derivatives, trend) + calculateBias(records, "daily"),
    -0.12,
    0.12
  );
  const weeklyExpectedReturn = clamp(
    trend * 1.8 + macd * 1.35 - ((rsi - 50) / 100) * 0.035 + volumeConfirmation * 1.4 + calculateBias(records, "weekly"),
    -0.3,
    0.3
  );

  const dailyPrediction = makeRecord({
    horizon: "daily",
    targetDate: toDate(latest.timestamp + DAY_IN_MS),
    baseClose: currentClose,
    expectedReturn: dailyExpectedReturn,
    rangePercent: clamp(volatility * 1.6 * dailyCalibration.multiplier, 0.025, 0.16),
    confidence: Math.round(clamp(
      72 - volatility * 450 - Math.abs(rsi - 50) * 0.28 + volumeConfidence(dailyReturn, volumeRatio) -
        (dailyCalibration.observedCoverage === null ? 0 : Math.abs(dailyCalibration.observedCoverage - dailyCalibration.targetCoverage) * 30) -
        (benchmark.hasEdge ? 0 : 12),
      38,
      78
    )),
    marketRegime: ensemble.marketRegime.id,
    direction: getDirection(dailyExpectedReturn, 0.003),
    expectedReturnPercent: dailyExpectedReturn * 100,
    modelWeights: Object.fromEntries(ensemble.leaderboard.map((model) => [model.id, model.weight])),
    derivativeData: derivatives ?? undefined,
    hasForecastEdge: benchmark.hasEdge
  });
  const weeklyPrediction = makeRecord({
    horizon: "weekly",
    targetDate: toDate(latest.timestamp + 7 * DAY_IN_MS),
    baseClose: currentClose,
    expectedReturn: weeklyExpectedReturn,
    rangePercent: clamp(volatility * Math.sqrt(7) * 1.7 * weeklyCalibration.multiplier, 0.07, 0.32),
    confidence: Math.round(clamp(
      66 - volatility * 520 - Math.abs(rsi - 50) * 0.36 -
        (weeklyCalibration.observedCoverage === null ? 0 : Math.abs(weeklyCalibration.observedCoverage - weeklyCalibration.targetCoverage) * 28),
      32,
      70
    )),
    marketRegime: ensemble.marketRegime.id,
    direction: getDirection(weeklyExpectedReturn, 0.012),
    expectedReturnPercent: weeklyExpectedReturn * 100
  });

  return upsertRecord(upsertRecord(records, dailyPrediction), weeklyPrediction).slice(-180);
}

function makeRecord({ horizon, targetDate, baseClose, expectedReturn, rangePercent, confidence, marketRegime, direction, expectedReturnPercent, modelWeights, derivativeData, hasForecastEdge }: {
  horizon: "daily" | "weekly";
  targetDate: string;
  baseClose: number;
  expectedReturn: number;
  rangePercent: number;
  confidence: number;
  marketRegime?: RecordItem["marketRegime"];
  direction?: RecordItem["direction"];
  expectedReturnPercent?: number;
  modelWeights?: RecordItem["modelWeights"];
  derivativeData?: RecordItem["derivativeData"];
  hasForecastEdge?: boolean;
}): RecordItem {
  const predictedClose = baseClose * (1 + expectedReturn);
  return { horizon, targetDate, createdAt: new Date().toISOString(), baseClose, predictedClose, lowerBound: predictedClose * (1 - rangePercent), upperBound: predictedClose * (1 + rangePercent), confidence, marketRegime, direction, expectedReturnPercent, modelWeights, derivativeData, hasForecastEdge };
}

function upsertRecord(records: RecordItem[], record: RecordItem) {
  const index = records.findIndex((item) => item.targetDate === record.targetDate && getHorizon(item) === record.horizon);
  const next = [...records];
  if (index === -1) next.push(record);
  else if (next[index].actualClose === undefined) next[index] = record;
  return next;
}

function calculateBias(records: RecordItem[], horizon: "daily" | "weekly") {
  const settled = records.filter((record) => record.actualClose !== undefined && getHorizon(record) === horizon).slice(-14);
  if (!settled.length) return 0;
  return clamp(average(settled.map((record) => (record.actualClose! - record.predictedClose) / record.predictedClose)) * 0.35, -0.025, 0.025);
}

function getHorizon(record: RecordItem) { return record.horizon ?? "daily"; }
function byTargetDate(left: RecordItem, right: RecordItem) { return left.targetDate.localeCompare(right.targetDate); }
function getDirection(expectedReturn: number, threshold: number): "Bullish" | "Bearish" | "Neutral" { return expectedReturn > threshold ? "Bullish" : expectedReturn < -threshold ? "Bearish" : "Neutral"; }
function toDate(timestamp: number) { return new Date(timestamp).toISOString().slice(0, 10); }
function calculateVolumeConfirmation(dailyReturn: number, ratio: number) { return Math.abs(dailyReturn) < 0.002 || ratio <= 1 ? 0 : Math.sign(dailyReturn) * clamp((ratio - 1) * 0.012, 0, 0.024); }
function volumeConfidence(dailyReturn: number, ratio: number) { if (Math.abs(dailyReturn) < 0.002) return 0; if (ratio >= 1.15) return clamp((ratio - 1) * 8, 0, 6); return ratio <= 0.8 ? -4 : 0; }

async function readRecords(filePath: string): Promise<RecordItem[]> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch { return []; }
}

async function writeRecords(filePath: string, records: RecordItem[]) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(records), "utf8");
  await rename(temporaryPath, filePath);
}

function isRecord(value: unknown): value is RecordItem {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<RecordItem>;
  return typeof record.targetDate === "string" && typeof record.baseClose === "number" && typeof record.predictedClose === "number";
}
