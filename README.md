# AI Accounting

AI Accounting is a local-first bookkeeping workbench for learning and keeping a small double-entry ledger. The browser stores ledger data locally; the optional assistant is a drafting aid that can connect only to a local Ollama installation when the server is explicitly started in local mode.

**Current status:** this is the web foundation, not a no-install F-drive portable package. Browser IndexedDB does not move with a removable disk. The earlier F-drive launcher proposal is superseded. The user selected a native Android APK first, Windows second, and USB backups only; see [ANDROID-PLAN.md](ANDROID-PLAN.md). A separate private Android build task has been created. No native Android source or APK is included in this web repository.

This project is not a CPA/CA certification service, auditor, tax-filing tool, or guaranteed worldwide GAAP/IFRS compliance engine. Country and reporting-framework fields are context for the user's work, not an implementation of every jurisdiction's rules. Reports are draft management reports and do not claim to be a complete statutory financial statement set.

## What is local

The browser database is local to the current browser and origin. It is not a shared cloud ledger. Clearing browser storage can remove records, so export `.sqlite` backups regularly and validate restores before relying on them. The database is **not encrypted** by this application. A private source repository protects source-code visibility, not browser records or downloaded backups. The app prevents conflicting writes from multiple tabs rather than silently overwriting another session; use one active tab for the ledger.

The browser sends only the explicitly selected transaction and context to the optional local assistant endpoint. It does not automatically send the complete ledger. The server never executes SQL or posts a journal from model output. Account suggestions remain drafts and always require human review.

## Requirements

For local development, install:

- Node.js 22 or newer
- pnpm 11 or newer
- Ollama, only if local model assistance is wanted

Available project scripts:

```json
{
  "dev": "tsx server/index.ts",
  "local": "tsx server/index.ts --local",
  "build": "vite build && node scripts/copy-wasm.mjs",
  "start": "tsx server/index.ts --production --local",
  "test": "vitest run",
  "check": "tsc --noEmit"
}
```

Install project dependencies:

```bash
pnpm install
```

## Run the app

For the normal Vite development server, which is also the safe preview/cloud mode:

```bash
pnpm dev
```

It listens on `0.0.0.0` and uses `PORT` when supplied, otherwise port `3000`. In this mode the server **does not probe or call loopback Ollama**. `GET /api/ai/status` intentionally returns:

```json
{
  "available": false,
  "reason": "Run the app locally with Ollama to connect AI.",
  "models": []
}
```

The guided rules and manual account controls remain available. A development preview is not model-powered merely because an AI panel is visible.

To run the app on your own computer with local Ollama enabled:

```bash
pnpm local
```

This binds to `127.0.0.1` and permits the server to call only these fixed Ollama endpoints:

- `http://127.0.0.1:11434/api/tags`
- `http://127.0.0.1:11434/api/chat`

Production-style local serving after a frontend build is:

```bash
pnpm build
pnpm start
```

`start` uses `--production --local`, serves the built SPA from `dist`, and still binds to `127.0.0.1`. `/health` returns HTTP 200 with `{ "ok": true }` when the server is ready. API paths are never replaced with the SPA fallback; unknown API routes return an API 404.

## Install a local model

Start Ollama, then pull a model you choose:

```bash
ollama serve
ollama pull <a-local-model-you-have-chosen>
```

Do not assume a fixed model ID: model availability, quality, memory use, and download size change over time. The application lists installed models from Ollama and filters names/metadata that identify cloud or remote models. Cloud/remote models are rejected, and there is no paid provider or cloud fallback.

The first model download can use substantial disk space, memory, CPU/GPU resources, electricity, and time. Higher-quality models may need substantially more memory. No model is guaranteed to classify accounting correctly. Review the economic substance, questions, account options, debit/credit effect, and applicable local requirements yourself. The server forces `needsReview: true`, validates suggested account IDs against the supplied chart of accounts, and rejects malformed model output.

If Ollama is stopped, unavailable, has no eligible local model, times out, or returns invalid structured output, the app reports an error. It does not fabricate a successful answer or silently switch to a paid/cloud service.

## Local AI boundaries

`POST /api/ai/chat` accepts a bounded JSON request containing a selected model, user/assistant messages, country and framework context, the supplied account list, and an optional transaction. Requests are same-origin only, rate-limited, size-limited, and given a finite upstream timeout. The model receives a strong instruction to treat transaction data as untrusted data rather than instructions, not to assume a complete ledger, explain uncertainty, distinguish accounting qualifications from standards, avoid certification claims, and never produce SQL or autonomous posting commands.

The server validates the returned JSON shape:

```json
{
  "explanation": "...",
  "questions": ["..."],
  "options": [
    { "accountId": "account-id-from-the-request", "reason": "..." }
  ],
  "needsReview": true
}
```

Only account IDs in the request are accepted. Even if a model returns `needsReview: false`, the server changes it to `true` before returning it to the browser.

## Safety and backup reminders

Use the guided rules when local AI is unavailable or disabled. Check dates, descriptions, amounts, account heads, tax treatment, recognition timing, and the debit/credit balance before posting. A model can be confidently wrong, and framework-specific recognition, tax, disclosures, policies, comparatives, and jurisdiction-specific filings may require qualified local advice.

Export backups from the app and keep more than one copy in a safe location. Test a restore. Browser storage, downloads, and any computer running Ollama may be accessible to other users or software on that computer. This application does not encrypt the database, backups, or Ollama's local model files.

## Latest storage test evidence

See [SQLITE-BACKUP-TESTS.md](SQLITE-BACKUP-TESTS.md). Twenty-one regression tests pass, plus 16 supplementary backup preflight checks and nine host-SQLite aggregate checks. Two restored-data validation gaps were fixed: mismatched parent account type and reconciliation outside the three-day limit. These checks use synthetic data; they do not verify Android-device SQLite or a physical USB/Android document-provider workflow. Those native checks remain with the dedicated Android build task.

## Repository and deployment status

The private repository https://github.com/SMMOHIDULISLAM/AI-accounting was created through owner authorization, and the saved source transfer was verified and completed on 20 November 2026. The web foundation is available in Preview but has not been published. Native Android, subsequent Windows packaging and online/mobile synchronization remain unfinished. The earlier F-drive runtime proposal has been replaced by USB backups only. No paid hosting, cloud ledger, API purchase, billing integration, or cloud inference is required for the current local-run source version.
