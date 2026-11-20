import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createServer, type Server } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";

let app: ChildProcess;
let mock: Server;
let mode = "empty";
const origin = "http://127.0.0.1:3109";
beforeAll(async () => {
  mock = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/tags")
      res.end(
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
    else
      res.end(
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
  });
  await new Promise<void>((resolve, reject) => {
    mock.once("error", reject);
    mock.listen(11434, "127.0.0.1", resolve);
  });
  app = spawn(
    process.execPath,
    ["--import", "tsx", "server/index.ts", "--production", "--local"],
    {
      cwd: process.cwd(),
      env: { ...process.env, PORT: "3109" },
      stdio: "ignore",
    },
  );
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + "/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error("Local test server did not start");
}, 10000);
afterAll(async () => {
  app?.kill("SIGTERM");
  if (mock) await new Promise<void>((r) => mock.close(() => r()));
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
