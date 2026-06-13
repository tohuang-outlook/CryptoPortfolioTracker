import { SUPPORTED_ASSETS } from "../constants/assets";
import type {
  AssetSummary,
  PortfolioSnapshot,
  PortfolioSummary,
  PriceMap,
  Transaction
} from "../types/portfolio";

export function buildPortfolioSnapshot(
  transactions: Transaction[],
  prices: PriceMap
): PortfolioSnapshot {
  const groupedTransactions = new Map<
    Transaction["assetSymbol"],
    Transaction[]
  >();

  for (const transaction of transactions) {
    const existingTransactions =
      groupedTransactions.get(transaction.assetSymbol) ?? [];
    existingTransactions.push(transaction);
    groupedTransactions.set(transaction.assetSymbol, existingTransactions);
  }

  const assets = SUPPORTED_ASSETS.filter((asset) =>
    groupedTransactions.has(asset.symbol)
  ).map((asset) => {
    const assetTransactions = groupedTransactions.get(asset.symbol) ?? [];
    const totalInvested = assetTransactions.reduce(
      (sum, transaction) => sum + transaction.amountInvested,
      0
    );
    const totalQuantity = assetTransactions.reduce(
      (sum, transaction) => sum + transaction.quantity,
      0
    );
    const averageBuyPrice =
      totalQuantity === 0 ? 0 : totalInvested / totalQuantity;
    const currentPrice = prices[asset.symbol];
    const currentValue = totalQuantity * currentPrice;
    const unrealizedPnL = currentValue - totalInvested;
    const unrealizedPnLPercent =
      totalInvested === 0 ? 0 : unrealizedPnL / totalInvested;

    return {
      assetSymbol: asset.symbol,
      assetName: asset.name,
      totalInvested,
      totalQuantity,
      averageBuyPrice,
      currentPrice,
      currentValue,
      unrealizedPnL,
      unrealizedPnLPercent,
      allocationPercent: 0
    } satisfies AssetSummary;
  });

  const portfolioValue = assets.reduce(
    (sum, asset) => sum + asset.currentValue,
    0
  );

  const assetsWithAllocation = assets.map((asset) => ({
    ...asset,
    allocationPercent:
      portfolioValue === 0 ? 0 : asset.currentValue / portfolioValue
  }));

  const totalInvested = assetsWithAllocation.reduce(
    (sum, asset) => sum + asset.totalInvested,
    0
  );
  const totalUnrealizedPnL = portfolioValue - totalInvested;
  const totalReturnPercent =
    totalInvested === 0 ? 0 : totalUnrealizedPnL / totalInvested;

  const portfolio: PortfolioSummary = {
    totalInvested,
    portfolioValue,
    totalUnrealizedPnL,
    totalReturnPercent
  };

  return {
    assets: assetsWithAllocation,
    portfolio
  };
}
