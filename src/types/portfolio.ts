export type SupportedAssetSymbol =
  | "BTC"
  | "ETH"
  | "SOL"
  | "XRP"
  | "ADA"
  | "DOGE";

export type TransactionType = "buy";

export interface Transaction {
  id: string;
  assetSymbol: SupportedAssetSymbol;
  assetName: string;
  type: TransactionType;
  amountInvested: number;
  purchasePrice: number;
  quantity: number;
  purchaseDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type PriceMap = Record<SupportedAssetSymbol, number>;

export interface AssetSummary {
  assetSymbol: SupportedAssetSymbol;
  assetName: string;
  totalInvested: number;
  totalQuantity: number;
  averageBuyPrice: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  allocationPercent: number;
}

export interface PortfolioSummary {
  totalInvested: number;
  portfolioValue: number;
  totalUnrealizedPnL: number;
  totalReturnPercent: number;
}

export interface PortfolioSnapshot {
  assets: AssetSummary[];
  portfolio: PortfolioSummary;
}

export interface SupportedAssetDefinition {
  symbol: SupportedAssetSymbol;
  name: string;
}
