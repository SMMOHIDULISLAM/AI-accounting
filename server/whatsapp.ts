import express from "express";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { WhatsAppMessage } from "../src/lib/whatsapp-command";

export interface WhatsAppConfig {
  appSecret: string;
  verifyToken: string;
  inboxToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  allowedSenders: Set<string>;
  timezone: string;
}

export function whatsappConfig(env = process.env): WhatsAppConfig | undefined {
  const names = [
    "WA_APP_SECRET",
    "WA_VERIFY_TOKEN",
    "WA_INBOX_TOKEN",
    "WA_PHONE_NUMBER_ID",
    "WA_BUSINESS_ACCOUNT_ID",
    "WA_ALLOWED_SENDERS",
  ] as const;
  if (!names.some((name) => env[name])) return undefined;
  if (names.some((name) => !env[name]))
    throw new Error(
      "Complete all required WhatsApp settings before enabling intake. See docs/WHATSAPP.md.",
    );
  if (env.WA_VERIFY_TOKEN!.length < 32 || env.WA_INBOX_TOKEN!.length < 32)
    throw new Error(
      "WhatsApp verification and inbox tokens must be at least 32 characters.",
    );
  const allowedSenders = new Set(
    env.WA_ALLOWED_SENDERS!.split(",").map((value) => value.trim()),
  );
  if ([...allowedSenders].some((value) => !/^[1-9]\d{6,14}$/.test(value)))
    throw new Error(
      "WA_ALLOWED_SENDERS must contain international phone digits, separated by commas.",
    );
  const timezone = env.WA_TIMEZONE || "Asia/Dhaka";
  new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  return {
    appSecret: env.WA_APP_SECRET!,
    verifyToken: env.WA_VERIFY_TOKEN!,
    inboxToken: env.WA_INBOX_TOKEN!,
    phoneNumberId: env.WA_PHONE_NUMBER_ID!,
    businessAccountId: env.WA_BUSINESS_ACCOUNT_ID!,
    allowedSenders,
    timezone,
  };
}

function equalSecret(left: string, right: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(left), digest(right));
}

export function validSignature(
  body: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(
    createHmac("sha256", secret).update(body).digest(),
    Buffer.from(signature.slice(7), "hex"),
  );
}

function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}
function dateAt(timestamp: string, timezone: string): string {
  const date = new Date(Number(timestamp) * 1000);
  if (
    !/^\d{1,12}$/.test(timestamp) ||
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() < 1 ||
    date.getUTCFullYear() > 9999
  )
    throw new Error("Invalid message timestamp");
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}

/** Retain only allowed senders and the configured Business account/number. */
export function incomingMessages(
  payload: any,
  config: WhatsAppConfig,
): WhatsAppMessage[] {
  if (
    payload?.object !== "whatsapp_business_account" ||
    !Array.isArray(payload.entry)
  )
    throw new Error("Invalid WhatsApp event");
  const messages: WhatsAppMessage[] = [];
  for (const entry of payload.entry) {
    if (entry?.id !== config.businessAccountId || !Array.isArray(entry.changes))
      continue;
    for (const change of entry.changes) {
      const value = change?.value;
      if (
        change?.field !== "messages" ||
        value?.metadata?.phone_number_id !== config.phoneNumberId ||
        !Array.isArray(value.messages)
      )
        continue;
      for (const item of value.messages) {
        if (!config.allowedSenders.has(item?.from)) continue;
        if (
          !text(item.id, 512) ||
          !text(item.timestamp, 12) ||
          !text(item.type, 40)
        )
          throw new Error("Invalid message fields");
        const media =
          item.type === "image"
            ? item.image
            : item.type === "document"
              ? item.document
              : undefined;
        const body =
          item.type === "text" ? item.text?.body : media?.caption || "";
        if (typeof body !== "string" || body.length > 8000)
          throw new Error("Invalid message text");
        if (
          media &&
          (!text(media.id, 512) ||
            !text(media.mime_type, 120) ||
            !text(media.sha256, 128))
        )
          throw new Error("Invalid media fields");
        messages.push({
          id: item.id,
          sender: item.from,
          timestamp: item.timestamp,
          type: item.type,
          date: dateAt(item.timestamp, config.timezone),
          text: body,
          ...(media
            ? {
                media: {
                  id: media.id,
                  mimeType: media.mime_type,
                  sha256: media.sha256,
                },
              }
            : {}),
        });
      }
    }
  }
  return messages;
}

/** This is a durable intake queue, separate from the browser's ledger. */
export class WhatsAppInbox {
  private db: DatabaseSync;
  constructor(filename: string) {
    if (filename !== ":memory:")
      mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, message TEXT NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0, received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    );
  }
  receive(messages: WhatsAppMessage[]): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const insert = this.db.prepare(
        "INSERT OR IGNORE INTO inbox(id,message) VALUES (?,?)",
      );
      for (const message of messages)
        insert.run(message.id, JSON.stringify(message));
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  pending(): WhatsAppMessage[] {
    return this.db
      .prepare(
        "SELECT message FROM inbox WHERE acknowledged=0 ORDER BY received_at,id LIMIT 100",
      )
      .all()
      .map((row) => JSON.parse(String(row.message)));
  }
  acknowledge(id: string): void {
    this.db.prepare("UPDATE inbox SET acknowledged=1 WHERE id=?").run(id);
  }
  close(): void {
    if (this.db.isOpen) this.db.close();
  }
}

export function whatsappRoutes(config: WhatsAppConfig, inbox: WhatsAppInbox) {
  const webhook = express.Router();
  webhook.get("/", (req, res) => {
    const token = req.query["hub.verify_token"],
      challenge = req.query["hub.challenge"];
    if (
      req.query["hub.mode"] === "subscribe" &&
      typeof token === "string" &&
      equalSecret(token, config.verifyToken) &&
      typeof challenge === "string" &&
      challenge.length <= 200
    )
      res.type("text/plain").send(challenge);
    else res.sendStatus(403);
  });
  webhook.post(
    "/",
    express.raw({ type: "application/json", limit: "1mb" }),
    (req, res) => {
      if (
        !Buffer.isBuffer(req.body) ||
        !validSignature(
          req.body,
          req.get("x-hub-signature-256"),
          config.appSecret,
        )
      ) {
        res.sendStatus(403);
        return;
      }
      let messages: WhatsAppMessage[];
      try {
        messages = incomingMessages(
          JSON.parse(req.body.toString("utf8")),
          config,
        );
      } catch {
        res.status(400).json({ error: "Invalid WhatsApp payload" });
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
    },
  );
  const api = express.Router();
  api.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (
      !equalSecret(
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
      res.status(503).json({ error: "Intake storage unavailable" });
    }
  });
  api.post("/ack", express.json({ limit: "2kb" }), (req, res) => {
    if (!text(req.body?.id, 512)) {
      res.sendStatus(400);
      return;
    }
    try {
      inbox.acknowledge(req.body.id);
      res.sendStatus(204);
    } catch {
      res.status(503).json({ error: "Intake storage unavailable" });
    }
  });
  return { webhook, api };
}
