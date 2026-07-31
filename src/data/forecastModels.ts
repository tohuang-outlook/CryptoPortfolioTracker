import type {
  BitcoinCandle,
  DerivativeMarketData,
  ForecastBenchmark,
  ForecastModelId,
  ForecastModelPerformance,
  ForecastAsset,
  ForecastDecision,
  DirectionModelForecast,
  FeatureAblationResult,
  ForecastFeatureId,
  MarketRegime,
  MarketRegimeId,
  MultiTimeframeSignal,
  RangeCalibration,
  TimeframeAlignment,
  VolatilityModelForecast
} from "../types/forecast.js";

const MINIMUM_HISTORY = 31;
const BACKTEST_WINDOW = 60;

type ModelDefinition = {
  id: ForecastModelId;
  label: string;
  predictReturn: (candles: BitcoinCandle[], excludedFeatures?: readonly ForecastFeatureId[]) => number;
};

const models: ModelDefinition[] = [
  {
    id: "technical",
    label: "Technical signals",
    predictReturn(candles, excludedFeatures = []) {
      const closes = candles.map((candle) => candle.close);
      const volumes = candles.map((candle) => candle.volume);
      const currentClose = closes[closes.length - 1];
      const trend = average(closes.slice(-7)) / average(closes.slice(-30)) - 1;
      const macd = (calculateEma(closes, 12) - calculateEma(closes, 26)) / currentClose;
      const rsi = calculateRsi(closes.slice(-15));
      const dailyReturn = currentClose / closes[closes.length - 2] - 1;
      const volumeRatio = volumes[volumes.length - 1] / average(volumes.slice(-21, -1));

      const volumeConfirmation = excludedFeatures.includes("volume") ? 0 : calculateVolumeConfirmation(dailyReturn, volumeRatio);
      return clamp(
        trend * 0.7 + macd * 0.55 - ((rsi - 50) / 100) * 0.012 + volumeConfirmation,
        -0.12,
        0.12
      );
    }
  },
  {
    id: "trend",
    label: "Trend follow",
    predictReturn(candles) {
      const closes = candles.map((candle) => candle.close);
      const shortTrend = average(closes.slice(-7)) / average(closes.slice(-30)) - 1;
      const mediumTrend = closes[closes.length - 1] / closes[closes.length - 15] - 1;
      return clamp(shortTrend * 0.8 + mediumTrend * 0.2, -0.08, 0.08);
    }
  },
  {
    id: "meanReversion",
    label: "Mean reversion",
    predictReturn(candles) {
      const closes = candles.map((candle) => candle.close);
      const currentClose = closes[closes.length - 1];
      const sma7 = average(closes.slice(-7));
      const rsi = calculateRsi(closes.slice(-15));
      return clamp((sma7 / currentClose - 1) * 0.8 - ((rsi - 50) / 100) * 0.008, -0.06, 0.06);
    }
  }
];

export function buildDailyEnsemble(
  candles: BitcoinCandle[],
  asset: ForecastAsset = "BTC",
  excludedFeatures: readonly ForecastFeatureId[] = []
) {
  if (candles.length < MINIMUM_HISTORY) {
    throw new Error("Not enough Bitcoin history to build the forecast ensemble");
  }

  const marketRegime = detectMarketRegime(candles);
  const activeModels = models.filter((model) => !excludedFeatures.includes(model.id));
  const leaderboard = backtestModels(candles, marketRegime.id, asset, excludedFeatures);
  const currentReturns = activeModels.map((model) => ({ id: model.id, value: model.predictReturn(candles, excludedFeatures) }));
  const expectedReturn = currentReturns.reduce(
    (sum, prediction) => sum + prediction.value * leaderboard.find((model) => model.id === prediction.id)!.weight,
    0
  );
  const modelDispersion = Math.sqrt(currentReturns.reduce((sum, prediction) => {
    const weight = leaderboard.find((model) => model.id === prediction.id)!.weight;
    return sum + weight * (prediction.value - expectedReturn) ** 2;
  }, 0));

  const limit = asset === "BTC" ? 0.12 : asset === "ETH" ? 0.15 : 0.22;
  const returnMultiplier = assetProfile(asset).returnMultiplier;
  return {
    expectedReturn: clamp(expectedReturn * returnMultiplier, -limit, limit),
    leaderboard,
    marketRegime,
    modelDispersion: modelDispersion * returnMultiplier,
    confidencePenalty: calculateEnsembleConfidencePenalty(marketRegime.id, modelDispersion * returnMultiplier)
  };
}

export function evaluateForecastBenchmark(
  candles: BitcoinCandle[],
  asset: ForecastAsset = "BTC",
  excludedFeatures: readonly ForecastFeatureId[] = []
): ForecastBenchmark {
  const startIndex = Math.max(MINIMUM_HISTORY + 12, candles.length - BACKTEST_WINDOW - 1);
  const ensembleOutcomes: ForecastOutcome[] = [];
  const naiveOutcomes: ForecastOutcome[] = [];
  const trendOutcomes: ForecastOutcome[] = [];

  for (let index = startIndex; index < candles.length - 1; index += 1) {
    const history = candles.slice(0, index + 1);
    const baseClose = history[history.length - 1].close;
    const ensembleReturn = buildDailyEnsemble(history, asset, excludedFeatures).expectedReturn;
    const actualClose = candles[index + 1].close;
    ensembleOutcomes.push(makeOutcome(baseClose, baseClose * (1 + ensembleReturn), actualClose));
    naiveOutcomes.push(makeOutcome(baseClose, baseClose, actualClose));
    trendOutcomes.push(makeOutcome(baseClose, baseClose * (1 + models.find((model) => model.id === "trend")!.predictReturn(history)), actualClose));
  }

  const ensemble = summarizeOutcomes(ensembleOutcomes);
  const naive = summarizeOutcomes(naiveOutcomes);
  const trend = summarizeOutcomes(trendOutcomes);
  const bestBaseline = naive.meanAbsolutePercentError <= trend.meanAbsolutePercentError ? naive : trend;

  return {
    ensemble,
    naive,
    trend,
    hasEdge: ensemble.meanAbsolutePercentError < bestBaseline.meanAbsolutePercentError &&
      ensemble.directionalAccuracy >= bestBaseline.directionalAccuracy
  };
}

export function evaluateFeatureAblation(candles: BitcoinCandle[], asset: ForecastAsset = "BTC"): FeatureAblationResult[] {
  const featureDefinitions: Array<{ id: ForecastFeatureId; label: string }> = [
    { id: "technical", label: "Technical signals" },
    { id: "trend", label: "Trend follow" },
    { id: "meanReversion", label: "Mean reversion" },
    { id: "volume", label: "Volume confirmation" }
  ];
  const startIndex = Math.max(MINIMUM_HISTORY + 12, candles.length - 46);
  const baselineOutcomes: ForecastOutcome[] = [];
  const outcomesByFeature = new Map<ForecastFeatureId, ForecastOutcome[]>(
    featureDefinitions.map((feature) => [feature.id, []])
  );

  for (let index = startIndex; index < candles.length - 1; index += 1) {
    const history = candles.slice(0, index + 1);
    const baseClose = history[history.length - 1].close;
    const actualClose = candles[index + 1].close;
    baselineOutcomes.push(makeOutcome(baseClose, baseClose * (1 + buildDailyEnsemble(history, asset).expectedReturn), actualClose));
    featureDefinitions.forEach((feature) => {
      const withoutFeature = buildDailyEnsemble(history, asset, [feature.id]).expectedReturn;
      outcomesByFeature.get(feature.id)!.push(makeOutcome(baseClose, baseClose * (1 + withoutFeature), actualClose));
    });
  }

  const baseline = summarizeOutcomes(baselineOutcomes);
  const results = featureDefinitions.map((feature) => {
    const result = summarizeOutcomes(outcomesByFeature.get(feature.id)!);
    const errorDelta = result.meanAbsolutePercentError - baseline.meanAbsolutePercentError;
    const directionalDelta = result.directionalAccuracy - baseline.directionalAccuracy;
    const status = result.evaluatedDays < 24
      ? "learning" as const
      : errorDelta > 0.04 || directionalDelta < -2
        ? "helpful" as const
        : errorDelta < -0.04 && directionalDelta >= -1
          ? "paused" as const
          : "neutral" as const;
    return { ...feature, ...result, errorDelta, status };
  });

  // Keep at least two independent price models active even when a short sample is unusually noisy.
  const corePauseIds = results
    .filter((result) => result.status === "paused" && result.id !== "volume")
    .sort((left, right) => left.errorDelta - right.errorDelta)
    .slice(0, 1)
    .map((result) => result.id);
  return results.map((result) => result.status === "paused" && result.id !== "volume" && !corePauseIds.includes(result.id)
    ? { ...result, status: "neutral" as const }
    : result
  );
}

export function getAutoExcludedFeatures(results: FeatureAblationResult[]): ForecastFeatureId[] {
  return results
    .filter((result) => result.status === "paused" && result.evaluatedDays >= 24)
    .map((result) => result.id);
}

export function calculateDerivativeAdjustment(data: DerivativeMarketData | null, priceTrend: number) {
  if (!data) return 0;

  const fundingSpread = data.fundingRate - data.fundingRate30DayAverage;
  const fundingAdjustment = fundingSpread > 0.00035 ? -0.004 : fundingSpread < -0.00025 ? 0.003 : 0;
  const openInterestAdjustment = data.openInterestChange7Day !== null && Math.abs(data.openInterestChange7Day) >= 0.08
    ? Math.sign(priceTrend) * Math.sign(data.openInterestChange7Day) * 0.003
    : 0;

  return clamp(fundingAdjustment + openInterestAdjustment, -0.007, 0.007);
}

function backtestModels(
  candles: BitcoinCandle[],
  activeRegime: MarketRegimeId,
  asset: ForecastAsset = "BTC",
  excludedFeatures: readonly ForecastFeatureId[] = []
): ForecastModelPerformance[] {
  // Reserve the newest 14 closes as a holdout set instead of fitting weights to them.
  const trainingEnd = Math.min(candles.length, Math.max(MINIMUM_HISTORY + 1, candles.length - 14));
  const startIndex = Math.max(MINIMUM_HISTORY - 1, trainingEnd - BACKTEST_WINDOW - 1);
  const activeModels = models.filter((model) => !excludedFeatures.includes(model.id));
  const samples = activeModels.map((model) => {
    const outcomes: Array<{ absoluteError: number; correctDirection: boolean; regime: MarketRegimeId }> = [];

    for (let index = startIndex; index < trainingEnd - 1; index += 1) {
      const history = candles.slice(0, index + 1);
      const baseClose = history[history.length - 1].close;
      const predictedClose = baseClose * (1 + model.predictReturn(history, excludedFeatures));
      const actualClose = candles[index + 1].close;
      outcomes.push({
        absoluteError: Math.abs(actualClose - predictedClose) / actualClose,
        correctDirection: Math.sign(predictedClose - baseClose) === Math.sign(actualClose - baseClose),
        regime: detectMarketRegime(history).id
      });
    }

    const regimeOutcomes = outcomes.filter((outcome) => outcome.regime === activeRegime);
    const hasRegimeSample = regimeOutcomes.length >= 8;
    const regimeWeight = hasRegimeSample ? Math.min(0.78, 0.42 + regimeOutcomes.length / 50) : 0;
    const overallError = average(outcomes.map((outcome) => outcome.absoluteError));
    const regimeError = hasRegimeSample ? average(regimeOutcomes.map((outcome) => outcome.absoluteError)) : overallError;
    const overallDirectionAccuracy = outcomes.filter((outcome) => outcome.correctDirection).length / outcomes.length;
    const regimeDirectionAccuracy = hasRegimeSample
      ? regimeOutcomes.filter((outcome) => outcome.correctDirection).length / regimeOutcomes.length
      : overallDirectionAccuracy;

    return {
      ...model,
      meanAbsolutePercentError: (regimeError * regimeWeight + overallError * (1 - regimeWeight)) * 100,
      directionalAccuracy: (regimeDirectionAccuracy * regimeWeight + overallDirectionAccuracy * (1 - regimeWeight)) * 100,
      evaluatedDays: hasRegimeSample ? regimeOutcomes.length : outcomes.length
    };
  });
  const regimeMultipliers = getRegimeMultipliers(activeRegime);
  const profile = assetProfile(asset);
  const averageError = average(samples.map((sample) => sample.meanAbsolutePercentError));
  const statuses = samples.map((sample) => {
    if (sample.directionalAccuracy < 35 && sample.meanAbsolutePercentError > averageError * 1.35) return "paused" as const;
    if (sample.directionalAccuracy < 42 && sample.meanAbsolutePercentError > averageError * 1.15) return "reduced" as const;
    return "active" as const;
  });
  const scores = samples.map((sample, index) => {
    const statusMultiplier = statuses[index] === "paused" ? 0 : statuses[index] === "reduced" ? 0.35 : 1;
    return regimeMultipliers[sample.id] * profile.modelMultipliers[sample.id] / Math.max(sample.meanAbsolutePercentError, 0.05) * (0.8 + sample.directionalAccuracy / 250) * statusMultiplier;
  });
  const totalScore = scores.reduce((total, score) => total + score, 0);

  return samples
    .map((sample, index) => ({
      id: sample.id,
      label: sample.label,
      meanAbsolutePercentError: sample.meanAbsolutePercentError,
      directionalAccuracy: sample.directionalAccuracy,
      weight: totalScore > 0 ? scores[index] / totalScore : 1 / samples.length,
      evaluatedDays: sample.evaluatedDays,
      status: statuses[index]
    }))
    .sort((left, right) => right.weight - left.weight);
}

function assetProfile(asset: ForecastAsset) {
  if (asset === "BTC") return { returnMultiplier: 0.85, modelMultipliers: { technical: 0.9, trend: 1.25, meanReversion: 0.85 } };
  if (asset === "ETH") return { returnMultiplier: 1, modelMultipliers: { technical: 1, trend: 1.1, meanReversion: 0.9 } };
  return { returnMultiplier: 1.2, modelMultipliers: { technical: 1.2, trend: 0.85, meanReversion: 1.1 } };
}

type ForecastOutcome = { absoluteError: number; correctDirection: boolean };

function makeOutcome(baseClose: number, predictedClose: number, actualClose: number): ForecastOutcome {
  return {
    absoluteError: Math.abs(actualClose - predictedClose) / actualClose,
    correctDirection: Math.sign(predictedClose - baseClose) === Math.sign(actualClose - baseClose)
  };
}

function summarizeOutcomes(outcomes: ForecastOutcome[]) {
  return {
    meanAbsolutePercentError: average(outcomes.map((outcome) => outcome.absoluteError)) * 100,
    directionalAccuracy: outcomes.filter((outcome) => outcome.correctDirection).length / outcomes.length * 100,
    evaluatedDays: outcomes.length
  };
}

export function detectMarketRegime(candles: BitcoinCandle[]): MarketRegime {
  const closes = candles.map((candle) => candle.close);
  const volatility15 = calculateVolatility(closes.slice(-15));
  const volatility60 = closes.length >= 61 ? calculateVolatility(closes.slice(-60)) : volatility15;
  const sma7 = average(closes.slice(-7));
  const sma30 = average(closes.slice(-30));
  const currentClose = closes[closes.length - 1];
  const trend = sma7 / sma30 - 1;

  if (volatility15 > Math.max(volatility60 * 1.45, 0.035)) {
    return { id: "volatile", label: "High volatility", detail: "Recent daily swings are materially above the longer-term baseline." };
  }
  if (trend > 0.012 && currentClose > sma30) {
    return { id: "uptrend", label: "Uptrend", detail: "Short-term price and trend are holding above the 30-day baseline." };
  }
  if (trend < -0.012 && currentClose < sma30) {
    return { id: "downtrend", label: "Downtrend", detail: "Short-term price and trend are holding below the 30-day baseline." };
  }
  return { id: "range", label: "Range-bound", detail: "Price is moving near its recent average without a decisive trend." };
}

export function calculateRangeCalibration(
  records: Array<{ horizon?: "daily" | "weekly"; lowerBound: number; upperBound: number; actualClose?: number }>,
  horizon: "daily" | "weekly"
): RangeCalibration {
  const settled = records
    .filter((record) => (record.horizon ?? "daily") === horizon && record.actualClose !== undefined)
    .slice(-30);
  const targetCoverage = 0.68;

  if (settled.length < 8) {
    return { settledCount: settled.length, observedCoverage: null, targetCoverage, multiplier: 1 };
  }

  const observedCoverage = settled.filter((record) =>
    record.actualClose! >= record.lowerBound && record.actualClose! <= record.upperBound
  ).length / settled.length;

  return {
    settledCount: settled.length,
    observedCoverage,
    targetCoverage,
    multiplier: clamp(1 + (targetCoverage - observedCoverage) * 1.5, 0.85, 1.45)
  };
}

export function calculateProbabilisticRange({
  volatility,
  modelDispersion,
  marketRegime,
  calibrationMultiplier,
  macroMultiplier = 1
}: {
  volatility: number;
  modelDispersion: number;
  marketRegime: MarketRegimeId;
  calibrationMultiplier: number;
  macroMultiplier?: number;
}) {
  const regimeMultiplier = marketRegime === "volatile"
    ? 1.34
    : marketRegime === "downtrend"
      ? 1.1
      : marketRegime === "uptrend"
        ? 1.03
        : 0.9;
  const uncertainty = volatility * 1.35 + modelDispersion * 0.85;

  return clamp(uncertainty * regimeMultiplier * calibrationMultiplier * macroMultiplier, 0.025, 0.2);
}

export function buildDirectionModel(candles: BitcoinCandle[], returnModelExpectedReturn: number): DirectionModelForecast {
  const score = calculateDirectionScore(candles, returnModelExpectedReturn);
  const probabilities = scoreToDirectionProbabilities(score);
  const outcomes: Array<{ predicted: "Bullish" | "Bearish" | "Neutral"; actual: number }> = [];
  const startIndex = Math.max(MINIMUM_HISTORY, candles.length - BACKTEST_WINDOW - 1);

  for (let index = startIndex; index < candles.length - 1; index += 1) {
    const history = candles.slice(0, index + 1);
    outcomes.push({
      predicted: directionFromProbabilities(scoreToDirectionProbabilities(calculateDirectionScore(history, 0))),
      actual: candles[index + 1].close / candles[index].close - 1
    });
  }

  const directionalAccuracy = outcomes.length
    ? outcomes.filter(({ predicted, actual }) => predicted === directionFromReturn(actual)).length / outcomes.length * 100
    : 50;

  return {
    ...probabilities,
    direction: directionFromProbabilities(probabilities),
    directionalAccuracy,
    evaluatedDays: outcomes.length
  };
}

export function buildVolatilityModel(candles: BitcoinCandle[]): VolatilityModelForecast {
  const closes = candles.map((candle) => candle.close);
  const shortTerm = calculateVolatility(closes.slice(-8));
  const mediumTerm = calculateVolatility(closes.slice(-22));
  const longTerm = calculateVolatility(closes.slice(-61));
  const expectedDailyMove = clamp(shortTerm * 0.5 + mediumTerm * 0.34 + longTerm * 0.16, 0.012, 0.18);
  const baseline = Math.max(mediumTerm, longTerm, 0.001);

  return {
    expectedDailyMovePercent: expectedDailyMove * 100,
    shortTermVolatilityPercent: shortTerm * 100,
    mediumTermVolatilityPercent: mediumTerm * 100,
    outlook: expectedDailyMove > baseline * 1.28 ? "elevated" : expectedDailyMove < baseline * 0.78 ? "calm" : "normal"
  };
}

export function calculateEnsembleConfidencePenalty(marketRegime: MarketRegimeId, modelDispersion: number) {
  const regimePenalty = marketRegime === "volatile" ? 9 : marketRegime === "downtrend" ? 3 : marketRegime === "uptrend" ? 1 : 0;
  return clamp(regimePenalty + modelDispersion * 220, 0, 14);
}

export function buildMultiTimeframeSignal(
  hourlyCandles: BitcoinCandle[],
  dailyCandles: BitcoinCandle[]
): MultiTimeframeSignal {
  const dailyTrend = average(dailyCandles.slice(-7).map((candle) => candle.close)) /
    average(dailyCandles.slice(-30).map((candle) => candle.close)) - 1;
  const fourHourCandles = aggregateCandles(hourlyCandles, 4);

  if (hourlyCandles.length < 25 || fourHourCandles.length < 7) {
    return {
      hourlyTrend: null,
      fourHourTrend: null,
      dailyTrend,
      alignment: "unavailable",
      adjustment: 0,
      confidenceAdjustment: -5
    };
  }

  const hourlyTrend = hourlyCandles[hourlyCandles.length - 1].close / hourlyCandles[hourlyCandles.length - 7].close - 1;
  const fourHourTrend = fourHourCandles[fourHourCandles.length - 1].close / fourHourCandles[fourHourCandles.length - 7].close - 1;
  const alignment = getTimeframeAlignment(hourlyTrend, fourHourTrend, dailyTrend);
  const rawAdjustment = hourlyTrend * 0.2 + fourHourTrend * 0.28 + dailyTrend * 0.14;
  const adjustmentMultiplier = alignment === "bullish" || alignment === "bearish"
    ? 1
    : alignment === "neutral"
      ? 0.35
      : 0.45;

  return {
    hourlyTrend,
    fourHourTrend,
    dailyTrend,
    alignment,
    adjustment: clamp(rawAdjustment * adjustmentMultiplier, -0.01, 0.01),
    confidenceAdjustment: alignment === "bullish" || alignment === "bearish"
      ? 5
      : alignment === "neutral"
        ? 1
        : -8
  };
}

export function buildForecastDecision({
  expectedReturn,
  confidence,
  hasForecastEdge,
  dataQualityScore,
  multiTimeframe,
  directionModel,
  returnDirection,
  volatilityModel
}: {
  expectedReturn: number;
  confidence: number;
  hasForecastEdge: boolean;
  dataQualityScore: number;
  multiTimeframe: MultiTimeframeSignal;
  directionModel?: DirectionModelForecast;
  returnDirection?: "Bullish" | "Bearish" | "Neutral";
  volatilityModel?: VolatilityModelForecast;
}): ForecastDecision {
  const isAligned = multiTimeframe.alignment === "bullish" || multiTimeframe.alignment === "bearish";
  const resolvedDirectionModel = directionModel ?? buildDirectionModelFromReturn(expectedReturn);
  const resolvedReturnDirection = returnDirection ?? directionFromReturn(expectedReturn);
  const resolvedVolatilityModel = volatilityModel ?? { expectedDailyMovePercent: 0, shortTermVolatilityPercent: 0, mediumTermVolatilityPercent: 0, outlook: "normal" as const };
  const directionAgreement = resolvedDirectionModel.direction === resolvedReturnDirection && resolvedDirectionModel.direction !== "Neutral";
  const directionProbability = Math.max(resolvedDirectionModel.probabilityUp, resolvedDirectionModel.probabilityDown);
  const volatilityPenalty = resolvedVolatilityModel.outlook === "elevated" ? 7 : 0;
  const score = Math.round(clamp(
    confidence + (hasForecastEdge ? 9 : -24) + multiTimeframe.confidenceAdjustment + (dataQualityScore - 80) * 0.2 +
      (directionAgreement ? 6 : -12) + (directionProbability - 0.5) * 28 - volatilityPenalty,
    0,
    100
  ));

  if (hasForecastEdge && isAligned && directionAgreement && directionProbability >= 0.56 && Math.abs(expectedReturn) >= 0.0045 && score >= 68) {
    return { status: "trade", score, detail: "Direction, return, and timeframe models agree with a validated edge." };
  }
  if (!hasForecastEdge || !directionAgreement || directionProbability < 0.52 || Math.abs(expectedReturn) < 0.0025 || score < 45) {
    return { status: "noEdge", score, detail: "No validated edge. The dashboard remains in observation mode." };
  }
  return { status: "watch", score, detail: "A signal is forming, but confidence or timeframe alignment is incomplete." };
}

function buildDirectionModelFromReturn(expectedReturn: number): DirectionModelForecast {
  const direction = directionFromReturn(expectedReturn);
  const strength = clamp(Math.abs(expectedReturn) / 0.02, 0, 1);
  const probabilityNeutral = 0.3 - strength * 0.16;
  const probabilityUp = direction === "Bullish" ? 1 - probabilityNeutral - 0.08 : direction === "Bearish" ? 0.08 : 0.35;
  return {
    direction,
    probabilityUp,
    probabilityDown: 1 - probabilityNeutral - probabilityUp,
    probabilityNeutral,
    directionalAccuracy: 50,
    evaluatedDays: 0
  };
}

function calculateDirectionScore(candles: BitcoinCandle[], returnModelExpectedReturn: number) {
  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const current = closes[closes.length - 1];
  const shortTrend = average(closes.slice(-7)) / average(closes.slice(-30)) - 1;
  const momentum = current / closes[closes.length - 8] - 1;
  const rsiSignal = (50 - calculateRsi(closes.slice(-15))) / 50;
  const volumeRatio = volumes[volumes.length - 1] / Math.max(average(volumes.slice(-21, -1)), 1);
  const volatility = Math.max(calculateVolatility(closes.slice(-22)), 0.004);
  return clamp(
    returnModelExpectedReturn / volatility * 0.72 + shortTrend / volatility * 0.46 + momentum / volatility * 0.22 + rsiSignal * 0.18 + (volumeRatio - 1) * Math.sign(shortTrend || momentum) * 0.08,
    -3.2,
    3.2
  );
}

function scoreToDirectionProbabilities(score: number) {
  const directionalStrength = 1 / (1 + Math.exp(-score));
  const neutral = clamp(0.34 - Math.abs(score) * 0.055, 0.12, 0.34);
  const remaining = 1 - neutral;
  return {
    probabilityUp: remaining * directionalStrength,
    probabilityDown: remaining * (1 - directionalStrength),
    probabilityNeutral: neutral
  };
}

function directionFromProbabilities(probabilities: Pick<DirectionModelForecast, "probabilityUp" | "probabilityDown" | "probabilityNeutral">): "Bullish" | "Bearish" | "Neutral" {
  if (probabilities.probabilityUp >= 0.54) return "Bullish";
  if (probabilities.probabilityDown >= 0.54) return "Bearish";
  return "Neutral";
}

function directionFromReturn(value: number): "Bullish" | "Bearish" | "Neutral" {
  return value > 0.002 ? "Bullish" : value < -0.002 ? "Bearish" : "Neutral";
}

export function aggregateCandles(candles: BitcoinCandle[], bucketHours: number): BitcoinCandle[] {
  const bucketMs = bucketHours * 60 * 60 * 1000;
  const buckets = new Map<number, BitcoinCandle[]>();

  for (const candle of candles) {
    const bucket = Math.floor(candle.timestamp / bucketMs) * bucketMs;
    const values = buckets.get(bucket) ?? [];
    values.push(candle);
    buckets.set(bucket, values);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .filter(([, values]) => values.length === bucketHours)
    .map(([timestamp, values]) => ({
      date: new Date(timestamp).toISOString().slice(0, 10),
      timestamp,
      open: values[0].open,
      high: Math.max(...values.map((candle) => candle.high)),
      low: Math.min(...values.map((candle) => candle.low)),
      close: values[values.length - 1].close,
      volume: values.reduce((sum, candle) => sum + candle.volume, 0)
    }));
}

function getTimeframeAlignment(hourlyTrend: number, fourHourTrend: number, dailyTrend: number): TimeframeAlignment {
  const directions = [
    classifyTimeframeTrend(hourlyTrend, 0.0025),
    classifyTimeframeTrend(fourHourTrend, 0.004),
    classifyTimeframeTrend(dailyTrend, 0.006)
  ];
  const positive = directions.filter((direction) => direction === 1).length;
  const negative = directions.filter((direction) => direction === -1).length;

  if (positive >= 2 && negative === 0) return "bullish";
  if (negative >= 2 && positive === 0) return "bearish";
  if (positive === 0 && negative === 0) return "neutral";
  return "mixed";
}

function classifyTimeframeTrend(value: number, threshold: number) {
  return value > threshold ? 1 : value < -threshold ? -1 : 0;
}

function getRegimeMultipliers(regime: MarketRegimeId): Record<ForecastModelId, number> {
  if (regime === "uptrend" || regime === "downtrend") {
    return { technical: 1.15, trend: 1.45, meanReversion: 0.72 };
  }
  if (regime === "volatile") {
    return { technical: 1.35, trend: 0.95, meanReversion: 0.75 };
  }
  return { technical: 1, trend: 0.72, meanReversion: 1.45 };
}

export function calculateVolatility(closes: number[]) {
  const returns = closes.slice(1).map((close, index) => close / closes[index] - 1);
  const mean = average(returns);
  return Math.sqrt(average(returns.map((value) => (value - mean) ** 2)));
}

export function calculateEma(values: number[], period: number) {
  const multiplier = 2 / (period + 1);
  return values.reduce((ema, value) => value * multiplier + ema * (1 - multiplier), values[0]);
}

export function calculateRsi(closes: number[]) {
  const changes = closes.slice(1).map((close, index) => close - closes[index]);
  const gain = average(changes.map((change) => Math.max(change, 0)));
  const loss = average(changes.map((change) => Math.max(-change, 0)));
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

export function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function calculateVolumeConfirmation(dailyReturn: number, volumeRatio: number) {
  if (Math.abs(dailyReturn) < 0.002 || volumeRatio <= 1) return 0;
  return Math.sign(dailyReturn) * clamp((volumeRatio - 1) * 0.012, 0, 0.024);
}
