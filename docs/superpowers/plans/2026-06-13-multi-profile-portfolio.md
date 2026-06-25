# Multi-Profile Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local multi-profile portfolio support so the app can create investor profiles, switch between them from the hero header, isolate transactions per profile, and automatically migrate existing single-user data into a default profile.

**Architecture:** Introduce profile-aware persistence with separate storage for profile metadata, active profile selection, and per-profile transaction maps. Keep portfolio math focused on one transaction list at a time by adding a profile management hook above the existing portfolio logic, then render a dedicated profile switcher component under the live-price status card.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, localStorage persistence, existing portfolio domain helpers.

---

## File Map

- Create: `src/data/profileRepository.ts`
- Create: `src/data/profileRepository.test.ts`
- Create: `src/hooks/useProfiles.ts`
- Create: `src/components/ProfileSwitcher.tsx`
- Modify: `src/types/portfolio.ts`
- Modify: `src/data/transactionRepository.ts`
- Modify: `src/data/transactionRepository.test.ts`
- Modify: `src/hooks/usePortfolio.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

### Task 1: Define Profile Types

**Files:**
- Modify: `src/types/portfolio.ts`
- Test: `src/data/profileRepository.test.ts`

- [ ] **Step 1: Add profile-related type definitions**

Add:

```ts
export interface Profile {
  id: string;
  name: string;
  avatarColor: string;
  createdAt: string;
}

export type TransactionsByProfileId = Record<string, Transaction[]>;
```

Keep the existing `Transaction` type unchanged.

- [ ] **Step 2: Run TypeScript-aware tests later through repository coverage**

Run later with:

```bash
npm test -- --run src/data/profileRepository.test.ts src/data/transactionRepository.test.ts
```

Expected: profile-related tests fail because the repository does not exist yet.

- [ ] **Step 3: Commit after repository types are exercised**

Do not commit this task alone. Roll it into Task 2.

### Task 2: Build Profile Repository

**Files:**
- Create: `src/data/profileRepository.ts`
- Create: `src/data/profileRepository.test.ts`
- Modify: `src/types/portfolio.ts`

- [ ] **Step 1: Write the failing repository tests**

Add tests covering:

- loading empty profile state
- creating default profile state when no data exists
- loading malformed stored profiles safely
- saving profiles and active profile id
- rejecting a missing active profile id by falling back to the first profile

Core test fixtures should look like:

```ts
const defaultProfile = {
  id: "profile-1",
  name: "My Portfolio",
  avatarColor: "#1f6f78",
  createdAt: "2026-06-13T00:00:00.000Z"
};
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- --run src/data/profileRepository.test.ts
```

Expected: FAIL because `profileRepository.ts` does not exist yet.

- [ ] **Step 3: Implement the minimal profile repository**

Create `src/data/profileRepository.ts` with:

- storage keys:
  - `crypto-portfolio-profiles`
  - `crypto-portfolio-active-profile-id`
- `loadProfiles(): Profile[]`
- `loadActiveProfileId(): string | null`
- `saveProfiles(profiles: Profile[])`
- `saveActiveProfileId(profileId: string)`
- shared localStorage guards like the transaction repository uses

Validation rules:

- ignore malformed profile rows
- only accept strings for all fields
- return empty array when storage is unreadable

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
npm test -- --run src/data/profileRepository.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/portfolio.ts src/data/profileRepository.ts src/data/profileRepository.test.ts
git commit -m "add profile persistence layer"
```

### Task 3: Upgrade Transaction Storage for Profiles and Migration

**Files:**
- Modify: `src/data/transactionRepository.ts`
- Modify: `src/data/transactionRepository.test.ts`
- Modify: `src/types/portfolio.ts`

- [ ] **Step 1: Write failing transaction repository tests for multi-profile storage**

Add tests covering:

- loading `TransactionsByProfileId` from `crypto-portfolio-transactions-by-profile`
- saving `TransactionsByProfileId`
- ignoring malformed profile transaction maps
- migrating from legacy `crypto-portfolio-transactions` into a default profile when the new map does not exist
- leaving legacy data untouched if migration cannot complete

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- --run src/data/transactionRepository.test.ts
```

Expected: FAIL because the repository still only reads and writes a flat transaction array.

- [ ] **Step 3: Refactor the repository API**

Replace the current single-array API with profile-aware helpers:

- `loadTransactionsByProfileId(): TransactionsByProfileId`
- `saveTransactionsByProfileId(map: TransactionsByProfileId)`
- `loadLegacyTransactions(): Transaction[]`

Use a new storage key:

- `crypto-portfolio-transactions-by-profile`

Keep legacy key support only for migration:

- `crypto-portfolio-transactions`

- [ ] **Step 4: Add one-time migration helper**

Implement a pure helper shape inside the repository file:

```ts
function migrateLegacyTransactionsToProfileMap(input: {
  legacyTransactions: Transaction[];
  defaultProfileId: string;
}): TransactionsByProfileId
```

Behavior:

- if no legacy data, return empty map
- if legacy data exists, assign it to `map[defaultProfileId]`

- [ ] **Step 5: Run tests to verify pass**

Run:

```bash
npm test -- --run src/data/transactionRepository.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/data/transactionRepository.ts src/data/transactionRepository.test.ts src/types/portfolio.ts
git commit -m "add profile-aware transaction storage"
```

### Task 4: Add Profile State Hook

**Files:**
- Create: `src/hooks/useProfiles.ts`
- Modify: `src/data/profileRepository.ts`
- Modify: `src/data/transactionRepository.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing app tests for profile bootstrap and switching**

Add app-level tests covering:

- first boot creates and displays `My Portfolio`
- legacy transactions migrate into `My Portfolio`
- a new profile can be created with a chosen color
- switching profiles changes visible holdings and summary values

Use UI text expectations rather than internal state assertions.

- [ ] **Step 2: Run targeted app tests to verify failure**

Run:

```bash
npm test -- --run src/App.test.tsx
```

Expected: FAIL because no profile UI or profile state exists yet.

- [ ] **Step 3: Implement `useProfiles`**

Create `src/hooks/useProfiles.ts` with responsibilities:

- load profiles and active profile id
- auto-create a default profile when no profiles exist
- migrate legacy transactions into the default profile if new transaction-map storage is absent
- expose:
  - `profiles`
  - `activeProfile`
  - `activeProfileId`
  - `createProfile(input)`
  - `switchProfile(profileId)`

Recommended create input:

```ts
interface CreateProfileInput {
  name: string;
  avatarColor: string;
}
```

Validation rules:

- trim name
- reject empty name with a friendly error

- [ ] **Step 4: Keep migration in one place**

Perform migration inside `useProfiles` bootstrap logic, not inside `App.tsx`.

Required sequence:

1. load profiles
2. if none, create default profile
3. if no transaction map exists but legacy data exists, persist migrated map for the default profile
4. set active profile id

- [ ] **Step 5: Re-run targeted app tests**

Run:

```bash
npm test -- --run src/App.test.tsx
```

Expected: some profile tests may still fail until Task 5 wires the portfolio hook and UI.

- [ ] **Step 6: Commit after App wiring is complete**

Do not commit this task alone. Roll it into Task 5.

### Task 5: Make Portfolio Hook Profile-Aware

**Files:**
- Modify: `src/hooks/usePortfolio.ts`
- Create or modify: `src/hooks/useProfiles.ts`
- Modify: `src/data/transactionRepository.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Refactor `usePortfolio` to accept active profile context**

Change the signature to something like:

```ts
export function usePortfolio(prices: PriceMap, activeProfileId: string | null)
```

Inside the hook:

- load the whole `TransactionsByProfileId` map
- derive `activeTransactions`
- compute `snapshot` from `activeTransactions`
- keep transaction mutation methods scoped to the active profile only

- [ ] **Step 2: Preserve existing transaction behavior within the active profile**

For `addTransaction`, `updateTransaction`, and `deleteTransaction`:

- read the current active profile list
- write back only that profile’s array
- leave all other profile arrays untouched

- [ ] **Step 3: Handle missing active profile safely**

If `activeProfileId` is `null` or missing from the map:

- expose `transactions` as `[]`
- expose a zeroed snapshot via the existing portfolio builder
- return mutation errors like `Please choose a profile first.` only if an action is attempted without an active profile

- [ ] **Step 4: Run app tests**

Run:

```bash
npm test -- --run src/App.test.tsx
```

Expected: data isolation tests now pass once the UI is wired in Task 6.

- [ ] **Step 5: Commit after App wiring is complete**

Roll this into Task 6.

### Task 6: Add Profile Switcher UI

**Files:**
- Create: `src/components/ProfileSwitcher.tsx`
- Modify: `src/components/PriceStatus.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Create failing UI expectations in `App.test.tsx`**

Add tests for:

- header shows the active profile card
- switcher opens and lists all profiles
- `Create new profile` opens inline creation controls
- selecting another profile closes the list and updates the dashboard

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- --run src/App.test.tsx
```

Expected: FAIL because the switcher component does not exist yet.

- [ ] **Step 3: Implement `ProfileSwitcher.tsx`**

The component should render:

- active card with avatar color dot
- active profile name
- helper line `Active portfolio`
- expand/collapse button
- list of profile rows when open
- inline create form with:
  - text input for name
  - fixed color palette
  - create/cancel buttons

Callbacks:

- `onSwitchProfile(profileId: string)`
- `onCreateProfile(input: CreateProfileInput)`

- [ ] **Step 4: Wire the component into `App.tsx`**

Use `useProfiles()` in `App.tsx`, then pass `activeProfileId` into `usePortfolio()`.

Render the switcher under `PriceStatus` inside `.hero-status`.

Update visible app behavior so:

- the transaction form always writes into the active profile
- empty states are evaluated from the active profile’s transaction list
- holdings, allocation, and history only show the active profile’s data

- [ ] **Step 5: Add styles**

Add CSS for:

- compact profile card layout
- open menu panel
- selected profile row state
- avatar color swatch
- inline create form
- mobile-safe stacking under the live price status

Keep the new UI visually aligned with the existing hero-card design language.

- [ ] **Step 6: Run targeted tests**

Run:

```bash
npm test -- --run src/App.test.tsx
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useProfiles.ts src/hooks/usePortfolio.ts src/components/ProfileSwitcher.tsx src/App.tsx src/App.test.tsx src/styles.css src/data/profileRepository.ts src/data/transactionRepository.ts
git commit -m "add profile switcher and portfolio isolation"
```

### Task 7: Full Regression Verification

**Files:**
- Test: `src/App.test.tsx`
- Test: `src/data/profileRepository.test.ts`
- Test: `src/data/transactionRepository.test.ts`
- Test: `src/domain/portfolio.test.ts`
- Test: `src/hooks/usePrices.test.ts`

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test -- --run
```

Expected: PASS with all tests green.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS with Vite production output.

- [ ] **Step 3: Run the Electron compile**

Run:

```bash
npm run electron:compile
```

Expected: PASS

- [ ] **Step 4: Manual verification checklist**

Check in the app:

- app shows `My Portfolio` on a clean first run
- creating `Tony` with a new color adds a second profile
- switching between profiles changes totals
- adding a BTC buy in profile A does not appear in profile B
- switching back preserves profile A data
- old legacy transaction storage migrates into `My Portfolio`

- [ ] **Step 5: Final commit if any verification fixes were needed**

```bash
git add -A
git commit -m "verify multi-profile portfolio flow"
```

## Self-Review

- Spec coverage checked:
  - local multi-profile support: Tasks 2-6
  - header switcher under live prices: Task 6
  - create-profile flow: Task 6
  - active switching: Tasks 4 and 6
  - separate portfolio data: Tasks 3 and 5
  - migration from legacy single-user storage: Tasks 3 and 4
- Placeholder scan checked:
  - no TBD/TODO placeholders
  - each task names exact files and concrete verification commands
- Type consistency checked:
  - `Profile`, `TransactionsByProfileId`, `activeProfileId`, `useProfiles`, and `ProfileSwitcher` naming is consistent throughout
