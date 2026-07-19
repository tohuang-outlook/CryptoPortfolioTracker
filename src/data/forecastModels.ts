import type {
  BitcoinCandle,
  DerivativeMarketData,
  ForecastBenchmark,
  ForecastModelId,
  ForecastModelPerformance,
  MarketRegime,
  MarketRegimeId,
  RangeCalibration
} from "../types/forecast.js";

const MINIMUM_HISTORY = 31;
const BACKTEST_WINDOW = 60;

type ModelDefinition = {
  id: ForecastModelId;
  label: string;
  predictReturn: (candles: BitcoinCandle[]) => number;
};

const models: ModelDefinition[] = [
  {
    id: "technical",
    label: "Technical signals",
    predictReturn(candles) {
      const closes = candles.map((candle) => candle.close);
      const volumes = candles.map((candle) => candle.volume);
      const currentClose = closes[closes.length - 1];
      const trend = average(closes.slice(-7)) / average(closes.slice(-30)) - 1;
      const macd = (calculateEma(closes, 12) - calculateEma(closes, 26)) / currentClose;
      const rsi = calculateRsi(closes.slice(-15));
      const dailyReturn = currentClose / closes[closes.length - 2] - 1;
      const volumeRatio = volumes[volumes.length - 1] / average(volumes.slice(-21, -1));

      return clamp(
        trend * 0.7 + macd * 0.55 - ((rsi - 50) / 100) * 0.012 + calculateVolumeConfirmation(dailyReturn, volumeRatio),
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

export function buildDailyEnsemble(candles: BitcoinCandle[]) {
  if (candles.length < MINIMUM_HISTORY) {
    throw new Error("Not enough Bitcoin history to build the forecast ensemble");
  }

  const marketRegime = detectMarketRegime(candles);
  const leaderboard = backtestModels(candles, marketRegime.id);
  const currentReturns = models.map((model) => ({ id: model.id, value: model.predictReturn(candles) }));
  const expectedReturn = currentReturns.reduce(
    (sum, prediction) => sum + prediction.value * leaderboard.find((model) => model.id === prediction.id)!.weight,
    0
  );

  return { expectedReturn: clamp(expectedReturn, -0.12, 0.12), leaderboard, marketRegime };
}

export function evaluateForecastBenchmark(candles: BitcoinCandle[]): ForecastBenchmark {
  const startIndex = Math.max(MINIMUM_HISTORY + 12, candles.length - BACKTEST_WINDOW - 1);
  const ensembleOutcomes: ForecastOutcome[] = [];
  const naiveOutcomes: ForecastOutcome[] = [];
  const trendOutcomes: ForecastOutcome[] = [];

  for (let index = startIndex; index < candles.length - 1; index += 1) {
    const history = candles.slice(0, index + 1);
    const baseClose = history[history.length - 1].close;
    const weights = backtestModels(history, detectMarketRegime(history).id);
    const ensembleReturn = models.reduce(
      (sum, model) => sum + model.predictReturn(history) * weights.find((item) => item.id === model.id)!.weight,
      0
    );
    const actualClose = candles[index + 1].close;
    ensembleOutcomes.push(makeOutcome(baseClose, baseClose * (1 + ensembleReturn), actualClose));
    naiveOutcomes.push(makeOutcome(baseClose, baseClose, actualClose));
    trendOutcomes.push(makeOutcome(baseClose, baseClose * (1 + models[1].predictReturn(history)), actualClose));
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

export function calculateDerivativeAdjustment(data: DerivativeMarketData | null, priceTrend: number) {
  if (!data) return 0;

  const fundingSpread = data.fundingRate - data.fundingRate30DayAverage;
  const fundingAdjustment = fundingSpread > 0.00035 ? -0.004 : fundingSpread < -0.00025 ? 0.003 : 0;
  const openInterestAdjustment = data.openInterestChange7Day !== null && Math.abs(data.openInterestChange7Day) >= 0.08
    ? Math.sign(priceTrend) * Math.sign(data.openInterestChange7Day) * 0.003
    : 0;

  return clamp(fundingAdjustment + openInterestAdjustment, -0.007, 0.007);
}

function backtestModels(candles: BitcoinCandle[], activeRegime: MarketRegimeId): ForecastModelPerformance[] {
  const startIndex = Math.max(MINIMUM_HISTORY - 1, candles.length - BACKTEST_WINDOW - 1);
  const samples = models.map((model) => {
    const outcomes: Array<{ absoluteError: number; correctDirection: boolean; regime: MarketRegimeId }> = [];

    for (let index = startIndex; index < candles.length - 1; index += 1) {
      const history = candles.slice(0, index + 1);
      const baseClose = history[history.length - 1].close;
      const predictedClose = baseClose * (1 + model.predictReturn(history));
      const actualClose = candles[index + 1].close;
      outcomes.push({
        absoluteError: Math.abs(actualClose - predictedClose) / actualClose,
        correctDirection: Math.sign(predictedClose - baseClose) === Math.sign(actualClose - baseClose),
        regime: detectMarketRegime(history).id
      });
    }

    const regimeOutcomes = outcomes.filter((outcome) => outcome.regime === activeRegime);
    const evaluatedOutcomes = regimeOutcomes.length >= 12 ? regimeOutcomes : outcomes;

    return {
      ...model,
      meanAbsolutePercentError: average(evaluatedOutcomes.map((outcome) => outcome.absoluteError)) * 100,
      directionalAccuracy: (evaluatedOutcomes.filter((outcome) => outcome.correctDirection).length / evaluatedOutcomes.length) * 100,
      evaluatedDays: evaluatedOutcomes.length
    };
  });
  const regimeMultipliers = getRegimeMultipliers(activeRegime);
  const averageError = average(samples.map((sample) => sample.meanAbsolutePercentError));
  const statuses = samples.map((sample) => {
    if (sample.directionalAccuracy < 35 && sample.meanAbsolutePercentError > averageError * 1.35) return "paused" as const;
    if (sample.directionalAccuracy < 42 && sample.meanAbsolutePercentError > averageError * 1.15) return "reduced" as const;
    return "active" as const;
  });
  const scores = samples.map((sample, index) => {
    const statusMultiplier = statuses[index] === "paused" ? 0 : statuses[index] === "reduced" ? 0.35 : 1;
    return regimeMultipliers[sample.id] / Math.max(sample.meanAbsolutePercentError, 0.05) * (0.8 + sample.directionalAccuracy / 250) * statusMultiplier;
  });
  const totalScore = average(scores) * scores.length;

  return samples
    .map((sample, index) => ({
      id: sample.id,
      label: sample.label,
      meanAbsolutePercentError: sample.meanAbsolutePercentError,
      directionalAccuracy: sample.directionalAccuracy,
      weight: scores[index] / totalScore,
      evaluatedDays: sample.evaluatedDays,
      status: statuses[index]
    }))
    .sort((left, right) => right.weight - left.weight);
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
