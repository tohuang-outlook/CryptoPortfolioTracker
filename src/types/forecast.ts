export interface BitcoinCandle {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ForecastRecord {
  horizon?: "daily" | "weekly";
  targetDate: string;
  createdAt: string;
  baseClose: number;
  predictedClose: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  actualClose?: number;
}

export interface ForecastHorizon {
  targetDate: string;
  predictedClose: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  expectedReturnPercent: number;
  direction: "Bullish" | "Bearish" | "Neutral";
}

export interface ForecastSignal {
  label: string;
  value: string;
  direction: "positive" | "negative" | "neutral";
  detail: string;
}

export type ForecastModelId = "technical" | "trend" | "meanReversion";
export type MarketRegimeId = "uptrend" | "downtrend" | "range" | "volatile";

export interface MarketRegime {
  id: MarketRegimeId;
  label: string;
  detail: string;
}

export interface RangeCalibration {
  settledCount: number;
  observedCoverage: number | null;
  targetCoverage: number;
  multiplier: number;
}

export interface ForecastModelPerformance {
  id: ForecastModelId;
  label: string;
  meanAbsolutePercentError: number;
  directionalAccuracy: number;
  weight: number;
  evaluatedDays: number;
}

export interface BitcoinForecast {
  asOfDate: string;
  currentClose: number;
  targetDate: string;
  predictedClose: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  expectedReturnPercent: number;
  direction: "Bullish" | "Bearish" | "Neutral";
  weeklyForecast: ForecastHorizon;
  signals: ForecastSignal[];
  modelLeaderboard: ForecastModelPerformance[];
  marketRegime: MarketRegime;
  rangeCalibration: RangeCalibration;
  records: ForecastRecord[];
  accuracy: {
    settledCount: number;
    meanAbsolutePercentError: number | null;
    directionalAccuracy: number | null;
  };
  weeklyAccuracy: {
    settledCount: number;
    meanAbsolutePercentError: number | null;
    directionalAccuracy: number | null;
  };
}
