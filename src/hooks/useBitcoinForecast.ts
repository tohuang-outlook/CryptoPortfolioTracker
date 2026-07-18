import { useEffect, useState } from "react";
import { fetchAssetForecast } from "../data/bitcoinForecastService";
import type { BitcoinForecast, ForecastAsset } from "../types/forecast";

export function useBitcoinForecast(assetSymbol: ForecastAsset) {
  const [forecast, setForecast] = useState<BitcoinForecast | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setStatus("loading");
      try {
        const nextForecast = await fetchAssetForecast(assetSymbol);
        if (!active) return;
        setForecast(nextForecast);
        setStatus("ready");
        setError(null);
      } catch {
        if (!active) return;
        setStatus("error");
        setError("Coinbase daily market data is unavailable right now. Please try again shortly.");
      }
    }

    void load();
    const timer = window.setInterval(load, 60 * 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [assetSymbol]);

  return { forecast, status, error };
}
