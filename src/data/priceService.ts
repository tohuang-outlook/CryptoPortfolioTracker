import type { PriceMap } from "../types/portfolio";

const COINGECKO_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,cardano,dogecoin&vs_currencies=usd";

const COINBASE_SPOT_URL_BY_SYMBOL = {
  BTC: "https://api.coinbase.com/v2/prices/BTC-USD/spot",
  ETH: "https://api.coinbase.com/v2/prices/ETH-USD/spot",
  SOL: "https://api.coinbase.com/v2/prices/SOL-USD/spot",
  XRP: "https://api.coinbase.com/v2/prices/XRP-USD/spot",
  ADA: "https://api.coinbase.com/v2/prices/ADA-USD/spot",
  DOGE: "https://api.coinbase.com/v2/prices/DOGE-USD/spot"
} as const;

interface CoinGeckoProviderResponse {
  bitcoin?: { usd?: number };
  ethereum?: { usd?: number };
  solana?: { usd?: number };
  ripple?: { usd?: number };
  cardano?: { usd?: number };
  dogecoin?: { usd?: number };
}

interface CoinbaseSpotResponse {
  data?: {
    amount?: string;
  };
}

export async function fetchSupportedPrices(): Promise<PriceMap> {
  try {
    return await fetchCoinbasePrices();
  } catch {
    return fetchCoinGeckoPrices();
  }
}

async function fetchCoinGeckoPrices(): Promise<PriceMap> {
  const response = await fetch(COINGECKO_PRICE_URL);
  if (!response.ok) {
    throw new Error("Unable to fetch prices");
  }

  const data = (await response.json()) as CoinGeckoProviderResponse;

  return {
    BTC: readUsdPrice(data.bitcoin?.usd),
    ETH: readUsdPrice(data.ethereum?.usd),
    SOL: readUsdPrice(data.solana?.usd),
    XRP: readUsdPrice(data.ripple?.usd),
    ADA: readUsdPrice(data.cardano?.usd),
    DOGE: readUsdPrice(data.dogecoin?.usd)
  };
}

async function fetchCoinbasePrices(): Promise<PriceMap> {
  const responses = await Promise.all(
    Object.entries(COINBASE_SPOT_URL_BY_SYMBOL).map(async ([symbol, url]) => {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Unable to fetch prices");
      }

      const data = (await response.json()) as CoinbaseSpotResponse;
      return [symbol, readCoinbaseAmount(data.data?.amount)] as const;
    })
  );

  return Object.fromEntries(responses) as PriceMap;
}

function readUsdPrice(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Malformed price payload");
  }

  return value;
}

function readCoinbaseAmount(value: unknown): number {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Malformed price payload");
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error("Malformed price payload");
  }

  return parsedValue;
}
