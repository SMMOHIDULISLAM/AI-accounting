# Platform setup and module map — 0.5 learning preview

## What is working

The local English/Bangla web app, exact-money SQLite ledger, source imports, reviewed journal posting, separate supply-chain/manufacturing/HR workflow, rule-based agent coordinator, optional local OCR, WhatsApp intake adapter, Telegram intake adapter and reviewed report sharing are implemented. Live messaging requires owner credentials. The separate ERPNext profile is not a synchronized extension of this ledger.

The trial schema has owner RLS, server-assigned 30-day dates and optimistic revision checks. Public hosting, authentication email redirects and real registration must be verified before announcing the online trial. This release is not independently certified or established as suitable for every industry or enterprise workload.

## Run locally without paid APIs

Use Node 24 and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm free
```

On the owner's prepared PC, open `D:\AI-Accounting\START-FREE.cmd`, then `http://127.0.0.1:3002/whatsapp`. Keep its window open. The app binds loopback; the original browser/origin retains its ledger. The launcher loads an optional private `.env`. No paid AI key is needed. Local device, electricity, optional channel charges and cloud provider quotas remain outside the software price.

## Editable modules

| Module | Responsibility | Contract |
|---|---|---|
| `src/`, HTML/CSS, React/TypeScript | Browser interface, Bangla, journal review | Exact minor units; custom names preserved |
| `src/lib/db.ts` | SQLite accounting and backup validation | Posted journals protected through this API |
| `src/lib/operations.ts` | Pure procurement, BOM, production, sales, HR transitions | Integer quantity thousandths; immutable command result |
| `src/lib/operations-posting.ts` | Operational proposals into ledger drafts | Stable proposal ID, currency/name/type checks |
| `src/lib/agent-plan.ts` | Authoritative rules and reviewed tools | Does not directly post/pay/send |
| `engines/python/planner.py` | Optional read-only Python planner | JSON stdin/stdout; checked against TypeScript policy |
| `engines/java/PayrollEngine.java` | Optional exact configurable payroll arithmetic | Five integer CLI arguments, JSON result |
| `engines/cpp/cost_engine.cpp` | Optional exact stock costing | Three integer arguments, JSON result; GCC/Clang C++17 |
| `server/engines.ts` | Local engine boundary | Fixed scripts, no shell, bounded input/output/time |
| `server/whatsapp.ts`, `server/telegram.ts` | Optional single-company private message queues | Authentication and allowlists; separate SQLite files |
| `src/lib/cloud.ts`, `editions/cloud/` | Private owner trial storage | Auth, owner RLS, revision conflict rejection |
| `editions/erpnext/` | Isolated full-ERP evaluation | Separate database, source license and migration boundary |

Set `PYTHON_EXECUTABLE`, `JAVA_EXECUTABLE` or `CPP_COST_ENGINE` to trusted server-owned absolute executable paths in `.env` to opt into native checks. Java requires Java 17+ source-file mode. Build C++ with `g++ -std=c++17 -O2 engines/cpp/cost_engine.cpp -o engines/cpp/cost-engine` (Windows GCC output may end in `.exe`). The C++ code uses `unsigned __int128`; MSVC is not supported. Without these executables, exact TypeScript calculations remain available. Native payroll/cost APIs are developer adapters; operational UI calculations use the authoritative TypeScript rules.

```sh
python scripts/verify-polyglot.py
python scripts/verify-polyglot.py --native
pnpm check
pnpm test
pnpm verify:sources
pnpm build
pnpm smoke
```

The `--native` command compiles C++ and executes Java; it needs those toolchains. CI has a separate job for this. Source presence does not prove native execution on the owner's PC.

## Cloud deployment

1. Use a Supabase **Free** project in the explicitly approved organization; do not upgrade or add paid resources automatically. Apply `editions/cloud/schema.sql` once, then run `editions/cloud/verify-rls.sql` and the security advisor. The verification fixtures roll back.
2. Enable confirmed email/password sign-in. Set Auth Site URL and the allowed redirect URL to the final HTTPS trial origin. Configure a suitable email provider and test delivery. Never disable confirmation just to get a passing test.
3. Set build variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (modern public `sb_publishable_` key). Never use service-role, secret, bank or messaging credentials in `VITE_` variables.
4. Run `pnpm build:cloud`. Output is **dist-cloud**; the local **dist** stays separate. `netlify.toml` provides an SPA fallback, security headers and an explicit unavailable response for self-hosted APIs.
5. Deploy only to the owner's Free Netlify team and intended site. An existing CLI login for another account must not be used. Disable site-wide team SSO only when the authentication-protected trial build is ready for public registration.
6. Test registration/confirmation/login, company creation, save/reload, sign-out, second-owner isolation, expiry read/export and rejected writes. Database RLS tests do not replace a successful browser registration test.

Trial dates are generated by Postgres, not the device clock. After 30 days the owner can still read/export while ledger and operations writes are denied. There is no payment collection or automatic conversion to a paid subscription. Limits: one owner/company, 4 MB binary ledger, 1 MB operations JSON and 5,000 entries in each operational collection. Concurrent sessions reject stale writes; reload before retrying. Operations and ledger saves are separate transactions. Bulk binary snapshots are a learning prototype, not an enterprise journal service or cryptographically immutable audit log.

The project does not yet include team roles, MFA enforcement, independent penetration testing, retention/deletion self-service, company-owned channel credentials per tenant, statutory tax/payroll engines, or verified disaster recovery at scale. Corporate deployment requires those controls and jurisdiction-specific review.

## Operational scope and backups

Purchases are full receipt only. Production uses BOM material cost and daily centre minutes; no labour/overhead absorption, scrap, lots, partial completions or subcontract costing. Dispatch reserves cost into transit; delivery proposes receivable/sales and COGS/inventory journals. Returns, cancellations, partial fulfilment and payments need further workflows. Payroll approval accrues a liability; it does not transfer money. Attendance is recorded separately and paid days must be confirmed. Market share uses only user-supplied market totals.

Export BOTH the SQLite ledger and operations JSON. Restore and reconcile them as a matched set. Keep a consistent SQLite backup of each configured server inbox separately (including proper WAL handling). The app does not encrypt browser records or backups. Never commit financial data or `.env` files.

## Bank and corporate email

CSV import and reconciliation are available. Direct bank account feeds, SMS/email alert ingestion and Android notification permissions are not implemented here. A future read-only authorized feed must normalize bank references, amounts and currency, deduplicate alerts, preserve source evidence and create reviewed drafts. Never ask users for banking passwords or OTPs.

Reports can prepare email drafts using the user's email app, after recipient and amount review. No SMTP credentials, automatic sending or inbound mailbox access are configured. A corporate procedure should name preparer, reviewer and approver, require source documents, reconcile control totals and retain approvals. UI review buttons do not establish enforceable corporate segregation of duties in this single-owner preview.
