import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  average,
  buildDailyEnsemble,
  buildDirectionModel,
  buildForecastDecision,
  buildMultiTimeframeSignal,
  buildVolatilityModel,
  calculateDerivativeAdjustment,
  calculateDirectionProbabilityCalibration,
  calculateProbabilisticRange,
  calculateRangeCalibration,
  calculateRsi,
  calculateVolatility,
  clamp,
  buildWeeklySignalReturn,
  evaluateFeatureAblation,
  evaluateForecastBenchmark,
  evaluateWeeklyForecastBenchmark,
  getAutoExcludedFeatures,
  shrinkReturnToBenchmark
} from "../src/data/forecastModels.js";
import { fetchRecentHourlyCandles, getDailyCandleHistory, parseCandleHistoryCache, type CandleHistoryCache } from "../src/data/candleHistoryService.js";
import { detectForecastAlerts, type ForecastAlert } from "../src/data/forecastAlerts.js";
import { applyOpenInterestHistory, fetchAssetDerivatives } from "../src/data/derivativesService.js";
import { calculateOnChainAdjustment, fetchOnChainMetrics } from "../src/data/onChainService.js";
import { appendMicrostructureSnapshot, calculateMicrostructureAdjustment, fetchMicrostructureSnapshot } from "../src/data/microstructureService.js";
import { FORECAST_EVALUATION_VERSION, isComparableForecastRecord, isUtcForecastCreationWindow } from "../src/data/forecastSchedule.js";
import type { DerivativeMarketData, DirectionModelForecast, ForecastAsset, ForecastDecision, MicrostructureSnapshot, MultiTimeframeSignal, RegimeReliability } from "../src/types/forecast.js";

const FORECAST_FILE_NAME = "bitcoin-forecast-records.json";
const MICROSTRUCTURE_FILE_NAME = "forecast-microstructure-snapshots.json";
const CANDLE_HISTORY_FILE_NAME = "forecast-candle-history.json";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const forecastAssets: ForecastAsset[] = ["BTC", "ETH", "ADA", "SOL", "XRP", "DOGE"];

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
  assetSymbol?: ForecastAsset;
  horizon?: "daily" | "weekly";
  targetDate: string;
  createdAt: string;
  evaluationVersion?: number;
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
  onChainData?: import("../src/types/forecast.js").OnChainMarketData;
  microstructureData?: MicrostructureSnapshot;
  hasForecastEdge?: boolean;
  multiTimeframe?: MultiTimeframeSignal;
  directionModel?: DirectionModelForecast;
  regimeReliability?: RegimeReliability;
  decision?: ForecastDecision;
}

export async function runForecastUpdate(userDataPath: string): Promise<ForecastAlert[]> {
  const runStartedAt = Date.now();
  const filePath = path.join(userDataPath, FORECAST_FILE_NAME);
  const microstructureFilePath = path.join(userDataPath, MICROSTRUCTURE_FILE_NAME);
  const candleHistoryFilePath = path.join(userDataPath, CANDLE_HISTORY_FILE_NAME);
  const existingRecords = await readRecords(filePath);
  let microstructureSnapshots = await readMicrostructureSnapshots(microstructureFilePath);
  let candleHistory = parseCandleHistoryCache(await readStoredJson(candleHistoryFilePath));
  let nextRecords = existingRecords;
  const alerts: ForecastAlert[] = [];
  const loadDailyHistory = async (assetSymbol: ForecastAsset) => {
    const result = await getDailyCandleHistory(assetSymbol, candleHistory);
    candleHistory = result.cache;
    return result.candles;
  };
  const btcCandles = await loadDailyHistory("BTC");
  const ethCandles = await loadDailyHistory("ETH");

  for (const assetSymbol of forecastAssets) {
    const [candles, hourlyCandles, derivatives, onChain, microstructure] = await Promise.all([
      assetSymbol === "BTC" ? Promise.resolve(btcCandles) : assetSymbol === "ETH" ? Promise.resolve(ethCandles) : loadDailyHistory(assetSymbol),
      fetchRecentHourlyCandles(assetSymbol).catch(() => []),
      fetchAssetDerivatives(assetSymbol),
      fetchOnChainMetrics(assetSymbol),
      fetchMicrostructureSnapshot(assetSymbol)
    ]);
    const priorAssetRecords = recordsForAsset(nextRecords, assetSymbol);
    const records = reconcileRecords(priorAssetRecords, candles);
    const newlySettled = records.filter((record, index) => record.actualClose !== undefined && priorAssetRecords[index]?.actualClose === undefined);
    microstructureSnapshots = appendMicrostructureSnapshot(microstructureSnapshots, microstructure);
    const updatedAssetRecords = upsertForecasts(
      records,
      candles,
      hourlyCandles,
      applyOpenInterestHistory(derivatives, records),
      onChain,
      calculateMarketLinkAdjustment(assetSymbol, btcCandles, ethCandles),
      assetSymbol,
      microstructure,
      microstructureSnapshots.filter((snapshot) => snapshot.assetSymbol === assetSymbol),
      runStartedAt
    );
    const currentDaily = updatedAssetRecords.filter((record) => getHorizon(record) === "daily").sort(byTargetDate).at(-1);
    const previousDaily = records.filter((record) => getHorizon(record) === "daily").sort(byTargetDate).at(-1);
    if (currentDaily) {
      alerts.push(...detectForecastAlerts(previousDaily, currentDaily, newlySettled, assetSymbol));
    }
    nextRecords = [...nextRecords.filter((record) => !belongsToAsset(record, assetSymbol)), ...updatedAssetRecords];
  }

  await writeRecords(filePath, nextRecords);
  await writeMicrostructureSnapshots(microstructureFilePath, microstructureSnapshots);
  await writeStoredJson(candleHistoryFilePath, candleHistory);
  return alerts;
}

function reconcileRecords(records: RecordItem[], candles: Candle[]) {
  const closeByDate = new Map(candles.map((candle) => [candle.date, candle.close]));
  return records.map((record) => ({
    ...record,
    actualClose: closeByDate.get(record.targetDate) ?? record.actualClose
  }));
}

function upsertForecasts(records: RecordItem[], candles: Candle[], hourlyCandles: Candle[], derivatives: DerivativeMarketData | null, onChain: RecordItem["onChainData"] | null, marketAdjustment: number, assetSymbol: ForecastAsset, microstructure: MicrostructureSnapshot | null, microstructureSnapshots: MicrostructureSnapshot[], now: number) {
  const comparableRecords = records.filter(isComparableForecastRecord);
  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const latest = candles[candles.length - 1];
  const currentClose = latest.close;
  const trend = average(closes.slice(-7)) / average(closes.slice(-30)) - 1;
  const rsi = calculateRsi(closes.slice(-15));
  const volatility = calculateVolatility(closes.slice(-15));
  const dailyReturn = currentClose / closes[closes.length - 2] - 1;
  const volumeRatio = volumes[volumes.length - 1] / average(volumes.slice(-21, -1));
  const featureAblation = evaluateFeatureAblation(candles, assetSymbol);
  const excludedFeatures = getAutoExcludedFeatures(featureAblation);
  const ensemble = buildDailyEnsemble(candles, assetSymbol, excludedFeatures);
  const multiTimeframe = buildMultiTimeframeSignal(hourlyCandles, candles);
  const benchmark = evaluateForecastBenchmark(candles, assetSymbol, excludedFeatures);
  const weeklyBenchmark = evaluateWeeklyForecastBenchmark(candles);
  const dailyCalibration = calculateRangeCalibration(comparableRecords, "daily", ensemble.marketRegime.id);
  const weeklyCalibration = calculateRangeCalibration(comparableRecords, "weekly", ensemble.marketRegime.id);
  const directionCalibration = calculateDirectionProbabilityCalibration(comparableRecords);

  const rawDailyExpectedReturn = clamp(
    ensemble.expectedReturn + calculateDerivativeAdjustment(derivatives, trend) + calculateOnChainAdjustment(onChain ?? null) + marketAdjustment + multiTimeframe.adjustment + calculateMicrostructureAdjustment(microstructure, microstructureSnapshots) + calculateBias(comparableRecords, "daily"),
    -0.12,
    0.12
  );
  const directionModel = buildDirectionModel(candles, rawDailyExpectedReturn);
  const volatilityModel = buildVolatilityModel(candles);
  const rawDirection = getDirection(rawDailyExpectedReturn, 0.003);
  const dailyExpectedReturn = shrinkReturnToBenchmark(
    directionModel.direction === rawDirection && rawDirection !== "Neutral"
      ? rawDailyExpectedReturn
      : rawDailyExpectedReturn * 0.45,
    benchmark.hasEdge,
    "daily"
  );
  const weeklyExpectedReturn = shrinkReturnToBenchmark(
    clamp(buildWeeklySignalReturn(candles) + calculateBias(comparableRecords, "weekly"), -0.3, 0.3),
    weeklyBenchmark.hasEdge,
    "weekly"
  );

  const dailyConfidence = Math.round(clamp(
    72 - volatility * 450 - Math.abs(rsi - 50) * 0.28 + volumeConfidence(dailyReturn, volumeRatio) + multiTimeframe.confidenceAdjustment -
      (dailyCalibration.observedCoverage === null ? 0 : Math.abs(dailyCalibration.observedCoverage - dailyCalibration.targetCoverage) * 30) -
      (benchmark.hasEdge ? 0 : 12) - ensemble.confidencePenalty - (directionModel.direction === rawDirection ? 0 : 8) - (volatilityModel.outlook === "elevated" ? 4 : 0),
    38,
    78
  ));
  const decision = buildForecastDecision({
    expectedReturn: dailyExpectedReturn,
    confidence: dailyConfidence,
    hasForecastEdge: benchmark.hasEdge,
    dataQualityScore: calculateBackgroundDataQuality(derivatives, onChain, hourlyCandles.length >= 25, Boolean(microstructure)),
    multiTimeframe,
    directionModel,
    returnDirection: getDirection(dailyExpectedReturn, 0.003),
    volatilityModel,
    regimeReliability: ensemble.regimeReliability,
    directionCalibration
  });
  const dailyPrediction = makeRecord({
    assetSymbol,
    horizon: "daily",
    targetDate: toDate(latest.timestamp + DAY_IN_MS),
    baseClose: currentClose,
    expectedReturn: dailyExpectedReturn,
    rangePercent: calculateProbabilisticRange({
      volatility: Math.max(volatility, volatilityModel.expectedDailyMovePercent / 100),
      modelDispersion: ensemble.modelDispersion,
      marketRegime: ensemble.marketRegime.id,
      calibrationMultiplier: dailyCalibration.multiplier
    }),
    confidence: dailyConfidence,
    marketRegime: ensemble.marketRegime.id,
    direction: getDirection(dailyExpectedReturn, 0.003),
    expectedReturnPercent: dailyExpectedReturn * 100,
    modelWeights: Object.fromEntries(ensemble.leaderboard.map((model) => [model.id, model.weight])),
    derivativeData: derivatives ?? undefined,
    onChainData: onChain ?? undefined,
    microstructureData: microstructure ?? undefined,
    hasForecastEdge: benchmark.hasEdge,
    multiTimeframe,
    directionModel,
    regimeReliability: ensemble.regimeReliability,
    decision
  });
  const weeklyPrediction = makeRecord({
    assetSymbol,
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

  if (!isUtcForecastCreationWindow(now)) {
    return records;
  }

  return upsertRecord(upsertRecord(records, dailyPrediction), weeklyPrediction).slice(-180);
}

function makeRecord({ assetSymbol, horizon, targetDate, baseClose, expectedReturn, rangePercent, confidence, marketRegime, direction, expectedReturnPercent, modelWeights, derivativeData, onChainData, microstructureData, hasForecastEdge, multiTimeframe, directionModel, regimeReliability, decision }: {
  assetSymbol: ForecastAsset;
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
  onChainData?: RecordItem["onChainData"];
  microstructureData?: MicrostructureSnapshot;
  multiTimeframe?: MultiTimeframeSignal;
  directionModel?: DirectionModelForecast;
  regimeReliability?: RegimeReliability;
  decision?: ForecastDecision;
}): RecordItem {
  const predictedClose = baseClose * (1 + expectedReturn);
  return { assetSymbol, horizon, targetDate, createdAt: new Date().toISOString(), evaluationVersion: FORECAST_EVALUATION_VERSION, baseClose, predictedClose, lowerBound: predictedClose * (1 - rangePercent), upperBound: predictedClose * (1 + rangePercent), confidence, marketRegime, direction, expectedReturnPercent, modelWeights, derivativeData, onChainData, microstructureData, hasForecastEdge, multiTimeframe, directionModel, regimeReliability, decision };
}

function upsertRecord(records: RecordItem[], record: RecordItem) {
  const index = records.findIndex((item) => item.targetDate === record.targetDate && getHorizon(item) === record.horizon && item.assetSymbol === record.assetSymbol);
  const next = [...records];
  if (index === -1) next.push(record);
  return next;
}

function calculateBias(records: RecordItem[], horizon: "daily" | "weekly") {
  const settled = records.filter((record) => record.actualClose !== undefined && getHorizon(record) === horizon).slice(-14);
  if (!settled.length) return 0;
  return clamp(average(settled.map((record) => (record.actualClose! - record.predictedClose) / record.predictedClose)) * 0.35, -0.025, 0.025);
}

function getHorizon(record: RecordItem) { return record.horizon ?? "daily"; }
function belongsToAsset(record: RecordItem, assetSymbol: ForecastAsset) { return (record.assetSymbol ?? "BTC") === assetSymbol; }
function recordsForAsset(records: RecordItem[], assetSymbol: ForecastAsset) { return records.filter((record) => belongsToAsset(record, assetSymbol)); }
function byTargetDate(left: RecordItem, right: RecordItem) { return left.targetDate.localeCompare(right.targetDate); }
function getDirection(expectedReturn: number, threshold: number): "Bullish" | "Bearish" | "Neutral" { return expectedReturn > threshold ? "Bullish" : expectedReturn < -threshold ? "Bearish" : "Neutral"; }
function toDate(timestamp: number) { return new Date(timestamp).toISOString().slice(0, 10); }
function volumeConfidence(dailyReturn: number, ratio: number) { if (Math.abs(dailyReturn) < 0.002) return 0; if (ratio >= 1.15) return clamp((ratio - 1) * 8, 0, 6); return ratio <= 0.8 ? -4 : 0; }
function calculateMarketLinkAdjustment(asset: ForecastAsset, btcCandles: Candle[], ethCandles: Candle[]) { if (asset === "BTC" || btcCandles.length < 2 || ethCandles.length < 2) return 0; const btcReturn = btcCandles[btcCandles.length - 1].close / btcCandles[btcCandles.length - 2].close - 1; const ethReturn = ethCandles[ethCandles.length - 1].close / ethCandles[ethCandles.length - 2].close - 1; return clamp(asset === "ETH" ? btcReturn * .15 : btcReturn * .32 + (ethReturn - btcReturn) * .18, -.012, .012); }
function calculateBackgroundDataQuality(derivatives: DerivativeMarketData | null, onChain: RecordItem["onChainData"] | null, hasIntradayData: boolean, hasMicrostructure: boolean) { return Math.max(50, 100 - [!derivatives, !onChain, !hasIntradayData, !hasMicrostructure].filter(Boolean).length * 12); }

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

async function readStoredJson(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

async function writeStoredJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(value), "utf8");
  await rename(temporaryPath, filePath);
}

async function readMicrostructureSnapshots(filePath: string): Promise<MicrostructureSnapshot[]> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isMicrostructureSnapshot) : [];
  } catch {
    return [];
  }
}

async function writeMicrostructureSnapshots(filePath: string, snapshots: MicrostructureSnapshot[]) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(snapshots), "utf8");
  await rename(temporaryPath, filePath);
}

function isRecord(value: unknown): value is RecordItem {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<RecordItem>;
  return typeof record.targetDate === "string" && typeof record.baseClose === "number" && typeof record.predictedClose === "number";
}

function isMicrostructureSnapshot(value: unknown): value is MicrostructureSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<MicrostructureSnapshot>;
  return typeof snapshot.assetSymbol === "string" &&
    typeof snapshot.capturedAt === "string" &&
    typeof snapshot.orderBookImbalance === "number" &&
    typeof snapshot.spreadPercent === "number";
}
