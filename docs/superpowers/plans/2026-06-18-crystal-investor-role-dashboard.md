# Crystal Investor Role Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a role-routed investor dashboard to `crystalhuangdance` so dancer users keep the current member experience while investor users automatically land on `My Investment` after login.

**Architecture:** Keep the existing auth/session model intact and preserve the current `admin` permission behavior. Instead of overloading the existing `role` field, add a second user classification field named `member_type` on the backend and `memberType` on the frontend with values `dancer` and `investor`. Use that field for post-login redirects, protected-route defaults, navbar rendering, admin editing, and the new investor page.

**Tech Stack:** Vite, React 18, React Router 7, Express 5, better-sqlite3, Vitest, Testing Library, Supertest.

---

## File Map

### Backend

- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/server/db.js`
  - add `member_type` persistence, migration, update statement, and user serialization support
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/server/app.js`
  - return `memberType` in auth/admin payloads, validate admin updates, and expose a new admin endpoint for member type changes
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/server/app.test.js`
  - add backend coverage for default member type, login/session payloads, and admin updates

### Frontend auth and routing

- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/services/auth.ts`
  - expand `AuthUser` to include `memberType`
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/context/AuthContext.tsx`
  - expose `isInvestor`, `isDancer`, and a route helper
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/pages/LoginPage.tsx`
  - redirect by `memberType`
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/routes/ProtectedRoute.tsx`
  - support role-aware fallback destinations
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/App.tsx`
  - register the `/investment` route

### Frontend investor UI

- Create: `/Users/tonyhuang/Documents/crystalhuangdance/src/pages/MyInvestmentPage.tsx`
  - new investor landing page
- Create: `/Users/tonyhuang/Documents/crystalhuangdance/src/data/investmentDashboardData.ts`
  - temporary investor dashboard fixture data for Jennifer-style content
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/components/Navbar.tsx`
  - switch private navigation between dancer and investor experiences

### Frontend admin UI and API client

- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/services/admin.ts`
  - add `memberType` to `AdminUserRecord` and add update API
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/pages/AdminPage.tsx`
  - render and submit a member type selector per non-admin user

### Frontend tests

- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/App.test.tsx`
  - add route and nav coverage for dancer vs investor users

---

### Task 1: Add Backend Member Type Support

**Files:**
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/server/db.js`
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/server/app.js`
- Test: `/Users/tonyhuang/Documents/crystalhuangdance/server/app.test.js`

- [ ] **Step 1: Write the failing backend tests**

Add these tests near the existing auth/admin coverage in `/Users/tonyhuang/Documents/crystalhuangdance/server/app.test.js`:

```js
  it('returns the default member type for newly registered users', async () => {
    const agent = request.agent(app);

    const response = await agent.post('/api/auth/register').send({
      email: 'investor-default@example.com',
      password: 'password123',
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toEqual({
      id: 1,
      email: 'investor-default@example.com',
      role: 'user',
      memberType: 'dancer',
    });

    expect(db.findUserByEmail('investor-default@example.com')).toMatchObject({
      email: 'investor-default@example.com',
      role: 'user',
      memberType: 'dancer',
    });
  });

  it('lets an admin update a member type between dancer and investor', async () => {
    const adminAgent = request.agent(app);
    const userAgent = request.agent(app);

    await registerUser(adminAgent, 'admin@example.com');
    promoteUserToAdmin(db, 'admin@example.com');
    const createdUser = await registerUser(userAgent, 'jennifer@example.com');

    const response = await adminAgent.patch(`/api/admin/users/${createdUser.id}/member-type`).send({
      memberType: 'investor',
    });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: createdUser.id,
      email: 'jennifer@example.com',
      role: 'user',
      memberType: 'investor',
    });

    expect(db.findUserByEmail('jennifer@example.com')).toMatchObject({
      email: 'jennifer@example.com',
      memberType: 'investor',
    });
  });

  it('rejects unsupported member type values', async () => {
    const adminAgent = request.agent(app);
    const userAgent = request.agent(app);

    await registerUser(adminAgent, 'admin@example.com');
    promoteUserToAdmin(db, 'admin@example.com');
    const createdUser = await registerUser(userAgent, 'bad-role@example.com');

    const response = await adminAgent.patch(`/api/admin/users/${createdUser.id}/member-type`).send({
      memberType: 'vip',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/member type/i);
  });
```

- [ ] **Step 2: Run the backend tests to confirm failure**

Run:

```bash
cd /Users/tonyhuang/Documents/crystalhuangdance
npm test -- --run server/app.test.js
```

Expected: FAIL because `memberType` is not returned or persisted yet and the admin update endpoint does not exist.

- [ ] **Step 3: Add database support for `member_type`**

Update `/Users/tonyhuang/Documents/crystalhuangdance/server/db.js` with these concrete changes:

```js
  ensureColumn(db, 'users', 'member_type', "TEXT NOT NULL DEFAULT 'dancer'");
```

Expand the prepared statements:

```js
    createUser: db.prepare(
      `INSERT INTO users (email, password_hash, role, member_type)
       VALUES (@email, @passwordHash, @role, @memberType)
       RETURNING id, email, role, member_type AS memberType`
    ),
    findUserByEmail: db.prepare(
      'SELECT id, email, role, member_type AS memberType, password_hash AS passwordHash FROM users WHERE email = ?'
    ),
    findUserById: db.prepare(
      'SELECT id, email, role, member_type AS memberType FROM users WHERE id = ?'
    ),
    setUserRoleByEmail: db.prepare(
      `UPDATE users
       SET role = @role,
           updated_at = CURRENT_TIMESTAMP
       WHERE email = @email
       RETURNING id, email, role, member_type AS memberType`
    ),
    setUserMemberTypeById: db.prepare(
      `UPDATE users
       SET member_type = @memberType,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = @userId
       RETURNING id, email, role, member_type AS memberType`
    ),
```

Update the user list statement:

```js
    listUsersWithUploadCounts: db.prepare(
      `SELECT
          users.id,
          users.email,
          users.role,
          users.member_type AS memberType,
          users.created_at AS createdAt,
          users.updated_at AS updatedAt,
          COUNT(videos.id) AS uploadCount
       FROM users
       LEFT JOIN videos ON videos.user_id = users.id
       GROUP BY users.id
       ORDER BY datetime(users.created_at) DESC, users.id DESC`
    ),
```

Update the returned API surface:

```js
    createUser({ email, passwordHash, role = 'user', memberType = 'dancer' }) {
      return statements.createUser.get({ email, passwordHash, role, memberType });
    },
    setUserMemberTypeById(userId, memberType) {
      return statements.setUserMemberTypeById.get({ userId, memberType }) ?? null;
    },
```

- [ ] **Step 4: Add backend serialization and admin endpoint**

Update `/Users/tonyhuang/Documents/crystalhuangdance/server/app.js`:

```js
const allowedMemberTypes = new Set(['dancer', 'investor']);

function toSafeUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    memberType: user.memberType,
  };
}

function serializeAdminUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    memberType: user.memberType,
    uploadCount: user.uploadCount,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
```

Add the new admin endpoint near the other `/api/admin/users` handlers:

```js
  app.patch('/api/admin/users/:userId/member-type', requireAdmin, (req, res) => {
    const userId = parseIdParam(req.params.userId);
    const memberType = String(req.body?.memberType ?? '').trim().toLowerCase();

    if (!userId) {
      return res.status(400).json({ error: 'A valid user id is required.' });
    }

    if (!allowedMemberTypes.has(memberType)) {
      return res.status(400).json({ error: 'A valid member type is required.' });
    }

    const updatedUser = db.setUserMemberTypeById(userId, memberType);

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({ user: toSafeUser(updatedUser) });
  });
```

- [ ] **Step 5: Run the backend tests to verify they pass**

Run:

```bash
cd /Users/tonyhuang/Documents/crystalhuangdance
npm test -- --run server/app.test.js
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/tonyhuang/Documents/crystalhuangdance
git add server/db.js server/app.js server/app.test.js
git commit -m "add backend member type support"
```

### Task 2: Add Frontend Auth Types and Role-Based Redirects

**Files:**
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/services/auth.ts`
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/context/AuthContext.tsx`
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/pages/LoginPage.tsx`
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/routes/ProtectedRoute.tsx`
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/App.test.tsx`

- [ ] **Step 1: Write the failing frontend tests for login routing**

Add these tests to `/Users/tonyhuang/Documents/crystalhuangdance/src/App.test.tsx`:

```tsx
  it('routes investor users to my investment after login', async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input, init) => {
        const url = typeof input === 'string' ? input : input.toString();

        if (url.endsWith('/api/auth/me')) {
          return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
        }

        if (url.endsWith('/api/auth/login')) {
          return new Response(
            JSON.stringify({
              user: {
                id: 7,
                email: 'jennifer@example.com',
                role: 'user',
                memberType: 'investor',
              },
            }),
            { status: 200 }
          );
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );

    window.history.replaceState({}, '', '/login');
    render(<App />);

    await user.type(screen.getByLabelText(/email/i), 'jennifer@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('heading', { name: /my investment/i })).toBeInTheDocument();
  });

  it('routes dancer users to my videos after login', async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input, init) => {
        const url = typeof input === 'string' ? input : input.toString();

        if (url.endsWith('/api/auth/me')) {
          return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
        }

        if (url.endsWith('/api/auth/login')) {
          return new Response(
            JSON.stringify({
              user: {
                id: 8,
                email: 'dancer@example.com',
                role: 'user',
                memberType: 'dancer',
              },
            }),
            { status: 200 }
          );
        }

        if (url.endsWith('/api/videos')) {
          return new Response(JSON.stringify({ videos: [] }), { status: 200 });
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );

    window.history.replaceState({}, '', '/login');
    render(<App />);

    await user.type(screen.getByLabelText(/email/i), 'dancer@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('heading', { name: /^my videos$/i })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the app tests to confirm failure**

Run:

```bash
cd /Users/tonyhuang/Documents/crystalhuangdance
npm test -- --run src/App.test.tsx
```

Expected: FAIL because `memberType` is missing on the frontend auth model and login always redirects to `/my-videos`.

- [ ] **Step 3: Expand auth types**

Update `/Users/tonyhuang/Documents/crystalhuangdance/src/services/auth.ts`:

```ts
export type MemberType = 'dancer' | 'investor';

export interface AuthUser {
  id: number;
  email: string;
  role: 'user' | 'admin';
  memberType: MemberType;
  name?: string | null;
}
```

- [ ] **Step 4: Add role-aware helpers to auth context**

Update `/Users/tonyhuang/Documents/crystalhuangdance/src/context/AuthContext.tsx`:

```tsx
interface AuthContextValue {
  error: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isDancer: boolean;
  isInvestor: boolean;
  isLoading: boolean;
  getDefaultMemberRoute: () => '/my-videos' | '/investment';
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  user: AuthUser | null;
}
```

Return these values:

```tsx
      isDancer: user?.memberType !== 'investor',
      isInvestor: user?.memberType === 'investor',
      getDefaultMemberRoute: () =>
        user?.memberType === 'investor' ? '/investment' : '/my-videos',
```

- [ ] **Step 5: Make login redirect by member type**

Update `/Users/tonyhuang/Documents/crystalhuangdance/src/pages/LoginPage.tsx`:

```tsx
  const { error, getDefaultMemberRoute, isAuthenticated, isLoading, login, user } = useAuth();
  const from =
    typeof location.state?.from === 'string' ? location.state.from : null;
  const destination = from ?? getDefaultMemberRoute();

  useEffect(() => {
    if (isAuthenticated) {
      navigate(destination, { replace: true });
    }
  }, [destination, isAuthenticated, navigate, user?.memberType]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    try {
      await login({ email, password });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to sign in');
    }
  };
```

- [ ] **Step 6: Make protected redirects role-aware**

Update `/Users/tonyhuang/Documents/crystalhuangdance/src/routes/ProtectedRoute.tsx` to accept an optional fallback:

```tsx
export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireMemberType,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
  requireMemberType?: 'dancer' | 'investor';
}) {
  const { getDefaultMemberRoute, isAdmin, isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to={getDefaultMemberRoute()} replace />;
  }

  if (requireMemberType && user?.memberType !== requireMemberType) {
    return <Navigate to={getDefaultMemberRoute()} replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 7: Run the app tests to verify they pass**

Run:

```bash
cd /Users/tonyhuang/Documents/crystalhuangdance
npm test -- --run src/App.test.tsx
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
cd /Users/tonyhuang/Documents/crystalhuangdance
git add src/services/auth.ts src/context/AuthContext.tsx src/pages/LoginPage.tsx src/routes/ProtectedRoute.tsx src/App.test.tsx
git commit -m "add member type based auth routing"
```

### Task 3: Add the Investor Dashboard Route and Page

**Files:**
- Create: `/Users/tonyhuang/Documents/crystalhuangdance/src/data/investmentDashboardData.ts`
- Create: `/Users/tonyhuang/Documents/crystalhuangdance/src/pages/MyInvestmentPage.tsx`
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/App.tsx`
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/App.test.tsx`

- [ ] **Step 1: Write the failing investor dashboard tests**

Add these tests to `/Users/tonyhuang/Documents/crystalhuangdance/src/App.test.tsx`:

```tsx
  it('renders the investor dashboard for authenticated investor users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input) => {
        const url = typeof input === 'string' ? input : input.toString();

        if (url.endsWith('/api/auth/me')) {
          return new Response(
            JSON.stringify({
              user: {
                id: 9,
                email: 'jennifer@example.com',
                role: 'user',
                memberType: 'investor',
              },
            }),
            { status: 200 }
          );
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );

    window.history.replaceState({}, '', '/investment');
    render(<App />);

    expect(await screen.findByRole('heading', { name: /my investment/i })).toBeInTheDocument();
    expect(screen.getByText(/total invested/i)).toBeInTheDocument();
    expect(screen.getByText(/monthly reports/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download monthly report/i })).toBeInTheDocument();
  });

  it('redirects dancer users away from the investor dashboard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input) => {
        const url = typeof input === 'string' ? input : input.toString();

        if (url.endsWith('/api/auth/me')) {
          return new Response(
            JSON.stringify({
              user: {
                id: 10,
                email: 'dancer@example.com',
                role: 'user',
                memberType: 'dancer',
              },
            }),
            { status: 200 }
          );
        }

        if (url.endsWith('/api/videos')) {
          return new Response(JSON.stringify({ videos: [] }), { status: 200 });
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );

    window.history.replaceState({}, '', '/investment');
    render(<App />);

    expect(await screen.findByRole('heading', { name: /^my videos$/i })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the app tests to confirm failure**

Run:

```bash
cd /Users/tonyhuang/Documents/crystalhuangdance
npm test -- --run src/App.test.tsx
```

Expected: FAIL because the `/investment` route and page do not exist yet.

- [ ] **Step 3: Add fixture data for the investor page**

Create `/Users/tonyhuang/Documents/crystalhuangdance/src/data/investmentDashboardData.ts`:

```ts
export const investmentSummaryCards = [
  { label: 'Total Invested', value: '$79,596.35' },
  { label: 'Portfolio Value', value: '$77,714.40' },
  { label: 'Unrealized P&L', value: '-$1,881.95' },
  { label: 'Total Return', value: '-2.36%' },
];

export const investmentHoldings = [
  { symbol: 'BTC', name: 'Bitcoin', allocation: '29.0%', quantity: '0.35056720', invested: '$23,968.08', value: '$22,549.18', pnl: '-$1,418.90' },
  { symbol: 'ETH', name: 'Ethereum', allocation: '38.2%', quantity: '17.69733550', invested: '$27,597.80', value: '$29,666.04', pnl: '+$2,068.24' },
  { symbol: 'SOL', name: 'Solana', allocation: '6.3%', quantity: '72.16908772', invested: '$5,506.29', value: '$4,933.48', pnl: '-$572.81' },
];

export const investmentReports = [
  { month: 'June 2026', status: 'Latest', actionLabel: 'View' },
  { month: 'May 2026', status: 'Archived', actionLabel: 'View' },
];

export const investmentNotes = [
  'Portfolio remains diversified across core crypto positions.',
  'Monthly report download includes holdings, allocation, and unrealized performance summary.',
];
```

- [ ] **Step 4: Create the investor page**

Create `/Users/tonyhuang/Documents/crystalhuangdance/src/pages/MyInvestmentPage.tsx`:

```tsx
import {
  investmentHoldings,
  investmentNotes,
  investmentReports,
  investmentSummaryCards,
} from '../data/investmentDashboardData';

export default function MyInvestmentPage() {
  return (
    <section className="container-max px-4 pb-16 pt-28 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] border border-[var(--line)] bg-[rgba(238,246,255,0.82)] p-6 shadow-[0_16px_48px_rgba(68,102,136,0.12)] sm:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Private investor portal</p>
            <h1 className="mt-4 font-serif text-5xl leading-none text-[var(--text)] sm:text-6xl">
              My Investment
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--text-muted)]">
              Review your portfolio, monthly reports, and investor notes in one calm dashboard.
            </p>
          </div>
          <button className="rounded-full bg-[var(--text)] px-6 py-3 text-xs uppercase tracking-[0.24em] text-white transition hover:bg-[var(--text-muted)]">
            Download Monthly Report
          </button>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {investmentSummaryCards.map((card) => (
            <article key={card.label} className="rounded-[1.5rem] border border-[var(--line)] bg-white/80 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{card.label}</p>
              <p className="mt-4 text-3xl text-[var(--text)]">{card.value}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
          <section className="rounded-[1.5rem] border border-[var(--line)] bg-white/80 p-6">
            <p className="eyebrow">Portfolio overview</p>
            <h2 className="mt-4 text-3xl text-[var(--text)]">Current Holdings</h2>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3 text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    <th>Asset</th>
                    <th>Quantity</th>
                    <th>Invested</th>
                    <th>Value</th>
                    <th>P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {investmentHoldings.map((holding) => (
                    <tr key={holding.symbol} className="rounded-2xl bg-[rgba(238,246,255,0.72)]">
                      <td className="px-3 py-4">
                        <div className="font-medium text-[var(--text)]">{holding.symbol}</div>
                        <div className="text-sm text-[var(--text-muted)]">
                          {holding.name} · {holding.allocation}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-[var(--text)]">{holding.quantity}</td>
                      <td className="px-3 py-4 text-[var(--text)]">{holding.invested}</td>
                      <td className="px-3 py-4 text-[var(--text)]">{holding.value}</td>
                      <td className="px-3 py-4 text-[var(--text)]">{holding.pnl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-6">
            <section className="rounded-[1.5rem] border border-[var(--line)] bg-white/80 p-6">
              <p className="eyebrow">Reports</p>
              <h2 className="mt-4 text-3xl text-[var(--text)]">Monthly Reports</h2>
              <div className="mt-6 space-y-3">
                {investmentReports.map((report) => (
                  <article key={report.month} className="rounded-2xl border border-[var(--line)] bg-[rgba(238,246,255,0.72)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base text-[var(--text)]">{report.month}</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{report.status}</p>
                      </div>
                      <button className="rounded-full border border-[var(--line)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {report.actionLabel}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-[var(--line)] bg-white/80 p-6">
              <p className="eyebrow">Notes</p>
              <h2 className="mt-4 text-3xl text-[var(--text)]">Investment Notes</h2>
              <ul className="mt-6 space-y-3 text-[var(--text-muted)]">
                {investmentNotes.map((note) => (
                  <li key={note} className="rounded-2xl bg-[rgba(238,246,255,0.72)] px-4 py-3">
                    {note}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Register the route in the app**

Update `/Users/tonyhuang/Documents/crystalhuangdance/src/App.tsx`:

```tsx
import MyInvestmentPage from './pages/MyInvestmentPage';
```

Add the protected route:

```tsx
                <Route
                  path="/investment"
                  element={
                    <ProtectedRoute requireMemberType="investor">
                      <MyInvestmentPage />
                    </ProtectedRoute>
                  }
                />
```

- [ ] **Step 6: Run the app tests to verify they pass**

Run:

```bash
cd /Users/tonyhuang/Documents/crystalhuangdance
npm test -- --run src/App.test.tsx
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/tonyhuang/Documents/crystalhuangdance
git add src/data/investmentDashboardData.ts src/pages/MyInvestmentPage.tsx src/App.tsx src/App.test.tsx
git commit -m "add investor dashboard route and page"
```

### Task 4: Make Navbar and Admin UI Member-Type Aware

**Files:**
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/components/Navbar.tsx`
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/services/admin.ts`
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/pages/AdminPage.tsx`
- Modify: `/Users/tonyhuang/Documents/crystalhuangdance/src/App.test.tsx`

- [ ] **Step 1: Write the failing navigation/admin tests**

Add these tests to `/Users/tonyhuang/Documents/crystalhuangdance/src/App.test.tsx`:

```tsx
  it('shows my investment instead of dancer links for investor users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input) => {
        const url = typeof input === 'string' ? input : input.toString();

        if (url.endsWith('/api/auth/me')) {
          return new Response(
            JSON.stringify({
              user: {
                id: 11,
                email: 'jennifer@example.com',
                role: 'user',
                memberType: 'investor',
              },
            }),
            { status: 200 }
          );
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );

    render(<App />);

    expect(await screen.findAllByRole('link', { name: 'My Investment' })).not.toHaveLength(0);
    expect(screen.queryByRole('link', { name: 'My Videos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Upload' })).not.toBeInTheDocument();
  });
```

Add this admin API test to `/Users/tonyhuang/Documents/crystalhuangdance/server/app.test.js` if not already covered by the endpoint test:

```js
  it('includes member type in the admin user list payload', async () => {
    const adminAgent = request.agent(app);
    const dancerAgent = request.agent(app);

    await registerUser(adminAgent, 'admin@example.com');
    promoteUserToAdmin(db, 'admin@example.com');
    await registerUser(dancerAgent, 'member@example.com');
    db.setUserMemberTypeById(2, 'investor');

    const response = await adminAgent.get('/api/admin/users');

    expect(response.status).toBe(200);
    expect(response.body.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: 'member@example.com',
          memberType: 'investor',
        }),
      ])
    );
  });
```

- [ ] **Step 2: Run the relevant tests to confirm failure**

Run:

```bash
cd /Users/tonyhuang/Documents/crystalhuangdance
npm test -- --run src/App.test.tsx server/app.test.js
```

Expected: FAIL because navbar links and admin client types do not use `memberType` yet.

- [ ] **Step 3: Switch private nav by member type**

Update `/Users/tonyhuang/Documents/crystalhuangdance/src/components/Navbar.tsx`:

```tsx
  const isInvestor = user?.memberType === 'investor';

  const privateLinks = isInvestor
    ? [{ label: 'My Investment', to: '/investment' }]
    : [
        { label: 'My Videos', to: '/my-videos' },
        { label: 'Upload', to: '/upload' },
      ];

  if (isAdmin) {
    privateLinks.push({ label: 'Admin', to: '/admin' });
  }
```

- [ ] **Step 4: Add admin service support for member type updates**

Update `/Users/tonyhuang/Documents/crystalhuangdance/src/services/admin.ts`:

```ts
export interface AdminUserRecord {
  id: number;
  email: string;
  role: 'user' | 'admin';
  memberType: 'dancer' | 'investor';
  uploadCount: number;
  createdAt: string;
  updatedAt: string;
}

export function updateAdminUserMemberType(
  userId: number,
  payload: { memberType: 'dancer' | 'investor' }
) {
  return request<{ user: AdminUserRecord }>(`/api/admin/users/${userId}/member-type`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 5: Add the admin selector UI**

Update `/Users/tonyhuang/Documents/crystalhuangdance/src/pages/AdminPage.tsx`:

1. Import the new service:

```tsx
  updateAdminUserMemberType,
```

2. Add pending state:

```tsx
  const [activeMemberTypeUserId, setActiveMemberTypeUserId] = useState<number | null>(null);
```

3. Add a handler:

```tsx
  const handleMemberTypeChange = async (
    user: AdminUserRecord,
    memberType: 'dancer' | 'investor'
  ) => {
    setActiveMemberTypeUserId(user.id);
    setError(null);

    try {
      const response = await updateAdminUserMemberType(user.id, { memberType });
      setUsers((current) =>
        current.map((entry) => (entry.id === user.id ? { ...entry, memberType: response.user.memberType } : entry))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update member type.');
    } finally {
      setActiveMemberTypeUserId(null);
    }
  };
```

4. Render the selector inside each non-admin user card:

```tsx
  <label className="mt-4 block">
    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
      Member type
    </span>
    <select
      className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white/90 px-4 py-3 text-sm text-[var(--text)]"
      disabled={activeMemberTypeUserId === user.id}
      onChange={(event) =>
        void handleMemberTypeChange(user, event.target.value as 'dancer' | 'investor')
      }
      value={user.memberType}
    >
      <option value="dancer">Dancer</option>
      <option value="investor">Investor</option>
    </select>
  </label>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run:

```bash
cd /Users/tonyhuang/Documents/crystalhuangdance
npm test -- --run src/App.test.tsx server/app.test.js
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/tonyhuang/Documents/crystalhuangdance
git add src/components/Navbar.tsx src/services/admin.ts src/pages/AdminPage.tsx src/App.test.tsx server/app.test.js
git commit -m "add member type controls for nav and admin"
```

### Task 5: Full Verification

**Files:**
- Test: `/Users/tonyhuang/Documents/crystalhuangdance/src/App.test.tsx`
- Test: `/Users/tonyhuang/Documents/crystalhuangdance/server/app.test.js`
- Test: `/Users/tonyhuang/Documents/crystalhuangdance/src/components/*.test.tsx`
- Modify if needed: files touched above

- [ ] **Step 1: Run the full frontend and backend test suites**

Run:

```bash
cd /Users/tonyhuang/Documents/crystalhuangdance
npm test -- --run
```

Expected: PASS

- [ ] **Step 2: Run the production build**

Run:

```bash
cd /Users/tonyhuang/Documents/crystalhuangdance
npm run build
```

Expected: PASS

- [ ] **Step 3: Manual verification checklist**

Verify these live flows:

- admin can change a member from `dancer` to `investor`
- investor login lands on `/investment`
- investor navbar shows `My Investment` and does not show `My Videos` or `Upload`
- dancer login still lands on `/my-videos`
- dancer pages remain visually unchanged
- dancer cannot stay on `/investment`
- investor clicking `Sign out` returns to the public site

- [ ] **Step 4: Commit any follow-up fixes**

```bash
cd /Users/tonyhuang/Documents/crystalhuangdance
git add -A
git commit -m "verify investor member type flow"
```

## Self-Review

- Spec coverage:
  - shared login preserved: Tasks 1-2
  - role-based redirect after login: Task 2
  - role-based navigation: Task 4
  - investor landing page `/investment`: Task 3
  - admin-controlled assignment: Tasks 1 and 4
  - investor dashboard sections: Task 3
- Placeholder scan:
  - no TBD or TODO placeholders
  - every task includes exact file paths and concrete commands
- Type consistency:
  - backend storage uses `member_type`
  - frontend models use `memberType`
  - current permission field `role` remains reserved for `user` / `admin`

