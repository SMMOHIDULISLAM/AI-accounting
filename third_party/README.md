# Retained accounting source

The repository retains these source snapshots, not installed competing ledgers:

| Source | Pinned commit | License | Retained material and use |
|---|---|---|---|
| [Ledger Reborn](https://github.com/lxistired/ledger-reborn) | `d7f6b8a1f4ad6c4ae8b10100d1c93cf15940c21d` | MIT | Original Python accounting engine, policy readme, synthetic fixtures and three engine test modules; journal/aging adapter and adapted allocation/costing policies in our app |
| [OpenQBW](https://github.com/Sigilweaver/OpenQBW) | `f57bb213cf0f287a4da93f23498e6e5882798edf` | Apache-2.0 | Rust workspace, Python bindings, CLI, lockfile, specification, tests/synthetic QBW fixtures, LICENSE and NOTICE; our app inspects its version-1 SQLite exports |

`provenance.json` hashes all 66 retained files. Run `pnpm verify:sources` to detect changes. These source files are unmodified; app adaptations are separate and labelled. Native Rust builds were not executed because Cargo was unavailable. Preserving code is not evidence that its full runtime is installed or active in AI Accounting.

The SQLite-design repository at `dad5dfd178d7d9effe3e03cac8d7358ac6d0f1e3` had no redistribution license found in its source/readme. Its code, database, spreadsheet and CSV data are **not copied**. Our signed manual-journal reader is independently written against the inspected table/column interface. It requires a sign convention and currency confirmation, and excludes document tables explicitly.

The other user-requested projects are retained as the verified metadata/source catalog at `public/accounting-repositories.json`. Each shows its actual integration state. Metadata license signals (especially NOASSERTION/undetected licenses) require full file/module review before future code reuse. GPL/AGPL/LGPL and custom licenses are not silently changed or erased. No owner ledgers, proprietary company files or upstream private financial corpora were copied.

The ERP edition separately retains an adaptation of the MIT Frappe Docker launch profile and its license under `editions/erpnext/`; the GPL ERPNext image/application remains an independent service.
