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
  targetDate: string;
  createdAt: string;
  baseClose: number;
  predictedClose: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  actualClose?: number;
}

export interface ForecastSignal {
  label: string;
  value: string;
  direction: "positive" | "negative" | "neutral";
  detail: string;
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
  signals: ForecastSignal[];
  records: ForecastRecord[];
  accuracy: {
    settledCount: number;
    meanAbsolutePercentError: number | null;
    directionalAccuracy: number | null;
  };
}
