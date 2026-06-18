# Crystal Role-Based Investor Dashboard Design

## Goal

Add an investor experience to `crystalhuangdance.org` without changing the existing dancer member experience.

After login, each user should be routed by role:

- `dancer` users continue to see the current member dashboard unchanged
- `investor` users are redirected to a new `My Investment` dashboard

The site admin can define each user as either a `dancer` or an `investor`.

## Product Intent

This is a dual-role member website with one shared login system and two different post-login experiences.

The design should keep the current dancer flow stable while introducing a private investor area for users like Jennifer. The investor experience should feel calm, premium, and easy to understand, more like a personal investment portal than a trading interface.

## Scope

### In Scope

- Shared login entry for all users
- Role-based redirect after login
- Role-based navigation
- New investor landing page: `My Investment`
- Admin-controlled user role assignment
- Investor dashboard sections for:
  - portfolio summary
  - current holdings
  - monthly report archive
  - investment notes
  - PDF download entry point

### Out of Scope

- Changing the dancer dashboard layout or dancer workflows
- Linking investor performance to dancer/project performance
- Building a new admin system from scratch
- Advanced portfolio editing tools inside the website
- Multi-role switching for a single user in the first version

## User Roles

### Dancer

- Logs in through the existing site login flow
- Sees the current member dashboard unchanged
- Keeps the current navigation behavior, including dancer-specific items like `My Videos` and `Upload`

### Investor

- Logs in through the same site login flow
- Is redirected to a dedicated `My Investment` dashboard
- Sees investor-specific navigation instead of dancer-specific actions

### Admin

- Can create or edit users in the existing admin workflow
- Can assign exactly one role per user:
  - `dancer`
  - `investor`

## Experience Flow

### Login Flow

1. User opens the existing login page.
2. User signs in through the current authentication system.
3. The application reads the user profile and resolves the `role`.
4. The user is redirected by role:
   - `dancer` -> existing dancer member dashboard
   - `investor` -> `/investment`

### Navigation Rules

The site header should be role-aware after login.

For `dancer`:

- Keep the current member navigation unchanged

For `investor`:

- Replace dancer-specific member navigation with investor navigation
- Show `My Investment` as the primary destination
- Keep universal account actions such as sign out and language selection if those already exist in the shared shell

## Investor Dashboard Design

### Page Positioning

The investor dashboard is a private, logged-in area for viewing portfolio information and reports. It is not a trading terminal and should not feel like a technical exchange product.

### Primary Route

- `/investment`

### Sections

#### 1. Hero Area

- Main heading: `My Investment`
- Short supporting copy that explains this is the investor's private portfolio area
- Primary action: `Download Monthly Report`

#### 2. Portfolio Summary

Show high-level portfolio metrics:

- Total Invested
- Portfolio Value
- Unrealized P&L
- Total Return

This section should visually follow the calm card-based presentation already used in the crypto portfolio tracker.

#### 3. Current Holdings

For each asset, show:

- asset name
- symbol
- allocation percentage
- quantity
- invested amount
- current value
- unrealized P&L

This is the main operational table for investor review.

#### 4. Monthly Reports

Show a list of monthly reports, for example:

- May 2026
- June 2026

Each report row should support:

- `View`
- `Download PDF`

#### 5. Investment Notes

Show written notes, commentary, or investor-facing remarks that provide context for portfolio activity or monthly updates.

## Information Architecture

### Shared Public Layer

- Existing public website
- Existing login page

### Shared Auth Layer

- One login system for all member users

### Role-Based Member Layer

- `dancer` -> existing member dashboard
- `investor` -> `My Investment`

### Route Map

- Existing dancer member route remains unchanged
- New investor route:
  - `/investment`

## Data Model Changes

Each user should have a `role` field.

### Role Values

- `dancer`
- `investor`

### Rules

- Each user has one role in v1
- Role must be present for every active member account
- Role is controlled by admin, not self-selected by the member

## Admin Requirements

Admin needs a simple way to set the user role inside the current website administration workflow.

### Admin Actions

- Assign a role when creating a user
- Update a role when editing a user

### Constraints

- Only valid values are `dancer` and `investor`
- No mixed role behavior in v1

## Error Handling

Role resolution should be explicit and safe.

### Required Behavior

- If the user role is valid, route normally
- If the user role is missing or invalid, do not silently guess
- Redirect to a safe fallback page or show a clear access/configuration error

This avoids sending the wrong user into the wrong private experience.

## Visual Direction

### Dancer

- No visual changes required for the first version

### Investor

- Calm
- Premium
- Clear
- Reassuring
- Private member portal feel

The investor side should inherit enough of the parent brand to feel native to `crystalhuangdance.org`, while still presenting financial information in a structured dashboard format.

## Testing Strategy

### Role Routing

- `dancer` login routes to the current dashboard
- `investor` login routes to `/investment`
- invalid role produces safe fallback behavior

### Navigation

- dancer sees current member navigation
- investor sees `My Investment` navigation
- investor does not see dancer-only actions

### Admin

- admin can assign `dancer`
- admin can assign `investor`
- invalid role values are rejected

### Investor Dashboard

- summary renders expected metrics
- holdings table renders expected investor data
- monthly reports list renders available months
- report download action is visible

## Recommended Delivery Order

1. Add user role support to the existing auth/member model
2. Add role-based redirect after login
3. Add role-based navigation shell
4. Build the `/investment` dashboard
5. Add monthly report list and PDF actions

## Open Decisions Resolved

The following decisions are now explicit for v1:

- shared login system: yes
- post-login redirect by role: yes
- dancer dashboard changes: none
- investor primary landing page: `My Investment`
- admin-defined role assignment: yes
- investor scope: portfolio summary, holdings, monthly reports, notes, PDF download

