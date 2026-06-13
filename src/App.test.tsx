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
    screen.queryByText(/allocation and holdings will appear after your first buy/i)
  ).not.toBeInTheDocument();
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

test("recalculates purchase price when amount invested and purchase shares are entered", async () => {
  const user = userEvent.setup();

  render(<App />);

  await user.type(screen.getByLabelText(/amount invested/i), "1000");
  await user.type(screen.getByLabelText(/purchase shares/i), "0.02");

  expect(screen.getByLabelText(/purchase price/i)).toHaveValue(50000);
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
        purchaseShares: string;
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
            purchaseShares: "",
            purchaseDate: "2026-06-01",
            notes: ""
          });
          onSubmit({
            assetSymbol: "ETH",
            amountInvested: "4000",
            purchasePrice: "2000",
            purchaseShares: "",
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

test("edits an existing transaction and updates portfolio summary", async () => {
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
  vi.doMock("./components/TransactionHistory", () => ({
    TransactionHistory: ({
      onUpdateTransaction
    }: {
      onUpdateTransaction: (values: {
        id: string;
        assetSymbol: string;
        amountInvested: string;
        purchasePrice: string;
        purchaseShares: string;
        purchaseDate: string;
        notes: string;
      }) => { success: true } | { success: false; error: string };
    }) => (
      <button
        type="button"
        onClick={() =>
          onUpdateTransaction({
            id: "btc-1",
            assetSymbol: "BTC",
            amountInvested: "1500",
            purchasePrice: "50000",
            purchaseShares: "",
            purchaseDate: "2026-06-01",
            notes: "starter"
          })
        }
      >
        Trigger Edit Bitcoin
      </button>
    )
  }));

  seedSingleBtcTransaction();
  const { default: EditApp } = await import("./App");
  const user = userEvent.setup();

  render(<EditApp />);

  await user.click(screen.getByRole("button", { name: /trigger edit bitcoin/i }));

  const summary = screen.getByLabelText(/portfolio summary/i);
  expect(within(summary).getByText("$1,500.00")).toBeInTheDocument();
});

test("deletes an existing transaction after confirmation", async () => {
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
  vi.doMock("./components/TransactionHistory", () => ({
    TransactionHistory: ({
      onDeleteTransaction
    }: {
      onDeleteTransaction: (id: string) => { success: true } | { success: false; error: string };
    }) => (
      <button
        type="button"
        onClick={() => onDeleteTransaction("eth-1")}
      >
        Confirm Delete Ethereum
      </button>
    )
  }));

  window.localStorage.setItem(
    "crypto-portfolio-transactions",
    JSON.stringify([
      {
        id: "eth-1",
        assetSymbol: "ETH",
        assetName: "Ethereum",
        type: "buy",
        amountInvested: 4000,
        purchasePrice: 2000,
        quantity: 2,
        purchaseDate: "2026-06-02",
        notes: "",
        createdAt: "2026-06-02T00:00:00.000Z",
        updatedAt: "2026-06-02T00:00:00.000Z"
      }
    ])
  );

  const { default: DeleteApp } = await import("./App");
  const user = userEvent.setup();

  render(<DeleteApp />);

  await user.click(screen.getByRole("button", { name: /confirm delete ethereum/i }));

  expect(
    screen.getByRole("heading", { name: /add your first crypto buy/i })
  ).toBeInTheDocument();
});

test("cancels inline edit without changing stored values", async () => {
  const user = userEvent.setup();
  seedSingleBtcTransaction();

  render(<App />);

  const history = screen.getByRole("region", { name: /transaction history/i });
  await user.click(
    within(history).getByRole("button", { name: /edit bitcoin/i })
  );
  await user.clear(within(history).getByLabelText(/amount invested/i));
  await user.type(within(history).getByLabelText(/amount invested/i), "1800");
  await user.click(
    within(history).getByRole("button", { name: /cancel edit bitcoin/i })
  );

  const summary = screen.getByLabelText(/portfolio summary/i);
  expect(within(summary).getByText("$1,000.00")).toBeInTheDocument();
  expect(screen.queryByDisplayValue("1800")).not.toBeInTheDocument();
});

test("requires delete confirmation and supports cancel", async () => {
  const user = userEvent.setup();
  seedSingleBtcTransaction();

  render(<App />);

  const history = screen.getByRole("region", { name: /transaction history/i });
  await user.click(
    within(history).getByRole("button", { name: /delete bitcoin/i })
  );

  expect(within(history).getByText(/confirm deletion/i)).toBeInTheDocument();

  await user.click(
    within(history).getByRole("button", { name: /cancel delete bitcoin/i })
  );

  expect(within(history).getByText(/bitcoin/i)).toBeInTheDocument();
  expect(
    within(history).queryByText(/confirm deletion/i)
  ).not.toBeInTheDocument();
});

test("shows an inline error when edited transaction persistence fails", async () => {
  const storage = createStorageMock();
  storage.setItem(
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
        notes: "starter",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z"
      }
    ])
  );
  storage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true
  });

  const user = userEvent.setup();
  render(<App />);

  const history = screen.getByRole("region", { name: /transaction history/i });
  await user.click(
    within(history).getByRole("button", { name: /edit bitcoin/i })
  );
  await user.clear(within(history).getByLabelText(/amount invested/i));
  await user.type(within(history).getByLabelText(/amount invested/i), "1500");
  await user.click(within(history).getByRole("button", { name: /save bitcoin/i }));

  expect(
    within(history).getByText(/unable to save transaction/i)
  ).toBeInTheDocument();
  expect(within(history).getByDisplayValue("1500")).toBeInTheDocument();
});

test("shows an inline error when delete persistence fails", async () => {
  const storage = createStorageMock();
  storage.setItem(
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
        notes: "starter",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z"
      }
    ])
  );
  storage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true
  });

  const user = userEvent.setup();
  render(<App />);

  const history = screen.getByRole("region", { name: /transaction history/i });
  await user.click(
    within(history).getByRole("button", { name: /delete bitcoin/i })
  );
  await user.click(
    within(history).getByRole("button", { name: /confirm delete bitcoin/i })
  );

  expect(
    within(history).getByText(/unable to save transaction/i)
  ).toBeInTheDocument();
  expect(within(history).getByText(/bitcoin/i)).toBeInTheDocument();
});

test("only one transaction can be in edit mode at a time", async () => {
  seedTwoTransactions();
  const user = userEvent.setup();

  render(<App />);

  const history = screen.getByRole("region", { name: /transaction history/i });
  await user.click(
    within(history).getByRole("button", { name: /edit bitcoin/i })
  );
  expect(
    within(history).getByRole("button", { name: /save bitcoin/i })
  ).toBeInTheDocument();

  await user.click(
    within(history).getByRole("button", { name: /edit ethereum/i })
  );

  expect(
    within(history).queryByRole("button", { name: /save bitcoin/i })
  ).not.toBeInTheDocument();
  expect(
    within(history).getByRole("button", { name: /save ethereum/i })
  ).toBeInTheDocument();
});

test("recalculates purchase price inside inline edit when purchase shares is changed", async () => {
  seedSingleBtcTransaction();
  const user = userEvent.setup();

  render(<App />);

  const history = screen.getByRole("region", { name: /transaction history/i });
  await user.click(
    within(history).getByRole("button", { name: /edit bitcoin/i })
  );
  await user.clear(within(history).getByLabelText(/purchase shares/i));
  await user.type(
    within(history).getByLabelText(/purchase shares/i),
    "0.01"
  );

  expect(within(history).getByLabelText(/purchase price/i)).toHaveValue(100000);
});

function seedSingleBtcTransaction() {
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
        notes: "starter",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z"
      }
    ])
  );
}

function seedTwoTransactions() {
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
        notes: "starter",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z"
      },
      {
        id: "eth-1",
        assetSymbol: "ETH",
        assetName: "Ethereum",
        type: "buy",
        amountInvested: 4000,
        purchasePrice: 2000,
        quantity: 2,
        purchaseDate: "2026-06-02",
        notes: "",
        createdAt: "2026-06-02T00:00:00.000Z",
        updatedAt: "2026-06-02T00:00:00.000Z"
      }
    ])
  );
}

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
