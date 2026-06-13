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
    BTC: data.bitcoin?.usd ?? 0,
    ETH: data.ethereum?.usd ?? 0,
    SOL: data.solana?.usd ?? 0,
    XRP: data.ripple?.usd ?? 0,
    ADA: data.cardano?.usd ?? 0,
    DOGE: data.dogecoin?.usd ?? 0
  };
}
