import type { BitcoinCandle, ForecastModelId, ForecastModelPerformance } from "../types/forecast.js";

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

  const leaderboard = backtestModels(candles);
  const currentReturns = models.map((model) => ({ id: model.id, value: model.predictReturn(candles) }));
  const expectedReturn = currentReturns.reduce(
    (sum, prediction) => sum + prediction.value * leaderboard.find((model) => model.id === prediction.id)!.weight,
    0
  );

  return { expectedReturn: clamp(expectedReturn, -0.12, 0.12), leaderboard };
}

function backtestModels(candles: BitcoinCandle[]): ForecastModelPerformance[] {
  const startIndex = Math.max(MINIMUM_HISTORY - 1, candles.length - BACKTEST_WINDOW - 1);
  const samples = models.map((model) => {
    const outcomes: Array<{ absoluteError: number; correctDirection: boolean }> = [];

    for (let index = startIndex; index < candles.length - 1; index += 1) {
      const history = candles.slice(0, index + 1);
      const baseClose = history[history.length - 1].close;
      const predictedClose = baseClose * (1 + model.predictReturn(history));
      const actualClose = candles[index + 1].close;
      outcomes.push({
        absoluteError: Math.abs(actualClose - predictedClose) / actualClose,
        correctDirection: Math.sign(predictedClose - baseClose) === Math.sign(actualClose - baseClose)
      });
    }

    return {
      ...model,
      meanAbsolutePercentError: average(outcomes.map((outcome) => outcome.absoluteError)) * 100,
      directionalAccuracy: (outcomes.filter((outcome) => outcome.correctDirection).length / outcomes.length) * 100,
      evaluatedDays: outcomes.length
    };
  });
  const scores = samples.map((sample) => 1 / Math.max(sample.meanAbsolutePercentError, 0.05) * (0.8 + sample.directionalAccuracy / 250));
  const totalScore = average(scores) * scores.length;

  return samples
    .map((sample, index) => ({
      id: sample.id,
      label: sample.label,
      meanAbsolutePercentError: sample.meanAbsolutePercentError,
      directionalAccuracy: sample.directionalAccuracy,
      weight: scores[index] / totalScore,
      evaluatedDays: sample.evaluatedDays
    }))
    .sort((left, right) => right.weight - left.weight);
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
