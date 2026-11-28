import { spawn } from "node:child_process";
const edition = process.argv[2];
if (!["core", "whatsapp"].includes(edition))
  throw Error(
    "Choose core or whatsapp; ERPNext uses editions/erpnext/compose.yaml",
  );
const env = {
  ...process.env,
  AI_ACCOUNTING_EDITION: edition,
  PORT: process.env.PORT || (edition === "core" ? "3001" : "3002"),
};
if (edition === "core")
  for (const key of [
    "WA_APP_SECRET",
    "WA_VERIFY_TOKEN",
    "WA_INBOX_TOKEN",
    "WA_PHONE_NUMBER_ID",
    "WA_BUSINESS_ACCOUNT_ID",
    "WA_ALLOWED_SENDERS",
    "TG_WEBHOOK_SECRET",
    "TG_INBOX_TOKEN",
    "TG_ALLOWED_CHAT_IDS",
    "TG_ALLOWED_USER_IDS",
  ])
    env[key] = "";
const child = spawn(
  process.execPath,
  [
    "--env-file-if-exists=.env",
    "--import",
    "tsx",
    "server/index.ts",
    "--production",
    "--local",
  ],
  {
    cwd: new URL("../", import.meta.url),
    env,
    stdio: "inherit",
    windowsHide: true,
  },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
process.once("SIGINT", () => child.kill("SIGINT"));
process.once("SIGTERM", () => child.kill("SIGTERM"));
