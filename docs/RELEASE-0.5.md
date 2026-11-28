# Release 0.5 verification scope

Prepared 28 November 2026, Asia/Dhaka. This is an engineering-tested learning preview, not a professionally certified accounting product.

- 111 app tests passed, covering existing accounting controls plus Bangla input, injected cloud storage/rollback, operational transitions, journal proposal idempotency, engine boundaries, Telegram intake and reviewed channel URLs.
- TypeScript checking, both local/cloud builds, production smoke check and frozen lockfile validation passed. Vite still reports a main JavaScript chunk slightly over 500 kB; performance on low-end devices needs measurement.
- The two retained source snapshots verify against 66 recorded hashes. Their 35 retained Ledger Reborn Python tests pass. Other catalog entries remain references with recorded license signals.
- Isolated installed-Chrome tests pass: Bangla sale draft → posting → reload → reports; language persistence; purchase receipt → raw materials → WIP → finished goods → transit → delivery; attendance/payroll accrual; reviewed agent replenishment; operational proposal → ledger draft; JSON backup → restore → reload; 390-pixel layouts; no page errors. All records were synthetic in isolated browser contexts, never the owner's live ledger.
- The Python planner executes locally. Java and C++ sources have exact-result adapters and a separate native CI job; their toolchains were unavailable on the owner's PC during this setup.
- Actual Supabase RLS verification passes: separate owner isolation, protected trial timestamps, stale-revision rejection, expired-owner reading/export and denied writes, denied anonymous table access. Synthetic fixtures are rolled back. The security advisor returned no lints. This is not an independent penetration test.
- The cloud build's private-registration screen renders in English/Bangla. The real Data API rejects anonymous company reads (401). Email confirmation, successful real registration and the final public hosting URL still require end-to-end verification before accepting users.

Self-hosted channel tests use synthetic webhook payloads. Live WhatsApp/Telegram credentials, bot registration, Meta approval, cloud inbox tenancy and paid-service policies are not completed by these tests. Email is a reviewed mail-client draft. Bank feeds and notification listeners remain unfinished. The ERPNext Linux Docker engine was unavailable; the separate ERP service is not running.

See [platform setup](PLATFORM-SETUP.md) for limits and [professional review](PROFESSIONAL-REVIEW.md) for the proposed review procedures. Do not advertise successful CI, live registration, certification or native execution on a particular machine without separate evidence for that claim.
