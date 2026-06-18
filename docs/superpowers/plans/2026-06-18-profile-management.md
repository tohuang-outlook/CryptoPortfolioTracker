# Profile Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline profile rename and delete management to the existing profile switcher, including delete confirmation, last-profile protection, and active-profile fallback.

**Architecture:** Extend the existing local multi-profile architecture instead of introducing a new settings page. Profile mutations stay inside `useProfiles()`, while `ProfileSwitcher` owns temporary UI state for rename and delete confirmation modes. Deletion removes both the profile metadata and its transaction bucket in one coordinated persistence flow.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, existing localStorage repositories, existing `useProfiles` hook.

---

## File Map

- Modify: `src/hooks/useProfiles.ts`
- Modify: `src/components/ProfileSwitcher.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

### Task 1: Add Profile Management Tests

**Files:**
- Modify: `src/App.test.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing rename/delete tests**

Add app-level tests for these behaviors:

```ts
test("renames the active profile from the profile switcher", async () => {
  const user = userEvent.setup();
  seedProfileData();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /my portfolio/i }));
  await user.click(screen.getByRole("button", { name: /rename my portfolio/i }));
  await user.clear(screen.getByLabelText(/rename profile name/i));
  await user.type(screen.getByLabelText(/rename profile name/i), "Tony Long Term");
  await user.click(screen.getByRole("button", { name: /save profile rename/i }));

  expect(
    screen.getByRole("button", { name: /tony long term/i })
  ).toBeInTheDocument();
});

test("rejects blank profile rename values", async () => {
  const user = userEvent.setup();
  seedProfileData();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /my portfolio/i }));
  await user.click(screen.getByRole("button", { name: /rename my portfolio/i }));
  await user.clear(screen.getByLabelText(/rename profile name/i));
  await user.click(screen.getByRole("button", { name: /save profile rename/i }));

  expect(screen.getByText(/please enter a profile name/i)).toBeInTheDocument();
});

test("deletes a non-active profile and keeps the active profile unchanged", async () => {
  const user = userEvent.setup();
  seedProfileData();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /my portfolio/i }));
  await user.click(screen.getByRole("button", { name: /delete trading desk/i }));
  await user.click(screen.getByRole("button", { name: /confirm delete trading desk/i }));

  expect(screen.getByRole("button", { name: /my portfolio/i })).toBeInTheDocument();
  expect(screen.queryByText(/trading desk/i)).not.toBeInTheDocument();
});

test("deletes the active profile and switches to the first remaining profile", async () => {
  const user = userEvent.setup();
  seedProfileData();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /my portfolio/i }));
  await user.click(screen.getByRole("button", { name: /delete my portfolio/i }));
  await user.click(screen.getByRole("button", { name: /confirm delete my portfolio/i }));

  expect(screen.getByRole("button", { name: /trading desk/i })).toBeInTheDocument();
  expect(screen.getByText(/ethereum · 100.0%/i)).toBeInTheDocument();
});

test("prevents deleting the last remaining profile", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /my portfolio/i }));
  expect(
    screen.queryByRole("button", { name: /delete my portfolio/i })
  ).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the app test file to confirm failure**

Run:

```bash
npm test -- --run src/App.test.tsx
```

Expected: FAIL because rename/delete controls and mutations do not exist yet.

- [ ] **Step 3: Commit**

Do not commit yet. Roll this into Task 3 after implementation passes.

### Task 2: Add Rename/Delete Mutations to Profile State

**Files:**
- Modify: `src/hooks/useProfiles.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Add mutation signatures**

Extend the hook return shape with:

```ts
renameProfile(input: { id: string; name: string }): MutationResult
deleteProfile(profileId: string): MutationResult
```

- [ ] **Step 2: Implement `renameProfile`**

Add logic equivalent to:

```ts
function renameProfile(input: { id: string; name: string }): MutationResult {
  const trimmedName = input.name.trim();

  if (trimmedName.length === 0) {
    return {
      success: false,
      error: "Please enter a profile name."
    };
  }

  if (!state.profiles.some((profile) => profile.id === input.id)) {
    return {
      success: false,
      error: "Unable to find that profile."
    };
  }

  const nextProfiles = state.profiles.map((profile) =>
    profile.id === input.id
      ? { ...profile, name: trimmedName }
      : profile
  );

  const saveResult = profileRepository.saveProfiles(nextProfiles);
  if (!saveResult.success) {
    return saveResult;
  }

  setState((currentState) => ({
    ...currentState,
    profiles: nextProfiles
  }));

  return { success: true };
}
```

- [ ] **Step 3: Implement `deleteProfile`**

Use this sequence:

```ts
function deleteProfile(profileId: string): MutationResult {
  const targetProfile = state.profiles.find((profile) => profile.id === profileId);
  if (!targetProfile) {
    return {
      success: false,
      error: "Unable to find that profile."
    };
  }

  if (state.profiles.length === 1) {
    return {
      success: false,
      error: "You need at least one profile."
    };
  }

  const nextProfiles = state.profiles.filter((profile) => profile.id !== profileId);
  const nextTransactionsByProfileId = { ...state.transactionsByProfileId };
  delete nextTransactionsByProfileId[profileId];

  const nextActiveProfileId =
    state.activeProfileId === profileId
      ? nextProfiles[0]?.id ?? null
      : state.activeProfileId;

  const saveProfilesResult = profileRepository.saveProfiles(nextProfiles);
  if (!saveProfilesResult.success) {
    return saveProfilesResult;
  }

  const saveTransactionsResult = transactionRepository.saveTransactionsByProfileId(
    nextTransactionsByProfileId
  );
  if (!saveTransactionsResult.success) {
    return saveTransactionsResult;
  }

  if (nextActiveProfileId) {
    const saveActiveResult =
      profileRepository.saveActiveProfileId(nextActiveProfileId);
    if (!saveActiveResult.success) {
      return saveActiveResult;
    }
  }

  setState({
    profiles: nextProfiles,
    activeProfileId: nextActiveProfileId,
    transactionsByProfileId: nextTransactionsByProfileId
  });

  return { success: true };
}
```

- [ ] **Step 4: Re-run the app test file**

Run:

```bash
npm test -- --run src/App.test.tsx
```

Expected: tests still fail because the switcher UI does not yet expose rename/delete controls.

- [ ] **Step 5: Commit**

Do not commit yet. Roll this into Task 3 after the UI passes.

### Task 3: Extend the Profile Switcher UI

**Files:**
- Modify: `src/components/ProfileSwitcher.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Add new component props**

Update `ProfileSwitcher` props to include:

```ts
onRenameProfile: (input: { id: string; name: string }) => MutationResult;
onDeleteProfile: (profileId: string) => MutationResult;
```

- [ ] **Step 2: Add row-level local UI state**

Inside `ProfileSwitcher`, add:

```ts
const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
const [editingName, setEditingName] = useState("");
const [deleteConfirmProfileId, setDeleteConfirmProfileId] = useState<string | null>(null);
```

Rules:

- opening rename clears `deleteConfirmProfileId`
- opening delete confirm clears `editingProfileId`
- successful save/delete clears both temporary modes and closes the menu only when appropriate

- [ ] **Step 3: Render rename mode**

For the matching row in rename mode, replace the default row with inline controls:

```tsx
<div className="profile-switcher__row-editor">
  <label className="profile-switcher__label">
    <span className="sr-only">Rename profile name</span>
    <input
      aria-label="Rename profile name"
      value={editingName}
      onChange={(event) => setEditingName(event.target.value)}
    />
  </label>
  <div className="profile-switcher__row-actions">
    <button type="button" onClick={handleRenameSave}>
      Save Profile Rename
    </button>
    <button type="button" className="button-secondary" onClick={handleRenameCancel}>
      Cancel
    </button>
  </div>
</div>
```

- [ ] **Step 4: Render delete confirmation mode**

For the matching row in delete-confirm mode, replace the default row with:

```tsx
<div className="profile-switcher__row-delete">
  <p>Delete this profile and all of its transactions?</p>
  <div className="profile-switcher__row-actions">
    <button type="button" className="button-danger" onClick={handleDeleteConfirm}>
      Confirm Delete {profile.name}
    </button>
    <button type="button" className="button-secondary" onClick={handleDeleteCancel}>
      Cancel
    </button>
  </div>
</div>
```

- [ ] **Step 5: Render default row actions**

For non-editing rows, keep the switch button and add action controls:

```tsx
<div className="profile-switcher__row-meta">
  <button
    type="button"
    className="profile-switcher__row-link"
    onClick={() => handleSwitch(profile.id)}
  >
    <span className="profile-switcher__avatar" ... />
    <span>{profile.name}</span>
  </button>
  <div className="profile-switcher__row-actions">
    <button
      type="button"
      className="button-secondary"
      aria-label={`Rename ${profile.name}`}
      onClick={() => startRename(profile)}
    >
      Rename
    </button>
    {profiles.length > 1 ? (
      <button
        type="button"
        className="button-secondary button-danger-soft"
        aria-label={`Delete ${profile.name}`}
        onClick={() => startDelete(profile.id)}
      >
        Delete
      </button>
    ) : null}
  </div>
</div>
```

- [ ] **Step 6: Wire `App.tsx`**

Pass the new handlers through:

```tsx
<ProfileSwitcher
  profiles={profiles}
  activeProfile={activeProfile}
  onCreateProfile={createProfile}
  onSwitchProfile={switchProfile}
  onRenameProfile={renameProfile}
  onDeleteProfile={deleteProfile}
/>
```

- [ ] **Step 7: Add styles**

Extend `src/styles.css` with row-management styles:

```css
.profile-switcher__row-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.profile-switcher__row-link {
  display: flex;
  align-items: center;
  gap: 12px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;
  text-align: left;
}

.profile-switcher__row-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.profile-switcher__row-editor,
.profile-switcher__row-delete {
  display: grid;
  gap: 10px;
}

.button-danger {
  padding: 10px 12px;
  border-radius: 12px;
  border: none;
  background: #b2573f;
  color: #fff;
}

.button-danger-soft {
  color: #b2573f;
}
```

- [ ] **Step 8: Run the app test file again**

Run:

```bash
npm test -- --run src/App.test.tsx
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useProfiles.ts src/components/ProfileSwitcher.tsx src/App.tsx src/App.test.tsx src/styles.css
git commit -m "add profile rename and delete management"
```

### Task 4: Full Verification

**Files:**
- Test: `src/App.test.tsx`
- Test: `src/data/profileRepository.test.ts`
- Test: `src/data/transactionRepository.test.ts`
- Test: `src/domain/portfolio.test.ts`
- Modify if needed: any files touched above

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test -- --run
```

Expected: PASS

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS

- [ ] **Step 3: Run Electron compile**

Run:

```bash
npm run electron:compile
```

Expected: PASS

- [ ] **Step 4: Manual verification checklist**

Check these flows:

- create a second profile, then rename it
- rename the active profile and confirm the header trigger updates
- delete a non-active profile and confirm the active one stays selected
- delete the active profile and confirm the remaining first profile becomes active
- verify the deleted profile’s transactions no longer reappear after reload
- verify the last remaining profile shows no delete action

- [ ] **Step 5: Final commit if verification fixes were needed**

```bash
git add -A
git commit -m "verify profile management flow"
```

## Self-Review

- Spec coverage:
  - inline rename: Tasks 1-3
  - inline delete confirmation: Tasks 1-3
  - permanent profile + transaction deletion: Task 2
  - last-profile protection: Tasks 1-2
  - active-profile fallback: Task 2 and manual verification
- Placeholder scan:
  - no TBD/TODO placeholders
  - all tasks include exact files and commands
- Type consistency:
  - `renameProfile`, `deleteProfile`, `editingProfileId`, and `deleteConfirmProfileId` are used consistently throughout
