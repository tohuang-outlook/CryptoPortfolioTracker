import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import App from "./App";
import { usePrices } from "./hooks/usePrices";

vi.mock("./hooks/usePrices", () => ({
  usePrices: vi.fn()
}));

const mockedUsePrices = vi.mocked(usePrices);

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("./components/TransactionForm");
  vi.doUnmock("./hooks/usePrices");
});

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: createStorageMock(),
    configurable: true
  });
  vi.clearAllMocks();
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

test("shows an empty-state message before any transactions are added", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { name: /add your first crypto buy/i })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: /^holdings$/i })
  ).not.toBeInTheDocument();
});

test("adds a BTC transaction and updates dashboard totals", async () => {
  const user = userEvent.setup();

  render(<App />);

  await user.selectOptions(screen.getByLabelText(/asset/i), "BTC");
  await user.type(screen.getByLabelText(/amount invested/i), "1000");
  await user.type(screen.getByLabelText(/purchase price/i), "50000");
  await user.type(screen.getByLabelText(/purchase date/i), "2026-06-01");
  await user.click(screen.getByRole("button", { name: /save transaction/i }));

  const summary = screen.getByLabelText(/portfolio summary/i);
  const holdings = screen.getByRole("region", { name: /^holdings$/i });

  expect(within(summary).getByText("$1,000.00")).toBeInTheDocument();
  expect(within(holdings).getByText("Bitcoin")).toBeInTheDocument();
  expect(within(holdings).getByText("0.02000000")).toBeInTheDocument();
});

test("shows holdings, allocation, and history after a transaction is added", async () => {
  const user = userEvent.setup();

  render(<App />);

  await user.selectOptions(screen.getByLabelText(/asset/i), "ETH");
  await user.type(screen.getByLabelText(/amount invested/i), "4000");
  await user.type(screen.getByLabelText(/purchase price/i), "2000");
  await user.type(screen.getByLabelText(/purchase date/i), "2026-06-02");
  await user.click(screen.getByRole("button", { name: /save transaction/i }));

  expect(screen.getByRole("heading", { name: /^holdings$/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /^allocation$/i })).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: /transaction history/i })
  ).toBeInTheDocument();
});

test("hydrates totals and holdings from persisted transactions", () => {
  window.localStorage.setItem(
    "crypto-portfolio-transactions",
    JSON.stringify([
      {
        id: "btc-1",
        assetSymbol: "BTC",
        assetName: "Bitcoin",
        type: "buy",
        amountInvested: 1000,
        purchasePrice: 50000,
        quantity: 0.02,
        purchaseDate: "2026-06-01",
        notes: "",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z"
      }
    ])
  );

  render(<App />);

  const summary = screen.getByLabelText(/portfolio summary/i);
  const holdings = screen.getByRole("region", { name: /^holdings$/i });

  expect(within(summary).getByText("$1,000.00")).toBeInTheDocument();
  expect(within(holdings).getByText("Bitcoin")).toBeInTheDocument();
  expect(within(holdings).getByText("0.02000000")).toBeInTheDocument();
});

test("shows an error and does not update totals when persistence fails", async () => {
  const user = userEvent.setup();

  Object.defineProperty(window, "localStorage", {
    value: createStorageMock({ failOnSet: true }),
    configurable: true
  });

  render(<App />);

  await user.type(screen.getByLabelText(/amount invested/i), "1000");
  await user.type(screen.getByLabelText(/purchase price/i), "50000");
  await user.type(screen.getByLabelText(/purchase date/i), "2026-06-01");
  await user.click(screen.getByRole("button", { name: /save transaction/i }));

  expect(
    screen.getByText(/unable to save transaction/i)
  ).toBeInTheDocument();
  expect(screen.queryByText("$1,000.00")).not.toBeInTheDocument();
  expect(screen.queryByText("0.02000000 BTC")).not.toBeInTheDocument();
});

test("keeps both transactions when one event submits twice quickly", async () => {
  vi.resetModules();
  vi.doMock("./hooks/usePrices", () => ({
    usePrices: () => ({
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
    })
  }));
  vi.doMock("./components/TransactionForm", () => ({
    TransactionForm: ({
      onSubmit
    }: {
      onSubmit: (values: {
        assetSymbol: string;
        amountInvested: string;
        purchasePrice: string;
        purchaseDate: string;
        notes: string;
      }) => { success: true } | { success: false; error: string };
    }) => (
      <button
        type="button"
        onClick={() => {
          onSubmit({
            assetSymbol: "BTC",
            amountInvested: "1000",
            purchasePrice: "50000",
            purchaseDate: "2026-06-01",
            notes: ""
          });
          onSubmit({
            assetSymbol: "ETH",
            amountInvested: "4000",
            purchasePrice: "2000",
            purchaseDate: "2026-06-02",
            notes: ""
          });
        }}
      >
        Trigger Double Submit
      </button>
    )
  }));

  const { default: DoubleSubmitApp } = await import("./App");
  const user = userEvent.setup();

  render(<DoubleSubmitApp />);

  await user.click(
    screen.getByRole("button", { name: /trigger double submit/i })
  );

  const summary = screen.getByLabelText(/portfolio summary/i);
  const history = screen.getByRole("region", { name: /transaction history/i });
  const holdings = screen.getByRole("region", { name: /^holdings$/i });
  const historyItems = within(history).getAllByRole("listitem");

  expect(within(summary).getByText("$5,000.00")).toBeInTheDocument();
  expect(within(holdings).getByText("0.02000000")).toBeInTheDocument();
  expect(within(holdings).getByText("2.00000000")).toBeInTheDocument();
  expect(within(historyItems[0]).getByText(/ethereum/i)).toBeInTheDocument();
  expect(within(historyItems[1]).getByText(/bitcoin/i)).toBeInTheDocument();
});

function createStorageMock(options?: { failOnSet?: boolean }): Storage {
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
      if (options?.failOnSet) {
        throw new Error("QuotaExceededError");
      }
      store.set(key, value);
    }
  };
}
