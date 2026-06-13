import { useEffect, useState } from "react";
import { fetchSupportedPrices } from "../data/priceService";
import type { PriceMap } from "../types/portfolio";

const EMPTY_PRICES: PriceMap = {
  BTC: 0,
  ETH: 0,
  SOL: 0,
  XRP: 0,
  ADA: 0,
  DOGE: 0
};

export function usePrices() {
  const [prices, setPrices] = useState<PriceMap>(EMPTY_PRICES);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "loading"
  );
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let latestRequestId = 0;

    async function load() {
      const requestId = latestRequestId + 1;
      latestRequestId = requestId;
      setStatus("loading");

      try {
        const nextPrices = await fetchSupportedPrices();

        if (!active || requestId !== latestRequestId) {
          return;
        }

        setPrices(nextPrices);
        setStatus("ready");
        setLastUpdated(new Date().toISOString());
      } catch {
        if (!active || requestId !== latestRequestId) {
          return;
        }

        setStatus("error");
      }
    }

    void load();
    const timer = window.setInterval(load, 60000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return { prices, status, lastUpdated };
}
