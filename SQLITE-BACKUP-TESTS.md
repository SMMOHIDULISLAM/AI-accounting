# SQLite and local-backup test report

**Date:** 20 November 2026. **Result:** foundation and host preflight testing completed; Android-device SQLite and physical USB testing are not yet verified.

## Scope and safety

At inspection, the dedicated Android task had only begun initialization and had not supplied native SQLite migrations, a native backup adapter or an APK. This originating task contains the web foundation. Tests here used synthetic data in isolated processes, SQLite WASM with fake IndexedDB, and ordinary sandbox files. No user ledger, user PC drive, phone or USB disk was accessed. A directory named `USB simulation` is a local test destination, not mounted USB hardware.

The user request and the remaining native test scope were sent to the existing Android build task: https://manus.im/app/kmzg4ozr5REneMxY5BX8LC. Message acceptance is not a completed native test.

## Executed accounting/storage baseline

Initial existing accounting/storage suite: **15 passed**. After adding two restore regression cases and fixing the corresponding validator defects, the full suite is **21 passed**: 17 accounting/storage/CSV/report tests and four mock local-AI safety tests. TypeScript check, production web build and diff whitespace checks passed. No real AI model was called.

The existing controls cover stable seeded accounts, exact minor-unit parsing, CSV validation/duplicates, balanced nonzero posting, posted immutability, reversing journals, atomic source-to-draft classification, signed/date-bounded reconciliation, serialized persistence and reopen, backup round-trip and invalid backup rejection.

## Backup preflight: 16 passed after fixes

A synthetic fixture included a custom child account, settings with guidance disabled, transaction sources and reconciliation links, posted sale and fee entries, a reversal, an incomplete draft, and audit history. The raw export was a **61,440-byte SQLite file**, not JSON with a `.sqlite` filename.

SHA-256 of the final test export:

```text
a748704853cef90faf2c2007239c68cf7bd1a2854d201abcc018a26042fb8f7d
```

All 16 checks passed:

1. SQLite file header is genuine.
2. Valid restore replaces later synthetic mutations and reproduces every snapshot category.
3. Closing and reopening retains the restored data.
4. Copy to a local destination with spaces and Bengali characters retains the same SHA-256 and restores correctly.
5. Truncated database is rejected without changing current data.
6. Damaged header is rejected without changing current data.
7. Unknown schema version is rejected without changing current data.
8. Missing required table is rejected without changing current data.
9. Broken account foreign key is rejected without changing current data.
10. Unsupported currency is rejected without changing current data.
11. Invalid journal date is rejected without changing current data.
12. Fractional debit accepted by SQLite's affinity rules is rejected by ledger validation without changing current data.
13. Unbalanced posted journal is rejected without changing current data.
14. Restored reconciliation outside the three-day limit is rejected without changing current data.
15. Restored parent account of a different account type is rejected without changing current data.
16. A nonexistent local transfer destination raises an error without changing the live ledger.

### Defects found and corrected

Before correction, items 14 and 15 failed: restored backups bypassed the date limit for reconciliation or allowed a child linked to a parent of another type. Both were already prohibited during ordinary live entry but omitted from restored-data validation. The validator now applies the same rules to restored records. Two permanent regression tests prove rejection preserves the original snapshot. These are corrections to the **web foundation**, not proof that a native port has already incorporated them.

## Native Android and physical USB: outstanding

| Check | Evidence status |
| --- | --- |
| Actual Expo/native SQLite schema creation, migrations and idempotent initialization | Not run on Android |
| App-private database survives native process death/relaunch offline | Not run on Android |
| Native transactions, foreign-key enablement on every connection and concurrency behavior | Not run on Android |
| Consistent native SQLite/WAL snapshot including queued writes | Not tested by a web export |
| User-selected Android save/document provider writes to an actual USB-OTG disk | No phone/USB attached; not run |
| Pick a backup from USB, validate, confirm replacement and restore native ledger | Not run |
| Picker cancellation, denied/revoked URI access and unsupported USB provider | Native adapter not available here |
| Unplugged USB, partial write, full storage, permission failure and safe recovery | Physical/provider tests outstanding |
| Restore confirmation, rollback on failure, and synchronization of native screen state | Native tests outstanding |

### Physical-device verification to perform when APK exists

Use a disposable test ledger, not important accounts. Record phone model, Android version, APK/checkpoint, selected file provider and USB filesystem. In airplane mode, create and post a balanced sale, import a CSV, create a draft and confirm a reconciliation. Kill and relaunch the app; verify persistence. Connect USB-OTG and explicitly select the USB destination in Android's picker. Save the backup, verify its presence and size, safely reconnect the drive and verify its hash/integrity. Make a later test transaction. Pick the earlier backup, confirm replacement and verify all restored categories and report totals; the later test transaction should no longer be present. Cancel export and restore dialogs, deny/revoke file access, and interrupt a disposable export by unplugging the drive; the live ledger must remain unchanged and incomplete backups must not be accepted. Test a corrupt/unknown-version backup and verify the original native database is preserved. Record actual failures instead of treating simulated host file-copy results as device passes.

Backups contain financial data. Store USB copies securely. No encryption or password protection is asserted by these tests.

## Reproduction

Web regression/check/build commands, from the web source root:

```sh
pnpm test
pnpm check
pnpm build
```

Supplementary synthetic test source and raw JSON evidence are retained in the originating task's `accounting-native-preflight` directory and sent to the Android task as an attached verification bundle. These helpers use the existing web implementation and host filesystem; they are not native UI tests.

## Independent host SQLite schema verification

**Nine aggregate checks passed, zero failures**, using Python sqlite3 and SQLite **3.45.1** on the sandbox host. The original export was opened read-only; all mutation probes used temporary copies. This is real host-engine SQLite verification, **not Android SQLite execution**.

- `PRAGMA integrity_check`: `ok`.
- `PRAGMA foreign_key_check`: no violations.
- Application metadata schema version: `1`. SQLite's internal DDL `PRAGMA schema_version` was `7`; these are different version concepts.
- Seven required tables present: `meta`, `accounts`, `journals`, `lines`, `sources`, `settings`, `audit`. Counts: meta 1, accounts 15, journals 4, lines 7, sources 2, settings 1, audit 12. Snapshot category counts, references, reconciliation-line relationships and integer stored amounts matched the fixture.
- Duplicate account code, invalid account type, invalid foreign key with enforcement enabled, negative debit and simultaneous positive debit/credit were rejected.
- Transaction rollback removed the probe row and restored the original count.
- Extracted `CREATE TABLE IF NOT EXISTS` initialization was idempotent, with unchanged table names and counts.

**Important native-port boundaries:** the present schema uses SQLite INTEGER affinity rather than STRICT tables; a direct SQL probe accepted `1.5` as REAL. There are no SQL triggers enforcing balanced posting or posted immutability; direct SQL could create an unbalanced posted record or edit a posted record. Those protections currently reside in the ledger API and restore validator. This is not a claim that the public accounting API permits those operations. The native port must preserve exact integer checks, balance/immutability/reversal rules, parent-type and reconciliation checks, and validated import/restore. Enable `PRAGMA foreign_keys=ON` on every connection, not just during initial schema creation. Merely copying the DDL does not port the accounting safeguards.

Raw host evidence and the reusable host verifier are included in the verification handoff bundle sent to the Android task.
