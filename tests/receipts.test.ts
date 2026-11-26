import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { receiptRoutes, receiptImageDimensions } from "../server/receipts";
import { receiptCandidates } from "../src/lib/receipt-text";
const png = Buffer.alloc(24);
Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
png.writeUInt32BE(100, 16);
png.writeUInt32BE(100, 20);
describe("local receipt review", () => {
  it("keeps multiple totals ambiguous and validates explicit ISO dates", () => {
    const result = receiptCandidates(
      "Subtotal BDT 100\nTOTAL BDT 110.25\nGRAND TOTAL BDT 111.25\n2026-02-30 2026-11-27",
    );
    expect(result.totals).toEqual([
      { amount: 11025, currency: "BDT" },
      { amount: 11125, currency: "BDT" },
    ]);
    expect(result.dates).toEqual(["2026-11-27"]);
    expect(result.needsReview).toBe(true);
    expect(
      receiptCandidates("Total unreadable\nDate 27/11/2026").totals,
    ).toEqual([]);
  });
  it("checks image dimensions before invoking the OCR engine", () => {
    expect(receiptImageDimensions(png)).toEqual({ width: 100, height: 100 });
    expect(() => receiptImageDimensions(Buffer.from("not an image"))).toThrow();
  });
});
describe("OCR HTTP boundary with an injected local runner", () => {
  let server: Server,
    origin: string,
    calls = 0;
  beforeAll(async () => {
    const app = express();
    app.use(
      "/local",
      receiptRoutes(
        true,
        async () => {
          calls++;
          return "SYNTHETIC RECEIPT\nTOTAL BDT 150.00";
        },
        true,
      ),
    );
    app.use(
      "/public",
      receiptRoutes(
        false,
        async () => {
          throw Error("Must never run");
        },
        true,
      ),
    );
    server = createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string") throw Error("No test server");
    origin = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  it("returns review-only text for a valid local image", async () => {
    const response = await fetch(origin + "/local/ocr", {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: png,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      text: "SYNTHETIC RECEIPT\nTOTAL BDT 150.00",
      needsReview: true,
    });
    expect(calls).toBe(1);
  });
  it("blocks public serving, invalid files and decompression-sized images", async () => {
    expect(
      (
        await fetch(origin + "/public/ocr", {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: png,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(origin + "/local/ocr", {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: "wrong",
        })
      ).status,
    ).toBe(400);
    const huge = Buffer.from(png);
    huge.writeUInt32BE(100000, 16);
    huge.writeUInt32BE(100000, 20);
    expect(
      (
        await fetch(origin + "/local/ocr", {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: huge,
        })
      ).status,
    ).toBe(400);
    expect(calls).toBe(1);
  });
});
