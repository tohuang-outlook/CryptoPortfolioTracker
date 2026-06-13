import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { usePrices } from "./hooks/usePrices";

vi.mock("./hooks/usePrices", () => ({
  usePrices: vi.fn()
}));

const mockedUsePrices = vi.mocked(usePrices);

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: createStorageMock(),
    configurable: true
  });
  mockedUsePrices.mockReturnValue({
    prices: {
      BTC: 60000,
      ETH: 2500,
      SOL: 150,
      XRP: 1.1,
      ADA: 0.45,
      DOGE: 0.2
    },
    status: "ready",
    lastUpdated: "2026-06-13T12:00:00.000Z"
  });
});

test("renders the portfolio tracker heading", () => {
  render(<App />);
  expect(
    screen.getByRole("heading", { name: /crypto portfolio tracker/i })
  ).toBeInTheDocument();
});

test("adds a BTC transaction and updates dashboard totals", async () => {
  const user = userEvent.setup();

  render(<App />);

  await user.selectOptions(screen.getByLabelText(/asset/i), "BTC");
  await user.type(screen.getByLabelText(/amount invested/i), "1000");
  await user.type(screen.getByLabelText(/purchase price/i), "50000");
  await user.type(screen.getByLabelText(/purchase date/i), "2026-06-01");
  await user.click(screen.getByRole("button", { name: /save transaction/i }));

  expect(screen.getByText("$1,000.00")).toBeInTheDocument();
  expect(screen.getByText("0.02000000 BTC")).toBeInTheDocument();
});

function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.get(key) ?? null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, value);
    }
  };
}
