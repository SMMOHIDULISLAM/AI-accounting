import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { createApi } from "../server/index";
import {
  emptyOperations,
  applyOperation,
  type OperationCommand,
} from "../src/lib/operations";
import { planOperations, operationsBasis } from "../src/lib/agent-plan";
let server: Server, origin: string;
beforeAll(async () => {
  const app = express();
  createApi(app, true);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = "http://127.0.0.1:" + (server.address() as { port: number }).port;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
const post = async (path: string, body: unknown) =>
  fetch(origin + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
describe("review agent and local polyglot boundary", () => {
  it("returns exact payroll and costing results without a native runtime", async () => {
    const payroll = await post("/api/engines/payroll", {
      salary: 3000000,
      paidDays: 29,
      scheduledDays: 30,
      allowances: 100000,
      deductions: 50000,
    });
    expect(payroll.status).toBe(200);
    expect(await payroll.json()).toMatchObject({
      gross: 3000000,
      net: 2950000,
    });
    const cost = await post("/api/engines/cost", {
      value: 10001,
      held: 3000,
      sold: 1000,
    });
    expect(cost.status).toBe(200);
    expect(await cost.json()).toMatchObject({
      cost: 3334,
      remainingValue: 6667,
      remainingQuantity: 2000,
    });
  });
  it("rejects unsafe amounts and untrusted cross-origin calls", async () => {
    expect(
      (
        await post("/api/engines/cost", {
          value: Number.MAX_SAFE_INTEGER + 1,
          held: 1,
          sold: 1,
        })
      ).status,
    ).toBe(400);
    const response = await fetch(origin + "/api/engines/payroll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://example.invalid",
      },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(403);
  });
  it("plans a purchase draft from checked history and leaves original records untouched", async () => {
    let state = emptyOperations();
    let count = 0;
    const apply = (value: Record<string, unknown>) => {
      const id = "agent-test-" + ++count;
      state = applyOperation(state, {
        ...value,
        id,
        date: "2026-11-27",
      } as OperationCommand);
      return id;
    };
    const supplier = apply({
      type: "contact",
      name: "Synthetic supplier",
      kind: "supplier",
    });
    const item = apply({
      type: "item",
      sku: "RAW",
      name: "Raw",
      kind: "raw",
      unit: "kg",
      reorder: 2000,
    });
    const purchase = apply({
      type: "purchase",
      supplierId: supplier,
      itemId: item,
      quantity: 1000,
      total: 10000,
    });
    apply({ type: "approve-purchase", entityId: purchase });
    apply({ type: "receive-purchase", entityId: purchase });
    const original = JSON.stringify(state),
      plan = planOperations(state, "মজুত ক্রয়", "2026-11-27");
    expect(plan.mode).toBe("review-only-rules");
    expect(plan.actions[0].command).toMatchObject({
      type: "purchase",
      quantity: 1000,
      total: 10000,
    });
    expect(JSON.stringify(state)).toBe(original);
    const result = await post("/api/engines/plan", {
      state,
      request: "reorder",
      date: "2026-11-27",
    });
    expect(result.status).toBe(200);
    expect((await result.json()).basis).toBe(operationsBasis(state));
  });
  it("asks for payroll facts rather than inventing statutory deductions", () => {
    const plan = planOperations(emptyOperations(), "payroll", "2026-11-27");
    expect(plan.actions).toEqual([]);
    expect(plan.questions[0]).toContain("will not invent");
  });
});
