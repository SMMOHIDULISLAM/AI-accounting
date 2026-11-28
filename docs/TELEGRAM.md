# Telegram intake and report sharing

Report sharing works by reviewing an editable preview and opening Telegram's official share link. The user chooses the chat and presses Send. This does not configure incoming messages.

## Optional self-hosted incoming bot

This adapter is for **one designated company ledger**, not the multi-company cloud trial. A private HTTPS server with a persistent volume is required for webhooks; loopback-only local hosting cannot receive Telegram delivery directly.

1. Create a bot using Telegram's official BotFather. Keep its token private; do not paste it into GitHub, browser build variables or chat logs.
2. Generate two independent random secrets (at least 32 URL-safe characters). Set `TG_WEBHOOK_SECRET`, `TG_INBOX_TOKEN`, comma-separated `TG_ALLOWED_CHAT_IDS` and `TG_ALLOWED_USER_IDS` privately in `.env`. Set `TG_TIMEZONE=Asia/Dhaka` and a private persistent `TG_INBOX_PATH`. Both chat and sender IDs must be approved; a group chat ID alone is insufficient.
3. Register the HTTPS URL `/webhooks/telegram` using Telegram Bot API `setWebhook` with `secret_token` matching `TG_WEBHOOK_SECRET`. Use an owner-controlled administrative client; never expose the bot token in frontend code. Check `getWebhookInfo` privately. This setup does not call the API or send messages by itself.
4. Send `বিক্রি নগদ ১০০ বাকি ৫০` from an approved account. In the app open Telegram inbox, enter the inbox token (kept in memory), connect and review. Save the draft, then review/post it separately in Transactions.

The webhook validates Telegram's secret-token header before accepting payloads, both allowlists, basic message fields and the configured date zone. Stable chat/message IDs deduplicate redelivery in the durable queue. Acknowledgment follows successful draft persistence. Use the same company ledger for retries. Distinct browsers/ledgers can still import copies of a message into different books; this is not a global multi-company ingestion service.

Only text BDT sales in the supported grammar become drafts. Photos, documents, replies, outgoing bot responses, arbitrary accounting instructions and AI conversations are not implemented. Unknown instructions require manual review. Back up the private inbox separately from the browser ledger.

References checked 27 November 2026: [Telegram sharing](https://core.telegram.org/widgets/share), [Bot API setWebhook and secret_token](https://core.telegram.org/bots/api#setwebhook). Platform limits and policies may change; inspect official documentation before live registration.
