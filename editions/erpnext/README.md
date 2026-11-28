# Track 2 — ERPNext foundation

This is an isolated ERP edition for full customer/supplier documents, inventory and ERP workflows. It runs the official ERPNext image separately from the browser ledger. ERPNext is GPL-3.0; its source is linked at https://github.com/frappe/erpnext. Its code is not copied into the React application.

`compose.yaml` adapts Frappe's MIT-licensed `frappe_docker/pwd.yml`, pinned to `beb4f90606c7c0ea1135707be3393528b39cde9c`. The original license is retained in `FRAPPE-DOCKER-LICENSE`. Changes: fixed project name, loopback-only web port, required private DB/admin passwords instead of defaults, and safe environment expansion for site creation. The selected image is `frappe/erpnext:v16.61.0` from that source.

## Local evaluation

Requires Docker Engine/Compose with Linux-container support and sufficient available resources. Docker Desktop's CLI is now installed on the owner's PC, but the Linux engine pipe was unavailable during setup. This stack has **not been launched or tested end to end**. Finish Docker Desktop/WSL setup before evaluation. The YAML and password/port substitutions were checked; that does not prove container startup. This is a local evaluation profile, not a production deployment.

1. Copy `.env.example` to `.env` in this directory.
2. Generate two different random passwords, e.g. `node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"`, and fill the required values privately.
3. From this directory run `docker compose --env-file .env up -d`.
4. Inspect `docker compose logs create-site`. When initialization actually succeeds, open `http://127.0.0.1:8080` and use `Administrator` with your chosen admin password.
5. Configure the company, fiscal year, currency, chart and jurisdiction appropriately, then test disposable documents and backups.

Do not publish the evaluation port or use sample passwords. Preserve the named database/sites volumes. Do not remove volumes to “reset” an installation that contains records. A successful image download or container start is not proof that the site initialized correctly.

## Integration boundary

ERPNext has its own authoritative ledger and MariaDB schema. The Core SQLite restore path must never receive an ERPNext database. This release does not synchronize transactions, tax, inventory or customers across the editions. A future API/document adapter must preserve IDs, currencies, rounding, posting state and audit evidence, with migration tests before use. The 73-project catalog is a research map; it does not claim all those products are deployed or merged.
