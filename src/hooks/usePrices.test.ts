import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePrices } from "./usePrices";
import { fetchSupportedPrices } from "../data/priceService";
import type { PriceMap } from "../types/portfolio";

vi.mock("../data/priceService", () => ({
  fetchSupportedPrices: vi.fn()
}));

const mockedFetchSupportedPrices = vi.mocked(fetchSupportedPrices);

const FIRST_PRICES: PriceMap = {
  BTC: 65000,
  ETH: 2500,
  SOL: 150,
  XRP: 1.1,
  ADA: 0.45,
  DOGE: 0.2
};

const SECOND_PRICES: PriceMap = {
  BTC: 70000,
  ETH: 2700,
  SOL: 175,
  XRP: 1.2,
  ADA: 0.5,
  DOGE: 0.25
};

describe("usePrices", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it("loads prices and transitions to ready state", async () => {
    mockedFetchSupportedPrices.mockResolvedValueOnce(FIRST_PRICES);

    const { result } = renderHook(() => usePrices());

    expect(result.current.status).toBe("loading");

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    expect(result.current.prices).toEqual(FIRST_PRICES);
    expect(result.current.lastUpdated).toEqual(expect.any(String));
  });

  it("moves to error state when loading prices fails", async () => {
    mockedFetchSupportedPrices.mockRejectedValueOnce(
      new Error("Unable to fetch prices")
    );

    const { result } = renderHook(() => usePrices());

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.lastUpdated).toBeNull();
    expect(result.current.prices).toEqual({
      BTC: 0,
      ETH: 0,
      SOL: 0,
      XRP: 0,
      ADA: 0,
      DOGE: 0
    });
  });

  it("ignores older poll results when a newer request resolves first", async () => {
    vi.useFakeTimers();

    const firstRequest = createDeferred<PriceMap>();
    const secondRequest = createDeferred<PriceMap>();

    mockedFetchSupportedPrices
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise);

    const { result } = renderHook(() => usePrices());

    expect(mockedFetchSupportedPrices).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(mockedFetchSupportedPrices).toHaveBeenCalledTimes(2);

    await act(async () => {
      secondRequest.resolve(SECOND_PRICES);
      await Promise.resolve();
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.prices).toEqual(SECOND_PRICES);

    await act(async () => {
      firstRequest.resolve(FIRST_PRICES);
      await Promise.resolve();
    });

    expect(result.current.prices).toEqual(SECOND_PRICES);
  });
});

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}
