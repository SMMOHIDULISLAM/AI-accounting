import express from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { WhatsAppInbox } from "./whatsapp";
import type { WhatsAppMessage } from "../src/lib/whatsapp-command";
export interface TelegramConfig {
  secret: string;
  inboxToken: string;
  chats: Set<string>;
  users: Set<string>;
  timezone: string;
}
const secretEqual = (a: string, b: string) =>
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
export function telegramConfig(env = process.env): TelegramConfig | undefined {
  const keys = [
    "TG_WEBHOOK_SECRET",
    "TG_INBOX_TOKEN",
    "TG_ALLOWED_CHAT_IDS",
    "TG_ALLOWED_USER_IDS",
  ] as const;
  if (!keys.some((k) => env[k])) return undefined;
  if (keys.some((k) => !env[k]))
    throw Error(
      "Complete all required Telegram settings before enabling intake",
    );
  if (
    !/^[A-Za-z0-9_-]{32,256}$/.test(env.TG_WEBHOOK_SECRET!) ||
    env.TG_INBOX_TOKEN!.length < 32
  )
    throw Error("Use separate strong Telegram webhook and inbox tokens");
  const parse = (value: string) => {
    const ids = value.split(",").map((x) => x.trim());
    if (
      ids.some(
        (x) => !/^-?[1-9]\d{0,15}$/.test(x) || !Number.isSafeInteger(Number(x)),
      )
    )
      throw Error("Invalid Telegram allowlist");
    return new Set(ids);
  };
  const timezone = env.TG_TIMEZONE || "Asia/Dhaka";
  new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  return {
    secret: env.TG_WEBHOOK_SECRET!,
    inboxToken: env.TG_INBOX_TOKEN!,
    chats: parse(env.TG_ALLOWED_CHAT_IDS!),
    users: parse(env.TG_ALLOWED_USER_IDS!),
    timezone,
  };
}
export function telegramMessages(
  payload: unknown,
  config: TelegramConfig,
): WhatsAppMessage[] {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Number.isSafeInteger((payload as any).update_id)
  )
    throw Error("Invalid Telegram update");
  const message = (payload as any).message;
  if (!message) return [];
  if (
    !Number.isSafeInteger(message.chat?.id) ||
    !Number.isSafeInteger(message.from?.id)
  )
    throw Error("Invalid Telegram sender");
  if (
    !config.chats.has(String(message.chat.id)) ||
    !config.users.has(String(message.from.id))
  )
    return [];
  if (typeof message.text !== "string") return [];
  if (
    message.text.length > 8000 ||
    !Number.isSafeInteger(message.message_id) ||
    message.message_id < 1 ||
    !Number.isSafeInteger(message.date) ||
    message.date < 1
  )
    throw Error("Invalid Telegram message");
  const date = new Date(message.date * 1000);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() > 9999)
    throw Error("Invalid Telegram date");
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (key: string) => parts.find((p) => p.type === key)!.value;
  return [
    {
      id: `telegram-${message.chat.id}-${message.message_id}`,
      sender: String(message.from.id),
      timestamp: String(message.date),
      date: `${value("year")}-${value("month")}-${value("day")}`,
      type: "text",
      text: message.text,
    },
  ];
}
export function telegramRoutes(config: TelegramConfig, inbox: WhatsAppInbox) {
  const webhook = express.Router();
  webhook.post("/", express.json({ limit: "256kb" }), (req, res) => {
    if (
      !secretEqual(
        req.get("x-telegram-bot-api-secret-token") || "",
        config.secret,
      )
    ) {
      res.sendStatus(403);
      return;
    }
    let messages: WhatsAppMessage[];
    try {
      messages = telegramMessages(req.body, config);
    } catch {
      res.status(400).json({ error: "Invalid Telegram payload" });
      return;
    }
    try {
      inbox.receive(messages);
      res.sendStatus(200);
    } catch {
      res
        .status(503)
        .json({ error: "Intake storage unavailable; retry delivery" });
    }
  });
  const api = express.Router();
  api.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (
      !secretEqual(
        req.get("authorization") || "",
        `Bearer ${config.inboxToken}`,
      )
    ) {
      res.sendStatus(401);
      return;
    }
    next();
  });
  api.get("/inbox", (_req, res) => {
    try {
      res.json({ messages: inbox.pending() });
    } catch {
      res.sendStatus(503);
    }
  });
  api.post("/ack", express.json({ limit: "2kb" }), (req, res) => {
    if (typeof req.body?.id !== "string" || req.body.id.length > 512) {
      res.sendStatus(400);
      return;
    }
    try {
      inbox.acknowledge(req.body.id);
      res.sendStatus(204);
    } catch {
      res.sendStatus(503);
    }
  });
  return { webhook, api };
}
