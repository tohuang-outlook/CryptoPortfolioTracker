export interface BitcoinCandle {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ForecastAsset = "BTC" | "ETH" | "ADA" | "SOL" | "XRP" | "DOGE";

export interface ForecastRecord {
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
  marketRegime?: MarketRegimeId;
  direction?: "Bullish" | "Bearish" | "Neutral";
  expectedReturnPercent?: number;
  modelWeights?: Partial<Record<ForecastModelId, number>>;
  derivativeData?: DerivativeMarketData;
  onChainData?: OnChainMarketData;
  onChainRegime?: OnChainRegime;
  microstructureData?: MicrostructureSnapshot;
  hasForecastEdge?: boolean;
  multiTimeframe?: MultiTimeframeSignal;
  directionModel?: DirectionModelForecast;
  regimeReliability?: RegimeReliability;
  decision?: ForecastDecision;
}

export interface MacroEventRisk {
  eventName: string;
  eventDate: string;
  daysUntil: number;
  confidencePenalty: number;
  rangeMultiplier: number;
}

export interface ConfidenceCalibrationBand {
  label: string;
  settledCount: number;
  averageConfidence: number;
  rangeHitRate: number | null;
}

export interface ForecastDataQuality {
  score: number;
  missingSources: string[];
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

export type TimeframeAlignment = "bullish" | "bearish" | "neutral" | "mixed" | "unavailable";
export type ForecastDecisionStatus = "trade" | "watch" | "noEdge";

export interface MultiTimeframeSignal {
  hourlyTrend: number | null;
  fourHourTrend: number | null;
  dailyTrend: number;
  alignment: TimeframeAlignment;
  adjustment: number;
  confidenceAdjustment: number;
}

export interface ForecastDecision {
  status: ForecastDecisionStatus;
  score: number;
  detail: string;
}

export interface DirectionModelForecast {
  direction: "Bullish" | "Bearish" | "Neutral";
  probabilityUp: number;
  probabilityDown: number;
  probabilityNeutral: number;
  directionalAccuracy: number;
  evaluatedDays: number;
}

export interface VolatilityModelForecast {
  expectedDailyMovePercent: number;
  shortTermVolatilityPercent: number;
  mediumTermVolatilityPercent: number;
  outlook: "calm" | "normal" | "elevated";
}

export interface RegimeReliability {
  marketRegime: MarketRegimeId;
  evaluatedDays: number;
  directionalAccuracy: number;
  meanAbsolutePercentError: number;
  returnMultiplier: number;
  confidencePenalty: number;
  isValidated: boolean;
}

export interface DirectionProbabilityCalibration {
  settledCount: number;
  averageProbability: number | null;
  realizedAccuracy: number | null;
  calibrationGap: number | null;
  status: "learning" | "calibrated" | "caution";
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
  assetSymbol: ForecastAsset;
  activeAddresses: number;
  transactionCount: number;
  totalFeesNative: number;
  activeAddressesChange7Day: number;
  transactionCountChange7Day: number;
  mvrv: number | null;
  mvrvChange30Day: number | null;
  asOfDate: string;
}

export type OnChainRegimeId = "accumulation" | "neutral" | "distribution" | "capitulation" | "unavailable";

export interface OnChainRegime {
  id: OnChainRegimeId;
  label: string;
  detail: string;
  rangeMultiplier: number;
  confidencePenalty: number;
}

export interface MicrostructureSnapshot {
  assetSymbol: ForecastAsset;
  capturedAt: string;
  bidDepthUsd: number;
  askDepthUsd: number;
  orderBookImbalance: number;
  tradeFlowImbalance: number | null;
  spreadPercent: number;
  tradeCount: number;
}

export type ForecastFeatureId = "technical" | "trend" | "meanReversion" | "volume";

export interface FeatureAblationResult {
  id: ForecastFeatureId;
  label: string;
  meanAbsolutePercentError: number;
  directionalAccuracy: number;
  errorDelta: number;
  evaluatedDays: number;
  status: "helpful" | "neutral" | "paused" | "learning";
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
  multiTimeframe: MultiTimeframeSignal;
  directionModel: DirectionModelForecast;
  volatilityModel: VolatilityModelForecast;
  regimeReliability: RegimeReliability;
  directionCalibration: DirectionProbabilityCalibration;
  decision: ForecastDecision;
  weeklyForecast: ForecastHorizon;
  signals: ForecastSignal[];
  modelLeaderboard: ForecastModelPerformance[];
  marketRegime: MarketRegime;
  rangeCalibration: RangeCalibration;
  derivatives: DerivativeMarketData | null;
  onChain: OnChainMarketData | null;
  onChainRegime: OnChainRegime;
  microstructure: MicrostructureSnapshot | null;
  microstructureSamples: number;
  featureAblation: FeatureAblationResult[];
  macroRisk: MacroEventRisk | null;
  confidenceCalibration: ConfidenceCalibrationBand[];
  dataQuality: ForecastDataQuality;
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
