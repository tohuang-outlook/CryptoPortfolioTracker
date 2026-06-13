# Crypto Portfolio Tracker Design

## Summary

Crypto Portfolio Tracker is a friendly responsive web app for everyday investors who want a simple way to track crypto holdings without using a trader-focused dashboard. The first version focuses on manual buy-entry tracking, automatic portfolio aggregation, and clear portfolio health visibility using locally stored data.

## Product Goals

- Help users quickly understand total invested capital, current portfolio value, unrealized profit and loss, and allocation.
- Replace manual spreadsheet aggregation with a calmer and easier-to-read experience.
- Keep the interaction model close to the user's current Google Sheet workflow so migration feels natural.
- Preserve a clean architecture that can later upgrade from local-only storage to cloud sync.

## Non-Goals For MVP

- No sell transactions
- No realized gain or loss calculations
- No account system or cross-device sync
- No advanced charting or trader tools
- No browser push notifications or price alert engine
- No support for arbitrary long-tail crypto assets

## Target Users

The MVP is for everyday crypto investors who buy and hold a small set of major coins and want a low-stress personal finance style overview rather than an active trading interface.

## Supported Assets

The first release supports these tracked coins with live price lookup:

- BTC
- ETH
- SOL
- XRP
- ADA
- DOGE

The UI and data layer should keep asset definitions centralized so more supported coins can be added later without rewriting the app structure.

## Core User Stories

- As a user, I can add a buy transaction for a supported coin.
- As a user, I can view each buy transaction separately.
- As a user, I can see my total holdings per coin aggregated automatically.
- As a user, I can see my average buy price, current price, current value, and unrealized P&L for each asset.
- As a user, I can see my total portfolio value and overall return at a glance.
- As a user, I can understand how my portfolio is allocated across assets.
- As a user, I can use the app comfortably on desktop or mobile.

## Information Architecture

The MVP should be a single responsive app with three primary areas:

1. Dashboard
2. Add Transaction
3. Transaction History

The dashboard is the default landing view and should contain the most important summary without forcing navigation depth.

## UX Direction

The product should feel closer to a personal finance tracker than a trading terminal.

### Visual Principles

- Friendly and calm
- Clean and easy to scan
- Lightweight, with generous spacing
- Reassuring rather than urgent
- Mobile-friendly without losing desktop clarity

### Interface Direction

- Use a light theme by default.
- Prioritize large summary numbers and strong visual grouping.
- Use green and red carefully for gains and losses, but avoid flashing or high-pressure market styling.
- Present portfolio information in cards and concise tables rather than dense exchange-like panels.

## Data Model

The MVP uses a buy-lot based model because it matches the user's existing spreadsheet workflow.

### Transaction

Each transaction record includes:

- `id`
- `assetSymbol`
- `assetName`
- `type` fixed to `buy` for MVP
- `amountInvested`
- `purchasePrice`
- `quantity`
- `purchaseDate`
- `notes`
- `createdAt`
- `updatedAt`

### Asset Summary

Asset summaries are derived data and should not be manually edited. For each supported coin, the app calculates:

- `totalInvested`
- `totalQuantity`
- `averageBuyPrice`
- `currentPrice`
- `currentValue`
- `unrealizedPnL`
- `unrealizedPnLPercent`
- `allocationPercent`

### Portfolio Summary

The dashboard also derives:

- `totalInvested`
- `portfolioValue`
- `totalUnrealizedPnL`
- `totalReturnPercent`

## Storage Strategy

The first version stores user data locally in the browser. The storage layer should be abstracted behind a repository-style interface so the app can later replace local storage with a cloud-backed provider.

### MVP Storage Requirements

- Persist transactions in browser local storage
- Load transactions on app startup
- Handle empty-state startup cleanly
- Gracefully recover if stored data is malformed by falling back to an empty dataset

## Pricing Data

The app fetches current prices only for the supported major coins. Price data should be treated as read-only external data and separated from user transaction storage.

### Pricing Requirements

- Show the latest fetched price for each supported asset
- Recompute asset summaries when fresh prices arrive
- Show a loading or stale-data state if prices are unavailable
- Keep the UI usable even if price fetching fails temporarily

The exact provider can be chosen during implementation, but it should offer stable access to the six supported coins without requiring user authentication for MVP.

## Key Screens

### 1. Dashboard

The dashboard is the primary value screen and should answer the user's most important questions immediately.

### Dashboard Summary Section

Show high-visibility summary cards for:

- Total Invested
- Portfolio Value
- Unrealized P&L
- Overall Return %

### Holdings Section

Show one row or card per supported asset that the user owns. Each asset summary should display:

- Asset symbol
- Total quantity
- Average buy price
- Current price
- Current value
- Unrealized P&L amount
- Unrealized P&L percent
- Allocation percent

### Allocation Section

Show a simple visual breakdown of portfolio allocation by asset. The visualization should be readable on mobile and desktop, and should help the user quickly understand concentration in BTC, ETH, and other holdings.

### 2. Add Transaction

This flow should feel lightweight and forgiving.

### Fields

- Asset selector limited to supported coins
- Amount invested
- Purchase price
- Quantity
- Purchase date
- Notes

### Input Behavior

- The user can enter amount invested and purchase price, and the system computes quantity automatically.
- Quantity is treated as a derived field in MVP, not a competing primary input, to keep the form simple and prevent conflicting values.
- Validation should prevent zero or negative numbers.
- The form should clearly explain invalid entries without financial jargon.

### 3. Transaction History

Show all buy transactions in chronological order, grouped or filterable by asset if useful. Each row should display:

- Asset
- Date
- Amount invested
- Purchase price
- Quantity
- Notes

The screen should help users verify that their portfolio summary is based on concrete entered records.
The default sort order should show the newest transactions first.

## Business Logic

### Average Cost Basis

For each asset:

- `totalInvested = sum(amountInvested)`
- `totalQuantity = sum(quantity)`
- `averageBuyPrice = totalInvested / totalQuantity`

### Current Value

For each asset:

- `currentValue = totalQuantity * currentPrice`

### Unrealized Profit And Loss

For each asset:

- `unrealizedPnL = currentValue - totalInvested`
- `unrealizedPnLPercent = unrealizedPnL / totalInvested`

### Allocation

For each asset:

- `allocationPercent = currentValue / portfolioValue`

### Portfolio Totals

- `portfolioValue = sum(asset.currentValue)`
- `totalInvested = sum(asset.totalInvested)`
- `totalUnrealizedPnL = portfolioValue - totalInvested`
- `totalReturnPercent = totalUnrealizedPnL / totalInvested`

## Error Handling

- If live prices fail to load, the app should keep showing stored transaction data and indicate that price data is temporarily unavailable.
- If there are no transactions, the app should show a friendly empty state and guide the user to add a first buy.
- If local data cannot be parsed, the app should recover safely instead of crashing.

## Architecture Direction

The implementation should separate concerns into three layers:

1. Presentation layer for screens and components
2. Domain layer for portfolio calculations and validation
3. Data layer for local persistence and price fetching

This separation is important so the app can later evolve from local-only storage to cloud sync without replacing business logic or UI structure.

## Testing Strategy

The implementation should include:

- Unit tests for portfolio calculation logic
- Unit tests for transaction validation
- Component or integration tests for adding transactions and seeing summaries update
- Coverage for empty, invalid, and price-unavailable states

## MVP Success Criteria

The first release is successful if:

- A user can add buy transactions for supported coins
- The app persists those transactions locally
- The app automatically aggregates holdings per asset
- The dashboard clearly shows total invested, portfolio value, unrealized P&L, return percent, and allocation
- The experience feels simpler and calmer than maintaining the same information manually in a spreadsheet

## Future Expansion

Out of scope for MVP, but intentionally supported by the architecture:

- Sell transactions
- Realized gains and losses
- Price alerts
- Browser notifications
- More supported assets
- Import from spreadsheet or CSV
- Cloud sync and authentication
- Multi-device access
