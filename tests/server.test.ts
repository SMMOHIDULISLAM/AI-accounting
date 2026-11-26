import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createServer, type Server } from "node:http";
import express from "express";
import { createApi } from "../server/index";

let server: Server;
let mode = "empty";
let origin: string;
beforeAll(async () => {
  const transport: typeof fetch = async (url) => {
    if (String(url) === "http://127.0.0.1:11434/api/tags")
      return new Response(
        JSON.stringify({
          models:
            mode === "empty"
              ? []
              : mode === "remote"
                ? [
                    {
                      name: "renamed-model",
                      remote_host: "https://example.invalid",
                    },
                  ]
                : [{ name: "mock-test-model" }],
        }),
      );
    expect(String(url)).toBe("http://127.0.0.1:11434/api/chat");
    return new Response(
      JSON.stringify({
        message: {
          content: JSON.stringify({
            explanation: "Mock response for adapter validation only.",
            questions: ["Was the service delivered?"],
            options: [
              {
                accountId: "sales",
                reason: "Only if earned and not already recorded.",
              },
            ],
            needsReview: false,
          }),
        },
      }),
    );
  };
  const app = express();
  createApi(app, true, transport);
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("Test server did not start");
  origin = `http://127.0.0.1:${address.port}`;
}, 10000);
afterAll(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
});
const request = {
  model: "mock-test-model",
  messages: [{ role: "user", content: "A customer paid me." }],
  context: {
    country: "Bangladesh",
    framework: "General accrual bookkeeping",
    accounts: [
      {
        id: "sales",
        name: "Sales",
        type: "Income",
        description: "Earned income",
      },
    ],
  },
};
describe("local AI safety adapter (mock service, no real inference)", () => {
  it("reports zero installed models as unavailable", async () => {
    mode = "empty";
    const s = await (await fetch(origin + "/api/ai/status")).json();
    expect(s.available).toBe(false);
    expect(s.models).toEqual([]);
  });
  it("rejects renamed models with remote-host metadata", async () => {
    mode = "remote";
    const s = await (await fetch(origin + "/api/ai/status")).json();
    expect(s.available).toBe(false);
  });
  it("requires same-origin POST and rejects spoofed forwarded hosts", async () => {
    mode = "local";
    let res = await fetch(origin + "/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    expect(res.status).toBe(403);
    res = await fetch(origin + "/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example",
        "X-Forwarded-Host": "evil.example",
        "X-Forwarded-Proto": "https",
      },
      body: JSON.stringify(request),
    });
    expect(res.status).toBe(403);
  });
  it("validates local suggestions and always forces review", async () => {
    mode = "local";
    const res = await fetch(origin + "/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(request),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needsReview).toBe(true);
    expect(body.options[0].accountId).toBe("sales");
  });
});
