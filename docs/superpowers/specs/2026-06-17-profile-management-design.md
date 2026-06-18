# Profile Management Design

## Goal

Extend the existing multi-profile portfolio system so users can manage profiles directly from the header switcher.

This phase adds:

- rename profile
- delete profile

It builds on top of the existing local multi-profile feature and keeps the same lightweight, local-first approach.

## User Outcome

The app should let the user:

- rename any existing profile from the profile switcher
- delete a profile after an explicit confirmation step
- automatically switch to another valid profile if the active one is deleted
- keep the current profile-switching flow simple and in one place

## Scope

### In Scope

- inline profile rename inside the existing profile switcher
- inline delete confirmation inside the existing profile switcher
- permanent profile deletion
- permanent deletion of that profile’s transactions
- protecting the last remaining profile from deletion
- active-profile fallback after delete

### Out of Scope

- changing avatar color after creation
- profile sorting
- undo after delete
- soft delete
- separate full-screen profile settings page

## Recommended Approach

Keep profile management inside the existing `ProfileSwitcher` rather than adding a separate management page.

This keeps the current experience consistent:

- switching
- creating
- renaming
- deleting

all happen in the same UI surface.

## UX Design

## Profile Row States

Each row inside the expanded profile switcher should support three states:

### Default State

Display:

- avatar color dot
- profile name
- `Rename` action
- `Delete` action

### Rename State

When `Rename` is clicked, replace the row content with:

- a text input prefilled with the current profile name
- `Save` button
- `Cancel` button

Rules:

- only one profile row can be in rename mode at a time
- opening rename mode clears any active delete confirmation state

### Delete Confirmation State

When `Delete` is clicked, expand the row into a destructive confirmation state with:

- a short warning such as `Delete this profile and all of its transactions?`
- `Confirm delete` button
- `Cancel` button

Rules:

- only one profile row can be in delete confirmation at a time
- opening delete confirmation clears any active rename state

## Rename Rules

Rename only changes:

- `profile.name`

Rename does not change:

- `profile.id`
- `profile.avatarColor`
- `profile.createdAt`

Validation:

- name is required
- name is trimmed before save
- empty names are rejected with a friendly validation message
- duplicate names are allowed in v1

If the renamed profile is the active profile:

- the switcher trigger should update immediately
- the active row should update immediately

## Delete Rules

Delete behavior for v1:

- show confirmation first
- once confirmed, permanently delete the profile
- also permanently delete its transaction list from `transactionsByProfileId`

## Safety Rules

Two protections are required:

### Cannot Delete the Last Profile

If there is only one profile left:

- hide or disable `Delete`
- if triggered defensively anyway, return a friendly error such as `You need at least one profile.`

### Active Profile Fallback

If the deleted profile is currently active:

- switch to the first remaining profile in the updated list
- persist the replacement `activeProfileId`
- update the dashboard immediately to show the new active portfolio

If the deleted profile is not active:

- keep the current `activeProfileId` unchanged

## Data Model

The existing model is sufficient:

- `profiles`
- `activeProfileId`
- `transactionsByProfileId`

No schema change is required for this step.

## Hook and State Changes

Add two new mutations to `useProfiles()`:

- `renameProfile({ id, name })`
- `deleteProfile(id)`

### renameProfile

Responsibilities:

- validate trimmed name
- update the matching profile
- persist the updated profile list
- update local state only after persistence succeeds

### deleteProfile

Responsibilities:

1. confirm the target profile exists
2. reject deletion if it is the last profile
3. build the next `profiles` list
4. build the next `transactionsByProfileId` without the deleted key
5. resolve the next `activeProfileId`
6. persist all affected state
7. update local state only after persistence succeeds

## Persistence Order

For delete, use a safe write order:

1. save updated profiles
2. save updated transaction map
3. save updated active profile id if it changed

If any write fails:

- do not partially update React state
- return a friendly error

This keeps runtime UI state aligned with persisted local storage as closely as possible.

## UI Component Changes

Update `ProfileSwitcher` responsibilities to include:

- row-level edit mode
- row-level delete confirmation mode
- action buttons for rename/delete
- local input state for rename
- local confirmation state for delete
- inline validation and persistence error messaging

The switcher should still remain compact when closed. The extra complexity only appears after expanding the menu.

## Edge Cases

### Renaming While Another Row Is Open

If one row is being renamed and the user clicks `Delete` on another row:

- close rename mode
- open delete confirmation for the clicked row

The inverse should also apply.

### Deleting an Empty Profile

Deleting a profile with no transactions should behave exactly the same as deleting a populated profile, just without portfolio data to remove.

### Deleting a Profile Visible in the Current UI

If the currently visible portfolio belongs to the deleted active profile:

- the screen should switch immediately to the fallback active profile
- summary cards, holdings, allocation, and history should all refresh without needing a page reload

## Testing Strategy

Add tests for:

- renaming a profile updates the switcher trigger and row label
- renaming rejects blank names
- deleting a non-active profile removes it and keeps the active profile unchanged
- deleting the active profile switches to the first remaining profile
- deleting a profile also removes its transactions from the data set
- last remaining profile cannot be deleted
- rename and delete modes are mutually exclusive

## Risks

### Primary Risk

The biggest risk is deleting a profile but leaving its transactions orphaned in storage.

Mitigation:

- always update the transaction map in the same mutation flow
- test delete behavior at both UI and storage levels

### Secondary Risk

The switcher can become visually crowded as more actions are added.

Mitigation:

- keep actions lightweight and row-scoped
- reveal rename/delete controls only inside the expanded switcher

## Phase Boundary

This step is still intentionally narrow. It adds profile maintenance, but not full profile customization.

Likely future follow-ups:

- edit avatar color
- delete with undo
- profile reorder
- profile settings panel

Those are not required for this step.
