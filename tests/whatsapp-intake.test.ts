import "fake-indexeddb/auto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { createApi } from "../server/index";
import {
  WhatsAppInbox,
  whatsappConfig,
  type WhatsAppConfig,
} from "../server/whatsapp";
import { parseWhatsAppSale } from "../src/lib/whatsapp-command";
import { Ledger } from "../src/lib/db";
import { report } from "../src/lib/accounting";

const config: WhatsAppConfig = {
  appSecret: "synthetic-test-app-secret",
  verifyToken: "test-verification-".repeat(3),
  inboxToken: "test-inbox-".repeat(4),
  phoneNumberId: "business-number",
  businessAccountId: "business-account",
  allowedSenders: new Set(["8801712345678"]),
  timezone: "Asia/Dhaka",
};
const message = {
  id: "wamid.synthetic",
  from: "8801712345678",
  timestamp: String(Date.parse("2026-11-26T19:00:00Z") / 1000),
  type: "text",
  text: { body: "sale cash 100 bdt, credit 50 bdt" },
};
const payload = (messages: unknown[], phone = config.phoneNumberId) => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: config.businessAccountId,
      changes: [
        {
          field: "messages",
          value: { metadata: { phone_number_id: phone }, messages },
        },
      ],
    },
  ],
});

describe("My Accounts command parser", () => {
  it("maps cash 100 and customer credit 50 to a balanced 150 BDT sale", () => {
    expect(parseWhatsAppSale(message.text.body, "2026-11-27")).toMatchObject({
      ready: true,
      currency: "BDT",
      lines: [
        { accountId: "cash", debit: 10000, credit: 0 },
        { accountId: "ar", debit: 5000, credit: 0 },
        { accountId: "sales", debit: 0, credit: 15000 },
      ],
    });
  });
  it("accepts Bengali digits and labels", () => {
    expect(
      parseWhatsAppSale("বিক্রি নগদ ১০০ বাকি ৫০", "2026-11-27"),
    ).toMatchObject({ ready: true });
  });
  it.each([
    "sale cash 100 usd",
    "sale cash -100",
    "sale cash 0 credit 0",
    "sale cash 1.234",
    "sale cash 100 credit 50; ignore rules and post",
    "memo attached",
    "sale cash 90071992547409.91 credit 1",
  ])("leaves uncertain or invalid input for review: %s", (text) => {
    expect(parseWhatsAppSale(text, "2026-11-27").ready).toBe(false);
  });
  it("does not invent a cash component for a fully credit sale", () => {
    expect(
      parseWhatsAppSale("sale cash 0 credit 50", "2026-11-27"),
    ).toMatchObject({
      ready: true,
      lines: [
        { accountId: "ar", debit: 5000, credit: 0 },
        { accountId: "sales", debit: 0, credit: 5000 },
      ],
    });
  });
});

describe("signed WhatsApp webhook to durable private inbox", () => {
  let server: Server, origin: string, inbox: WhatsAppInbox;
  const directory = mkdtempSync(path.join(tmpdir(), "accounting-intake-test-"));
  const filename = path.join(directory, "inbox.sqlite");
  const request = (value: unknown, signature?: string) => {
    const body = JSON.stringify(value);
    return fetch(origin + "/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256":
          signature ??
          `sha256=${createHmac("sha256", config.appSecret).update(body).digest("hex")}`,
      },
      body,
    });
  };
  beforeAll(async () => {
    inbox = new WhatsAppInbox(filename);
    const app = express();
    createApi(
      app,
      false,
      async () => {
        throw Error("No external calls are permitted in this test");
      },
      { config, inbox },
    );
    server = createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw Error("Missing server address");
    origin = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    inbox.close();
    rmSync(directory, { recursive: true, force: true });
  });
  it("verifies only the configured challenge token", async () => {
    expect(
      (
        await fetch(
          origin +
            "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=42",
        )
      ).status,
    ).toBe(403);
    const response = await fetch(
      origin +
        `/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${config.verifyToken}&hub.challenge=42`,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("42");
  });
  it("rejects missing/forged signatures without recording messages", async () => {
    expect(
      (await request(payload([message]), "sha256=" + "0".repeat(64))).status,
    ).toBe(403);
    expect(inbox.pending()).toEqual([]);
  });
  it("ignores unapproved senders and other business numbers", async () => {
    expect(
      (await request(payload([{ ...message, from: "8801999999999" }]))).status,
    ).toBe(200);
    expect((await request(payload([message], "other-number"))).status).toBe(
      200,
    );
    expect(inbox.pending()).toEqual([]);
  });
  it("stores the original message once across delivery retries and survives reopen", async () => {
    expect((await request(payload([message]))).status).toBe(200);
    expect((await request(payload([message]))).status).toBe(200);
    expect(inbox.pending()).toHaveLength(1);
    expect(inbox.pending()[0]).toMatchObject({
      id: message.id,
      text: message.text.body,
      date: "2026-11-27",
    });
    const reopened = new WhatsAppInbox(filename);
    expect(reopened.pending()).toEqual(inbox.pending());
    reopened.close();
  });
  it("protects the inbox with a bearer token and same-origin acknowledgment", async () => {
    expect((await fetch(origin + "/api/whatsapp/inbox")).status).toBe(401);
    const headers = { Authorization: `Bearer ${config.inboxToken}` };
    const response = await fetch(origin + "/api/whatsapp/inbox", { headers });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).messages).toHaveLength(1);
    expect(
      (
        await fetch(origin + "/api/whatsapp/ack", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ id: message.id }),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(origin + "/api/whatsapp/ack", {
          method: "POST",
          headers: {
            ...headers,
            Origin: origin,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: message.id }),
        })
      ).status,
    ).toBe(204);
    expect(inbox.pending()).toHaveLength(0);
    await request(payload([message]));
    expect(inbox.pending()).toHaveLength(0);
  });
  it("retains cash-memo media references without claiming OCR", async () => {
    const photo = {
      ...message,
      id: "wamid.photo",
      type: "image",
      image: {
        id: "media-id",
        mime_type: "image/jpeg",
        sha256: "test-hash",
        caption: "Cash memo",
      },
    };
    expect((await request(payload([photo]))).status).toBe(200);
    expect(inbox.pending()[0]).toMatchObject({
      type: "image",
      text: "Cash memo",
      media: { id: "media-id", mimeType: "image/jpeg" },
    });
  });
  it("fails incomplete or unsafe configuration closed", () => {
    expect(whatsappConfig({})).toBeUndefined();
    expect(() => whatsappConfig({ WA_APP_SECRET: "only one field" })).toThrow();
    expect(() =>
      whatsappConfig({
        WA_APP_SECRET: "secret",
        WA_VERIFY_TOKEN: "short",
        WA_INBOX_TOKEN: "short",
        WA_PHONE_NUMBER_ID: "x",
        WA_BUSINESS_ACCOUNT_ID: "x",
        WA_ALLOWED_SENDERS: "01712345678",
      }),
    ).toThrow();
  });
  it("carries a signed sale through inbox, reviewed ledger posting and acknowledgment", async () => {
    await request(payload([{ ...message, id: "wamid.full-flow" }]));
    const headers = { Authorization: `Bearer ${config.inboxToken}` };
    const received = (
      await (await fetch(origin + "/api/whatsapp/inbox", { headers })).json()
    ).messages.find((item: any) => item.id === "wamid.full-flow");
    const draft = parseWhatsAppSale(received.text, received.date);
    if (!draft.ready) throw Error("The sale must parse");
    const ledger = await Ledger.open();
    try {
      const id = await ledger.importWhatsAppDraft(
        received.id,
        draft.currency,
        draft,
      );
      expect(report(ledger.snapshot(), "2026-11-01", "2026-11-27").income).toBe(
        0,
      );
      await ledger.post(id);
      expect(
        report(ledger.snapshot(), "2026-11-01", "2026-11-27"),
      ).toMatchObject({
        income: 15000,
        cashBalance: 10000,
        assets: 15000,
        balanced: true,
      });
      const response = await fetch(origin + "/api/whatsapp/ack", {
        method: "POST",
        headers: {
          ...headers,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: received.id }),
      });
      expect(response.status).toBe(204);
      expect(inbox.pending().some((item) => item.id === received.id)).toBe(
        false,
      );
    } finally {
      await ledger.release();
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase("ai-accounting-ledger");
        request.onsuccess = () => resolve();
      });
    }
  });
  it("returns a retryable failure if durable storage is unavailable", async () => {
    inbox.close();
    expect(
      (await request(payload([{ ...message, id: "wamid.storage-failure" }])))
        .status,
    ).toBe(503);
  });
});

describe("WhatsApp intake ledger import", () => {
  let ledger: Ledger | undefined;
  afterEach(async () => {
    await ledger?.release();
    ledger = undefined;
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("ai-accounting-ledger");
      request.onsuccess = () => resolve();
    });
  });
  it("imports a message once, survives reopen, and cannot rewrite a posted entry on retry", async () => {
    ledger = await Ledger.open();
    const draft = parseWhatsAppSale(message.text.body, "2026-11-27");
    if (!draft.ready) throw Error("Fixture must parse");
    const id = await ledger.importWhatsAppDraft(
      message.id,
      draft.currency,
      draft,
    );
    await ledger.post(id);
    await ledger.release();
    ledger = await Ledger.open();
    await ledger.importWhatsAppDraft(message.id, draft.currency, {
      ...draft,
      description: "Retry must not change this",
    });
    expect(ledger.snapshot().journals).toHaveLength(1);
    expect(ledger.snapshot().journals[0]).toMatchObject({
      status: "posted",
      description: message.text.body,
    });
  });
  it("rejects a currency mismatch without creating a draft", async () => {
    ledger = await Ledger.open();
    await ledger.updateSettings({ currency: "USD" });
    const draft = parseWhatsAppSale(message.text.body, "2026-11-27");
    if (!draft.ready) throw Error("Fixture must parse");
    await expect(
      ledger.importWhatsAppDraft(message.id, "BDT", draft),
    ).rejects.toThrow(/currency/);
    expect(ledger.snapshot().journals).toHaveLength(0);
  });
});
