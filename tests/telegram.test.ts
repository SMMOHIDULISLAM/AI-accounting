import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApi } from "../server/index";
import { WhatsAppInbox } from "../server/whatsapp";
import { telegramConfig, telegramMessages } from "../server/telegram";
const env = {
  TG_WEBHOOK_SECRET: "synthetic_webhook_".repeat(3),
  TG_INBOX_TOKEN: "synthetic_inbox_".repeat(3),
  TG_ALLOWED_CHAT_IDS: "-100123",
  TG_ALLOWED_USER_IDS: "12345",
};
const config = telegramConfig(env)!;
const payload = {
  update_id: 1,
  message: {
    message_id: 2,
    chat: { id: -100123 },
    from: { id: 12345 },
    date: 1795719600,
    text: "বিক্রি নগদ ১০০ বাকি ৫০",
  },
};
let server: Server, origin: string, inbox: WhatsAppInbox;
const directory = mkdtempSync(path.join(tmpdir(), "telegram-accounting-test-"));
beforeAll(async () => {
  inbox = new WhatsAppInbox(path.join(directory, "inbox.sqlite"));
  const app = express();
  createApi(app, true, fetch, undefined, { config, inbox });
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = "http://127.0.0.1:" + (server.address() as { port: number }).port;
});
afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  inbox.close();
  rmSync(directory, { recursive: true, force: true });
});
const deliver = (value: unknown = payload, secret = config.secret) =>
  fetch(origin + "/webhooks/telegram", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": secret,
    },
    body: JSON.stringify(value),
  });
describe("private Telegram intake", () => {
  it("fails incomplete configuration closed and checks both allowlists", () => {
    expect(telegramConfig({})).toBeUndefined();
    expect(() => telegramConfig({ TG_WEBHOOK_SECRET: "x" })).toThrow();
    expect(
      telegramMessages(
        { ...payload, message: { ...payload.message, from: { id: 999 } } },
        config,
      ),
    ).toEqual([]);
    expect(
      telegramMessages(
        { ...payload, message: { ...payload.message, chat: { id: 999 } } },
        config,
      ),
    ).toEqual([]);
  });
  it("requires a webhook secret and stores delivery retries only once", async () => {
    expect((await deliver(payload, "wrong")).status).toBe(403);
    expect((await deliver()).status).toBe(200);
    expect((await deliver()).status).toBe(200);
    const messages = inbox.pending();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: "telegram--100123-2",
      text: payload.message.text,
      date: "2026-11-27",
    });
  });
  it("protects retrieval and acknowledgment, including cross-origin writes", async () => {
    expect((await fetch(origin + "/api/telegram/inbox")).status).toBe(401);
    const headers = {
      Authorization: "Bearer " + config.inboxToken,
      "Content-Type": "application/json",
    };
    const result = await fetch(origin + "/api/telegram/inbox", { headers });
    expect((await result.json()).messages).toHaveLength(1);
    expect(
      (
        await fetch(origin + "/api/telegram/ack", {
          method: "POST",
          headers: { ...headers, Origin: "https://invalid.example" },
          body: JSON.stringify({ id: "telegram--100123-2" }),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(origin + "/api/telegram/ack", {
          method: "POST",
          headers: { ...headers, Origin: origin },
          body: JSON.stringify({ id: "telegram--100123-2" }),
        })
      ).status,
    ).toBe(204);
    expect(inbox.pending()).toEqual([]);
  });
  it("rejects malformed allowed-sender dates and oversized text", () => {
    expect(() =>
      telegramMessages(
        { ...payload, message: { ...payload.message, date: 1e15 } },
        config,
      ),
    ).toThrow();
    expect(() =>
      telegramMessages(
        { ...payload, message: { ...payload.message, text: "x".repeat(8001) } },
        config,
      ),
    ).toThrow();
  });
});
