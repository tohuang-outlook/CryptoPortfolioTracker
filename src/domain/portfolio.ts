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

  const assetPositions = SUPPORTED_ASSETS.filter((asset) =>
    groupedTransactions.has(asset.symbol)
  ).map((asset) => {
    const assetTransactions = groupedTransactions.get(asset.symbol) ?? [];
    const { totalInvested, totalQuantity, totalPurchased, realizedPnL } = calculateOpenPosition(assetTransactions);
    const averageBuyPrice =
      totalQuantity === 0 ? 0 : totalInvested / totalQuantity;
    const currentPrice = prices[asset.symbol] ?? 0;
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
      allocationPercent: 0,
      totalPurchased,
      realizedPnL
    };
  });

  const assets = assetPositions
    .filter((asset) => asset.totalQuantity > 0)
    .map(({ totalPurchased: _totalPurchased, realizedPnL: _realizedPnL, ...asset }) => asset satisfies AssetSummary);

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
  const totalRealizedPnL = assetPositions.reduce(
    (sum, asset) => sum + asset.realizedPnL,
    0
  );
  const totalPurchased = assetPositions.reduce(
    (sum, asset) => sum + asset.totalPurchased,
    0
  );
  const totalPnL = totalUnrealizedPnL + totalRealizedPnL;
  const totalReturnPercent =
    totalPurchased === 0 ? 0 : totalPnL / totalPurchased;

  const portfolio: PortfolioSummary = {
    totalInvested,
    portfolioValue,
    totalUnrealizedPnL,
    totalRealizedPnL,
    totalPnL,
    totalReturnPercent
  };

  return {
    assets: assetsWithAllocation,
    portfolio
  };
}

export function validateTransactionLedger(transactions: Transaction[]) {
  const quantities = new Map<Transaction["assetSymbol"], number>();

  for (const transaction of sortTransactionsChronologically(transactions)) {
    const available = quantities.get(transaction.assetSymbol) ?? 0;
    if (transaction.type === "sell" && transaction.quantity > available + 1e-10) {
      return {
        success: false as const,
        error: `Cannot sell more ${transaction.assetSymbol} than the quantity currently held.`
      };
    }
    quantities.set(
      transaction.assetSymbol,
      transaction.type === "buy"
        ? available + transaction.quantity
        : Math.max(0, available - transaction.quantity)
    );
  }

  return { success: true as const };
}

function calculateOpenPosition(transactions: Transaction[]) {
  let totalInvested = 0;
  let totalQuantity = 0;
  let totalPurchased = 0;
  let realizedPnL = 0;

  for (const transaction of sortTransactionsChronologically(transactions)) {
    if (transaction.type === "buy") {
      totalInvested += transaction.amountInvested;
      totalQuantity += transaction.quantity;
      totalPurchased += transaction.amountInvested;
      continue;
    }

    const averageCost = totalQuantity > 0 ? totalInvested / totalQuantity : 0;
    realizedPnL += transaction.amountInvested - averageCost * transaction.quantity;
    totalInvested = Math.max(0, totalInvested - averageCost * transaction.quantity);
    totalQuantity = Math.max(0, totalQuantity - transaction.quantity);
  }

  return {
    totalInvested: totalQuantity < 1e-10 ? 0 : normaliseNumber(totalInvested),
    totalQuantity: totalQuantity < 1e-10 ? 0 : normaliseNumber(totalQuantity),
    totalPurchased: normaliseNumber(totalPurchased),
    realizedPnL: normaliseNumber(realizedPnL)
  };
}

function sortTransactionsChronologically(transactions: Transaction[]) {
  return [...transactions].sort((left, right) => {
    const dateComparison = left.purchaseDate.localeCompare(right.purchaseDate);
    if (dateComparison !== 0) return dateComparison;
    return left.createdAt.localeCompare(right.createdAt);
  });
}

function normaliseNumber(value: number) {
  return Number(value.toFixed(12));
}
