# Multi-Profile Portfolio Design

## Goal

Add a lightweight multi-profile system so each investor can have a separate portfolio inside the same app.

This is Phase 2, Step 1. The focus is not authentication or cloud sync. The focus is local profile creation and profile-based portfolio switching.

## User Outcome

The app should let the user:

- create a profile with a name and avatar color
- switch between profiles from the dashboard header
- see a different portfolio for each profile
- keep transactions, holdings, allocation, and summary cards isolated per profile
- preserve existing single-user data by migrating it into a default profile automatically

## Scope

### In Scope

- local multi-profile support
- profile switcher UI in the header area under the live price status
- create-profile flow
- active profile switching
- separate portfolio data per profile
- migration from the current single-storage transaction model

### Out of Scope

- login or password protection
- cloud sync
- deleting profiles
- editing profile names or colors
- profile sorting or pinning
- cross-profile combined analytics

## Recommended Approach

Use a local profile model with three persisted pieces of state:

- `profiles`
- `activeProfileId`
- `transactionsByProfileId`

This keeps profile identity separate from portfolio contents, which makes future additions such as profile settings, notes, or alert preferences easier to add without reshaping transaction storage again.

## UX Design

## Header Behavior

The current hero status card contains the live price status. Under that status, add a compact profile switcher card.

The card should show:

- the active profile avatar color as a circular swatch
- the active profile name
- a small helper line such as `Active portfolio`
- a control affordance showing that the card can expand

## Expanded Switcher

When expanded, the switcher should display:

- a list of all profiles
- one row per profile with avatar color and profile name
- a visible selected state for the active profile
- a `Create new profile` action at the bottom

Selecting a row immediately switches the active profile and closes the menu.

## Create Profile Flow

The first version should keep profile creation lightweight and inline.

The create flow should include:

- `Profile name` input
- `Avatar color` picker with a small fixed palette
- `Create` button
- `Cancel` button

Validation rules:

- profile name is required
- profile name is trimmed before save
- empty names are rejected with a friendly validation message

Duplicate names are allowed in v1 to avoid unnecessary friction, but each profile must still use its own generated id.

## Empty States

Two empty states matter:

### First app launch with no data

The app should create a default profile automatically so the user always has an active context.

Recommended default:

- name: `My Portfolio`
- avatar color: first preset color

### Switching to a profile with no transactions

The app should show the existing empty portfolio state inside that profile context. The user should still see the selected profile in the header and be able to add the first transaction normally.

## Data Model

## Profile Type

Add a profile entity with:

- `id: string`
- `name: string`
- `avatarColor: string`
- `createdAt: string`

## Portfolio Storage Shape

Persist a new structure in local storage:

- `crypto-portfolio-profiles`
- `crypto-portfolio-active-profile-id`
- `crypto-portfolio-transactions-by-profile`

Suggested stored transaction shape:

```ts
type TransactionsByProfileId = Record<string, Transaction[]>;
```

This keeps the existing `Transaction` model unchanged, which reduces migration risk and limits this step to profile-aware orchestration rather than transaction schema refactoring.

## Runtime Data Flow

At runtime:

1. load all profiles
2. load the active profile id
3. load all transactions keyed by profile id
4. derive `activeTransactions`
5. pass `activeTransactions` into the existing portfolio snapshot builder

Transaction mutations should only affect the active profile's transaction list.

## Migration Strategy

The app currently stores all transactions under a single key:

- `crypto-portfolio-transactions`

The new app version should run a one-time migration when:

- legacy transactions exist
- no new multi-profile storage exists yet

Migration steps:

1. create default profile `My Portfolio`
2. set it as the active profile
3. move all legacy transactions into `transactionsByProfileId[defaultProfileId]`
4. persist the new keys
5. optionally leave the old key untouched for one release, but stop reading from it after migration succeeds

If migration fails:

- do not destroy legacy data
- fall back safely
- surface a friendly error only if needed

## Architecture Changes

## Repository Layer

The current transaction repository only knows how to read and write a single transaction array.

For this feature, split persistence responsibilities into clearer units:

- a profile repository for profile list and active profile id
- a portfolio storage repository for `transactionsByProfileId`

This avoids overloading the existing single-purpose repository and keeps the code easier to extend.

## Hook Layer

The current `usePortfolio` hook should become profile-aware.

Recommended shape:

- keep portfolio calculation logic focused on one profile at a time
- introduce a higher-level hook that manages profile state and chooses the active transaction set

One clean option:

- `useProfiles()` manages profiles, active id, create profile, switch profile
- `usePortfolio(prices, activeTransactions)` continues to compute snapshot and transaction mutations for the current profile

Another acceptable option:

- fold everything into a new `usePortfolioAppState()` hook

Recommendation:

Prefer separate hooks so profile management and portfolio math remain easy to reason about independently.

## UI Components

Add a dedicated profile switcher component rather than embedding all logic directly inside `App.tsx`.

Recommended new component:

- `ProfileSwitcher`

Responsibilities:

- render active profile summary
- open and close the card menu
- render profile list
- handle create-profile UI
- call parent callbacks for switch/create actions

## Testing Strategy

Add tests for:

- app boot with no data creates a default profile context
- legacy transaction migration creates the default profile and preserves portfolio totals
- creating a new profile adds it to the switcher
- switching profiles changes visible holdings and summary values
- adding a transaction while profile B is active does not affect profile A
- empty profile shows empty-state UI correctly

Repository tests should also cover:

- loading malformed profile storage safely
- saving and loading active profile id
- reading and writing transaction maps by profile id

## Risks and Constraints

### Biggest Risk

The main risk is corrupting or hiding existing user data during migration.

Mitigation:

- keep legacy transaction schema unchanged
- perform migration only when the new storage keys are absent
- test migration against realistic existing local storage values

### UX Risk

If the switcher becomes too heavy, it can clutter the hero header.

Mitigation:

- keep the profile card compact by default
- reveal full controls only on expand

## Phase Boundary

This feature is the foundation for later profile features, but should remain intentionally narrow.

After this step is stable, possible next steps can include:

- rename profile
- delete profile
- profile-specific notes
- profile-specific alerts
- import/export per profile

None of those are required for this step.
