export interface BitcoinCandle {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ForecastAsset = "BTC" | "ETH";

export interface ForecastRecord {
  assetSymbol?: ForecastAsset;
  horizon?: "daily" | "weekly";
  targetDate: string;
  createdAt: string;
  baseClose: number;
  predictedClose: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  actualClose?: number;
  marketRegime?: MarketRegimeId;
  direction?: "Bullish" | "Bearish" | "Neutral";
  expectedReturnPercent?: number;
  modelWeights?: Partial<Record<ForecastModelId, number>>;
  derivativeData?: DerivativeMarketData;
  onChainData?: OnChainMarketData;
  hasForecastEdge?: boolean;
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

export interface DerivativeMarketData {
  fundingRate: number;
  fundingRate30DayAverage: number;
  openInterestValue: number;
  openInterestChange7Day: number | null;
  asOfDate: string;
}

export interface OnChainMarketData {
  activeAddresses: number;
  transactionCount: number;
  totalFeesNative: number;
  activeAddressesChange7Day: number;
  transactionCountChange7Day: number;
  asOfDate: string;
}

export interface ForecastPerformance {
  meanAbsolutePercentError: number;
  directionalAccuracy: number;
  evaluatedDays: number;
}

export interface ForecastBenchmark {
  ensemble: ForecastPerformance;
  naive: ForecastPerformance;
  trend: ForecastPerformance;
  hasEdge: boolean;
}

export interface ForecastModelPerformance {
  id: ForecastModelId;
  label: string;
  meanAbsolutePercentError: number;
  directionalAccuracy: number;
  weight: number;
  evaluatedDays: number;
  status: "active" | "reduced" | "paused";
}

export interface BitcoinForecast {
  assetSymbol: ForecastAsset;
  assetName: string;
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
  derivatives: DerivativeMarketData | null;
  onChain: OnChainMarketData | null;
  benchmark: ForecastBenchmark;
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
