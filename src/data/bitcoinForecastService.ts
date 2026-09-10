import type {
  BitcoinCandle,
  BitcoinForecast,
  ForecastAsset,
  ForecastHorizon,
  ForecastRecord,
  ForecastSignal,
  MicrostructureSnapshot
} from "../types/forecast";
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
  calculateEma,
  calculateRsi,
  calculateVolatility,
  clamp,
  buildWeeklySignalReturn,
  evaluateFeatureAblation,
  evaluateForecastBenchmark,
  evaluateWeeklyForecastBenchmark,
  getAutoExcludedFeatures,
  shrinkReturnToBenchmark
} from "./forecastModels";
import { getDailyCandleHistory, fetchRecentHourlyCandles, parseCandleHistoryCache, type CandleHistoryCache } from "./candleHistoryService";
import { applyOpenInterestHistory, fetchAssetDerivatives } from "./derivativesService";
import { buildOnChainRegime, calculateOnChainAdjustment, fetchOnChainMetrics } from "./onChainService";
import { getMacroEventRisk } from "./macroEventService";
import { appendMicrostructureSnapshot, calculateMicrostructureAdjustment, fetchMicrostructureSnapshot } from "./microstructureService";
import { FORECAST_EVALUATION_VERSION, isComparableForecastRecord, isUtcForecastCreationWindow } from "./forecastSchedule";

const FORECAST_STORAGE_KEY = "crypto-portfolio-tracker-forecast-records-v2";
const MICROSTRUCTURE_STORAGE_KEY = "crypto-portfolio-tracker-microstructure-v1";
const CANDLE_HISTORY_STORAGE_KEY = "crypto-portfolio-tracker-candle-history-v1";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const forecastAssets: Record<ForecastAsset, { name: string }> = {
  BTC: { name: "Bitcoin" },
  ETH: { name: "Ethereum" },
  ADA: { name: "Cardano" },
  SOL: { name: "Solana" },
  XRP: { name: "XRP" },
  DOGE: { name: "Dogecoin" }
};

export async function fetchAssetForecast(assetSymbol: ForecastAsset = "BTC"): Promise<BitcoinForecast> {
  const [historyCache, hourlyCandles, derivatives, onChain, microstructure, allRecords, storedSnapshots] = await Promise.all([
    readCandleHistoryCache(),
    fetchAssetHourlyCandles(assetSymbol).catch(() => []),
    fetchAssetDerivatives(assetSymbol),
    fetchOnChainMetrics(assetSymbol),
    fetchMicrostructureSnapshot(assetSymbol),
    readAllForecastRecords(),
    readMicrostructureSnapshots()
  ]);
  const requestedAssets = [...new Set<ForecastAsset>([assetSymbol, "BTC", "ETH"])] as ForecastAsset[];
  const historyResults = await Promise.all(requestedAssets.map((asset) => getDailyCandleHistory(asset, historyCache)));
  const updatedHistoryCache = historyResults.reduce<CandleHistoryCache>(
    (cache, result) => ({ ...cache, ...result.cache }),
    historyCache
  );
  await saveCandleHistoryCache(updatedHistoryCache);
  const candlesByAsset = new Map(requestedAssets.map((asset, index) => [asset, historyResults[index].candles]));
  const candles = candlesByAsset.get(assetSymbol)!;
  const btcCandles = candlesByAsset.get("BTC")!;
  const ethCandles = candlesByAsset.get("ETH")!;
  const snapshots = appendMicrostructureSnapshot(storedSnapshots, microstructure);
  await saveMicrostructureSnapshots(snapshots);
  const records = reconcileForecastRecords(recordsForAsset(allRecords, assetSymbol), candles);
  const comparableRecords = records.filter(isComparableForecastRecord);
  const featureAblation = evaluateFeatureAblation(candles, assetSymbol);
  const excludedFeatures = getAutoExcludedFeatures(featureAblation);
  const forecast = buildForecast(
    candles,
    comparableRecords,
    applyOpenInterestHistory(derivatives, comparableRecords),
    onChain,
    assetSymbol,
    btcCandles,
    ethCandles,
    hourlyCandles,
    microstructure,
    snapshots.filter((snapshot) => snapshot.assetSymbol === assetSymbol),
    featureAblation,
    excludedFeatures
  );
  const nextRecords = upsertForecastRecords(records, forecast, assetSymbol);

  await saveForecastRecords(assetSymbol, nextRecords, allRecords);

  return {
    ...forecast,
    assetSymbol,
    assetName: forecastAssets[assetSymbol].name,
    records: nextRecords,
    accuracy: calculateAccuracy(nextRecords, "daily"),
    weeklyAccuracy: calculateAccuracy(nextRecords, "weekly"),
    confidenceCalibration: calculateConfidenceCalibration(nextRecords)
  };
}

export function fetchBitcoinForecast() {
  return fetchAssetForecast("BTC");
}

async function fetchAssetHourlyCandles(assetSymbol: ForecastAsset): Promise<BitcoinCandle[]> {
  return fetchRecentHourlyCandles(assetSymbol);
}

function buildForecast(
  candles: BitcoinCandle[],
  records: ForecastRecord[],
  derivatives: BitcoinForecast["derivatives"]
  , onChain: BitcoinForecast["onChain"], assetSymbol: ForecastAsset, btcCandles: BitcoinCandle[], ethCandles: BitcoinCandle[], hourlyCandles: BitcoinCandle[], microstructure: MicrostructureSnapshot | null, microstructureSnapshots: MicrostructureSnapshot[], featureAblation: BitcoinForecast["featureAblation"], excludedFeatures: BitcoinForecast["featureAblation"][number]["id"][]
): Omit<BitcoinForecast, "assetSymbol" | "assetName" | "records" | "accuracy" | "weeklyAccuracy" | "confidenceCalibration"> {
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
  const ensemble = buildDailyEnsemble(candles, assetSymbol, excludedFeatures);
  const multiTimeframe = buildMultiTimeframeSignal(hourlyCandles, candles);
  const benchmark = evaluateForecastBenchmark(candles, assetSymbol, excludedFeatures);
  const weeklyBenchmark = evaluateWeeklyForecastBenchmark(candles);
  const onChainRegime = buildOnChainRegime(onChain);
  const latestCandle = candles[candles.length - 1];
  const rangeCalibration = calculateRangeCalibration(records, "daily", ensemble.marketRegime.id);
  const directionCalibration = calculateDirectionProbabilityCalibration(records);
  const correction = calculateBiasCorrection(records, "daily");
  const rawExpectedReturn = clamp(
    ensemble.expectedReturn + calculateDerivativeAdjustment(derivatives, trendPercent) + calculateOnChainAdjustment(onChain) + calculateMarketLinkAdjustment(assetSymbol, btcCandles, ethCandles) + multiTimeframe.adjustment + calculateMicrostructureAdjustment(microstructure, microstructureSnapshots) + correction,
    -0.12,
    0.12
  );
  const directionModel = buildDirectionModel(candles, rawExpectedReturn);
  const volatilityModel = buildVolatilityModel(candles);
  const rawDirection = rawExpectedReturn > 0.003 ? "Bullish" : rawExpectedReturn < -0.003 ? "Bearish" : "Neutral";
  const directionAgreement = directionModel.direction === rawDirection && rawDirection !== "Neutral";
  // A direction conflict does not flip the return model; it reduces its influence until the next close provides new evidence.
  const expectedReturn = shrinkReturnToBenchmark(
    directionAgreement ? rawExpectedReturn : rawExpectedReturn * 0.45,
    benchmark.hasEdge,
    "daily"
  );
  const predictedClose = currentClose * (1 + expectedReturn);
  const asOfDate = latestCandle.date;
  const macroRisk = getMacroEventRisk(asOfDate);
  const dataQuality = calculateDataQuality(derivatives, onChain, hourlyCandles.length >= 25, Boolean(microstructure));
  const rangePercent = calculateProbabilisticRange({
    volatility: Math.max(volatility, volatilityModel.expectedDailyMovePercent / 100),
    modelDispersion: ensemble.modelDispersion,
    marketRegime: ensemble.marketRegime.id,
    calibrationMultiplier: rangeCalibration.multiplier,
    macroMultiplier: (macroRisk?.rangeMultiplier ?? 1) * onChainRegime.rangeMultiplier
  });
  const calibrationPenalty = rangeCalibration.observedCoverage === null
    ? 0
    : Math.abs(rangeCalibration.observedCoverage - rangeCalibration.targetCoverage) * 30;
  const confidence = Math.round(
    clamp(
      72 -
        volatility * 450 -
        Math.abs(rsi14 - 50) * 0.28 +
        calculateVolumeConfidenceAdjustment(latestDailyReturn, volumeRatio) -
        calibrationPenalty - (benchmark.hasEdge ? 0 : 12) - ensemble.confidencePenalty + multiTimeframe.confidenceAdjustment - (macroRisk?.confidencePenalty ?? 0) - onChainRegime.confidencePenalty - (100 - dataQuality.score) * 0.18 - (directionAgreement ? 0 : 8) - (volatilityModel.outlook === "elevated" ? 4 : 0),
      38,
      78
    )
  );
  const targetDate = new Date(
    latestCandle.timestamp + DAY_IN_MS
  ).toISOString().slice(0, 10);
  const direction = expectedReturn > 0.003 ? "Bullish" : expectedReturn < -0.003 ? "Bearish" : "Neutral";
  const decision = buildForecastDecision({
    expectedReturn,
    confidence,
    hasForecastEdge: benchmark.hasEdge,
    dataQualityScore: dataQuality.score,
    multiTimeframe,
    directionModel,
    returnDirection: direction,
    volatilityModel,
    regimeReliability: ensemble.regimeReliability,
    directionCalibration
  });
  const weeklyForecast = buildWeeklyForecast({
    latestCandle,
    candles,
    volatility,
    records,
    marketRegime: ensemble.marketRegime.id,
    benchmark: weeklyBenchmark,
    onChainRegime
  });

  const signals: ForecastSignal[] = [
    {
      label: "Regime reliability",
      value: `${ensemble.regimeReliability.directionalAccuracy.toFixed(0)}% / ${ensemble.regimeReliability.evaluatedDays}D`,
      direction: ensemble.regimeReliability.isValidated && ensemble.regimeReliability.directionalAccuracy >= 51 ? "positive" : "negative",
      detail: ensemble.regimeReliability.isValidated
        ? `${ensemble.marketRegime.label} model reliability adjusts return size and decision confidence.`
        : `Collecting ${ensemble.marketRegime.label.toLowerCase()} samples before this regime can approve a forecast.`
    },
    {
      label: "Direction probability",
      value: `Up ${(directionModel.probabilityUp * 100).toFixed(0)}% / Down ${(directionModel.probabilityDown * 100).toFixed(0)}%`,
      direction: directionModel.direction === "Bullish" ? "positive" : directionModel.direction === "Bearish" ? "negative" : "neutral",
      detail: `${directionModel.direction} classifier accuracy: ${directionModel.directionalAccuracy.toFixed(0)}% across ${directionModel.evaluatedDays} walk-forward days.`
    },
    {
      label: "Volatility outlook",
      value: `±${volatilityModel.expectedDailyMovePercent.toFixed(1)}% daily`,
      direction: volatilityModel.outlook === "elevated" ? "negative" : volatilityModel.outlook === "calm" ? "positive" : "neutral",
      detail: `${volatilityModel.outlook === "elevated" ? "Elevated" : volatilityModel.outlook === "calm" ? "Calmer" : "Normal"} expected daily movement uses 7D, 21D, and 60D realized volatility.`
    },
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
      label: "Order book & trade flow",
      value: microstructure ? `${(microstructure.orderBookImbalance * 100).toFixed(1)}% depth` : "Unavailable",
      direction: microstructure && calculateMicrostructureAdjustment(microstructure, microstructureSnapshots) > 0.0003 ? "positive" : microstructure && calculateMicrostructureAdjustment(microstructure, microstructureSnapshots) < -0.0003 ? "negative" : "neutral",
      detail: !microstructure
        ? "Coinbase market depth is temporarily unavailable, so this signal has no weight."
        : microstructureSnapshots.length < 12
          ? `Collecting hourly snapshots (${microstructureSnapshots.length}/12) before market depth can influence the forecast.`
          : `Top-of-book depth is ${(microstructure.orderBookImbalance * 100).toFixed(1)}% bid-heavy; recent trade flow is ${microstructure.tradeFlowImbalance === null ? "unavailable" : `${(microstructure.tradeFlowImbalance * 100).toFixed(1)}%`}.`
    },
    {
      label: "Derivatives positioning",
      value: derivatives ? `${(derivatives.fundingRate * 100).toFixed(3)}% funding` : "Unavailable",
      direction: derivatives && derivatives.fundingRate > derivatives.fundingRate30DayAverage * 1.5 ? "negative" : derivatives && derivatives.fundingRate < 0 ? "positive" : "neutral",
      detail: derivatives
        ? derivatives.openInterestChange7Day === null
          ? "Funding is available; open-interest history is still building."
          : `Open interest changed ${(derivatives.openInterestChange7Day * 100).toFixed(1)}% over 7 days.`
        : "Derivative data is temporarily unavailable, so this signal has no weight."
    },
    ...(assetSymbol === "BTC" ? [{
      label: "BTC on-chain regime",
      value: onChainRegime.label,
      direction: onChainRegime.id === "accumulation" ? "positive" : onChainRegime.id === "distribution" || onChainRegime.id === "capitulation" ? "negative" : "neutral" as ForecastSignal["direction"],
      detail: onChainRegime.detail
    }] : []),
    {
      label: "On-chain activity",
      value: onChain ? `${(onChain.activeAddressesChange7Day * 100).toFixed(1)}% active addresses${onChain.mvrv === null ? "" : ` · MVRV ${onChain.mvrv.toFixed(2)}`}` : "Unavailable",
      direction: onChain && onChain.activeAddressesChange7Day > 0.05 && onChain.transactionCountChange7Day > 0 ? "positive" : onChain && onChain.activeAddressesChange7Day < -0.05 && onChain.transactionCountChange7Day < 0 ? "negative" : "neutral",
      detail: onChain
        ? `Active addresses changed ${(onChain.activeAddressesChange7Day * 100).toFixed(1)}% and transactions changed ${(onChain.transactionCountChange7Day * 100).toFixed(1)}% versus the prior 7-day average.`
        : "On-chain activity is temporarily unavailable, so it has no weight."
    },
    {
      label: "Market correlation",
      value: formatSignedPercent(calculateMarketLinkAdjustment(assetSymbol, btcCandles, ethCandles)),
      direction: calculateMarketLinkAdjustment(assetSymbol, btcCandles, ethCandles) > 0 ? "positive" : calculateMarketLinkAdjustment(assetSymbol, btcCandles, ethCandles) < 0 ? "negative" : "neutral",
      detail: assetSymbol === "BTC" ? "Bitcoin is the market anchor, so no external correlation adjustment is applied." : "BTC direction and the ETH/BTC relationship provide a small, capped market-context adjustment."
    },
    {
      label: "Market regime",
      value: ensemble.marketRegime.label,
      direction: ensemble.marketRegime.id === "uptrend" ? "positive" : ensemble.marketRegime.id === "downtrend" ? "negative" : "neutral",
      detail: ensemble.marketRegime.detail
    },
    {
      label: "Multi-timeframe alignment",
      value: formatTimeframeAlignment(multiTimeframe.alignment),
      direction: multiTimeframe.alignment === "bullish" ? "positive" : multiTimeframe.alignment === "bearish" || multiTimeframe.alignment === "mixed" ? "negative" : "neutral",
      detail: timeframeSignalDetail(multiTimeframe.alignment)
    },
    {
      label: "Forecast range",
      value: `±${(rangePercent * 100).toFixed(1)}%`,
      direction: ensemble.marketRegime.id === "volatile" ? "negative" : "neutral",
      detail: "The central 68% range uses volatility, model disagreement, the current market state, and past calibration."
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
    multiTimeframe,
    directionModel,
    volatilityModel,
    regimeReliability: ensemble.regimeReliability,
    directionCalibration,
    decision,
    weeklyForecast,
    signals,
    modelLeaderboard: ensemble.leaderboard,
    marketRegime: ensemble.marketRegime,
    rangeCalibration,
    derivatives,
    onChain,
    onChainRegime,
    microstructure,
    microstructureSamples: microstructureSnapshots.length,
    featureAblation,
    macroRisk,
    dataQuality,
    benchmark
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
  forecast: Omit<BitcoinForecast, "assetSymbol" | "assetName" | "records" | "accuracy" | "weeklyAccuracy" | "confidenceCalibration">,
  assetSymbol: ForecastAsset
): ForecastRecord[] {
  const evaluationVersion = FORECAST_EVALUATION_VERSION;
  const dailyRecord: ForecastRecord = {
    assetSymbol,
    horizon: "daily",
    targetDate: forecast.targetDate,
    createdAt: new Date().toISOString(),
    evaluationVersion,
    baseClose: forecast.currentClose,
    predictedClose: forecast.predictedClose,
    lowerBound: forecast.lowerBound,
    upperBound: forecast.upperBound,
    confidence: forecast.confidence,
    marketRegime: forecast.marketRegime.id,
    direction: forecast.direction,
    expectedReturnPercent: forecast.expectedReturnPercent,
    modelWeights: Object.fromEntries(
      forecast.modelLeaderboard.map((model) => [model.id, model.weight])
    ),
    derivativeData: forecast.derivatives ?? undefined,
    onChainData: forecast.onChain ?? undefined,
    onChainRegime: forecast.onChainRegime,
    microstructureData: forecast.microstructure ?? undefined,
    hasForecastEdge: forecast.benchmark.hasEdge,
    multiTimeframe: forecast.multiTimeframe,
    directionModel: forecast.directionModel,
    regimeReliability: forecast.regimeReliability,
    decision: forecast.decision
  };
  const weeklyRecord: ForecastRecord = {
    assetSymbol,
    horizon: "weekly",
    targetDate: forecast.weeklyForecast.targetDate,
    createdAt: new Date().toISOString(),
    evaluationVersion,
    baseClose: forecast.currentClose,
    predictedClose: forecast.weeklyForecast.predictedClose,
    lowerBound: forecast.weeklyForecast.lowerBound,
    upperBound: forecast.weeklyForecast.upperBound,
    confidence: forecast.weeklyForecast.confidence,
    marketRegime: forecast.marketRegime.id,
    onChainRegime: forecast.onChainRegime,
    direction: forecast.weeklyForecast.direction,
    expectedReturnPercent: forecast.weeklyForecast.expectedReturnPercent
  };

  if (!isUtcForecastCreationWindow()) {
    return records;
  }

  return upsertForecastRecord(upsertForecastRecord(records, dailyRecord), weeklyRecord).slice(-180);
}

function upsertForecastRecord(records: ForecastRecord[], record: ForecastRecord) {
  const existingIndex = records.findIndex(
    (item) => item.targetDate === record.targetDate && getRecordHorizon(item) === record.horizon
  );
  const nextRecords = [...records];

  if (existingIndex === -1) nextRecords.push(record);

  return nextRecords;
}

async function readAllForecastRecords(): Promise<ForecastRecord[]> {
  try {
    const rawValue = window.desktopApp
      ? await window.desktopApp.forecastStorage.load()
      : window.localStorage.getItem(FORECAST_STORAGE_KEY) ?? window.localStorage.getItem("crypto-portfolio-tracker-btc-forecast-records-v1");
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isForecastRecord) : [];
  } catch {
    return [];
  }
}

async function saveForecastRecords(assetSymbol: ForecastAsset, records: ForecastRecord[], allRecords: ForecastRecord[]) {
  const value = JSON.stringify([
    ...allRecords.filter((record) => !belongsToAsset(record, assetSymbol)),
    ...records
  ]);

  if (window.desktopApp) {
    await window.desktopApp.forecastStorage.save(value);
    return;
  }

  window.localStorage.setItem(FORECAST_STORAGE_KEY, value);
}

async function readMicrostructureSnapshots(): Promise<MicrostructureSnapshot[]> {
  try {
    const rawValue = window.desktopApp
      ? await window.desktopApp.microstructureStorage.load()
      : window.localStorage.getItem(MICROSTRUCTURE_STORAGE_KEY);
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isMicrostructureSnapshot) : [];
  } catch {
    return [];
  }
}

async function readCandleHistoryCache(): Promise<CandleHistoryCache> {
  try {
    const rawValue = window.desktopApp
      ? await window.desktopApp.candleHistoryStorage.load()
      : window.localStorage.getItem(CANDLE_HISTORY_STORAGE_KEY);
    return rawValue ? parseCandleHistoryCache(JSON.parse(rawValue)) : {};
  } catch {
    return {};
  }
}

async function saveCandleHistoryCache(cache: CandleHistoryCache) {
  const value = JSON.stringify(cache);
  if (window.desktopApp) {
    await window.desktopApp.candleHistoryStorage.save(value);
    return;
  }
  window.localStorage.setItem(CANDLE_HISTORY_STORAGE_KEY, value);
}

async function saveMicrostructureSnapshots(snapshots: MicrostructureSnapshot[]) {
  const value = JSON.stringify(snapshots);
  if (window.desktopApp) {
    await window.desktopApp.microstructureStorage.save(value);
    return;
  }
  window.localStorage.setItem(MICROSTRUCTURE_STORAGE_KEY, value);
}

function recordsForAsset(records: ForecastRecord[], assetSymbol: ForecastAsset) {
  return records.filter((record) => belongsToAsset(record, assetSymbol));
}

function belongsToAsset(record: ForecastRecord, assetSymbol: ForecastAsset) {
  // Existing records were BTC-only, so untagged history remains Bitcoin history.
  return (record.assetSymbol ?? "BTC") === assetSymbol;
}

function isForecastRecord(value: unknown): value is ForecastRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<ForecastRecord>;
  return typeof record.targetDate === "string" && typeof record.predictedClose === "number" && typeof record.baseClose === "number";
}

function isMicrostructureSnapshot(value: unknown): value is MicrostructureSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<MicrostructureSnapshot>;
  return typeof snapshot.assetSymbol === "string" &&
    typeof snapshot.capturedAt === "string" &&
    typeof snapshot.orderBookImbalance === "number" &&
    typeof snapshot.spreadPercent === "number";
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

function calculateConfidenceCalibration(records: ForecastRecord[]): BitcoinForecast["confidenceCalibration"] {
  return [[40, 54], [55, 64], [65, 74], [75, 100]].map(([min, max]) => {
    const settled = records.filter((record) => getRecordHorizon(record) === "daily" && record.actualClose !== undefined && record.confidence >= min && record.confidence <= max);
    return {
      label: `${min}-${max}%`,
      settledCount: settled.length,
      averageConfidence: settled.length ? average(settled.map((record) => record.confidence)) : 0,
      rangeHitRate: settled.length ? settled.filter((record) => record.actualClose! >= record.lowerBound && record.actualClose! <= record.upperBound).length / settled.length : null
    };
  });
}

function calculateDataQuality(derivatives: BitcoinForecast["derivatives"], onChain: BitcoinForecast["onChain"], hasIntradayData: boolean, hasMicrostructure: boolean): BitcoinForecast["dataQuality"] {
  const missingSources = [!derivatives && "Derivatives", !onChain && "On-chain", !hasIntradayData && "Intraday", !hasMicrostructure && "Market depth"].filter((source): source is string => Boolean(source));
  return { score: Math.max(50, 100 - missingSources.length * 12), missingSources };
}

function formatTimeframeAlignment(alignment: BitcoinForecast["multiTimeframe"]["alignment"]) {
  return { bullish: "Aligned bullish", bearish: "Aligned bearish", neutral: "Neutral", mixed: "Mixed", unavailable: "Unavailable" }[alignment];
}

function timeframeSignalDetail(alignment: BitcoinForecast["multiTimeframe"]["alignment"]) {
  return {
    bullish: "1H, 4H, and daily trends are confirming the same upside direction.",
    bearish: "1H, 4H, and daily trends are confirming the same downside direction.",
    neutral: "Short and long timeframes are close to flat.",
    mixed: "Timeframes disagree, so the short-term contribution is reduced.",
    unavailable: "Intraday candles are unavailable, so the daily model remains conservative."
  }[alignment];
}

function calculateMarketLinkAdjustment(asset: ForecastAsset, btcCandles: BitcoinCandle[], ethCandles: BitcoinCandle[]) {
  if (asset === "BTC" || btcCandles.length < 2 || ethCandles.length < 2) return 0;
  const btcReturn = btcCandles[btcCandles.length - 1].close / btcCandles[btcCandles.length - 2].close - 1;
  const ethReturn = ethCandles[ethCandles.length - 1].close / ethCandles[ethCandles.length - 2].close - 1;
  const value = asset === "ETH" ? btcReturn * 0.15 : btcReturn * 0.32 + (ethReturn - btcReturn) * 0.18;
  return clamp(value, -0.012, 0.012);
}

function buildWeeklyForecast({
  latestCandle,
  candles,
  volatility,
  records,
  marketRegime,
  benchmark,
  onChainRegime
}: {
  latestCandle: BitcoinCandle;
  candles: BitcoinCandle[];
  volatility: number;
  records: ForecastRecord[];
  marketRegime: BitcoinForecast["marketRegime"]["id"];
  benchmark: BitcoinForecast["benchmark"];
  onChainRegime: BitcoinForecast["onChainRegime"];
}): ForecastHorizon {
  const correction = calculateBiasCorrection(records, "weekly");
  const rangeCalibration = calculateRangeCalibration(records, "weekly", marketRegime);
  const expectedReturn = shrinkReturnToBenchmark(
    clamp(buildWeeklySignalReturn(candles) + correction, -0.3, 0.3),
    benchmark.hasEdge,
    "weekly"
  );
  const closes = candles.map((candle) => candle.close);
  const rsi14 = calculateRsi(closes.slice(-15));
  const predictedClose = latestCandle.close * (1 + expectedReturn);
  const rangePercent = clamp(volatility * Math.sqrt(7) * 1.7 * rangeCalibration.multiplier * onChainRegime.rangeMultiplier, 0.07, 0.32);
  const confidence = Math.round(
    clamp(
      66 - volatility * 520 - Math.abs(rsi14 - 50) * 0.36 - onChainRegime.confidencePenalty -
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
