import type { PriceMap } from "../types/portfolio";

const PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,cardano,dogecoin&vs_currencies=usd";

interface ProviderResponse {
  bitcoin?: { usd?: number };
  ethereum?: { usd?: number };
  solana?: { usd?: number };
  ripple?: { usd?: number };
  cardano?: { usd?: number };
  dogecoin?: { usd?: number };
}

export async function fetchSupportedPrices(): Promise<PriceMap> {
  const response = await fetch(PRICE_URL);

  if (!response.ok) {
    throw new Error("Unable to fetch prices");
  }

  const data = (await response.json()) as ProviderResponse;

  return {
    BTC: readUsdPrice(data.bitcoin?.usd),
    ETH: readUsdPrice(data.ethereum?.usd),
    SOL: readUsdPrice(data.solana?.usd),
    XRP: readUsdPrice(data.ripple?.usd),
    ADA: readUsdPrice(data.cardano?.usd),
    DOGE: readUsdPrice(data.dogecoin?.usd)
  };
}

function readUsdPrice(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Malformed price payload");
  }

  return value;
}
