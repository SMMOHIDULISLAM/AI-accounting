import express from "express";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

export function receiptImageDimensions(bytes: Buffer): {
  width: number;
  height: number;
} {
  if (
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 255) break;
      const marker = bytes[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker) && length >= 7)
        return {
          height: bytes.readUInt16BE(offset + 3),
          width: bytes.readUInt16BE(offset + 5),
        };
      offset += length;
    }
  }
  throw Error("Choose a valid PNG or JPEG image");
}
export function localOcrPath(): string | undefined {
  const candidates = process.env.TESSERACT_PATH
    ? [process.env.TESSERACT_PATH]
    : process.platform === "win32"
      ? ["C:\\Program Files\\Tesseract-OCR\\tesseract.exe"]
      : ["/usr/bin/tesseract", "/usr/local/bin/tesseract"];
  return candidates.find((path) => existsSync(path));
}
export function runLocalOcr(
  executable: string,
  bytes: Buffer,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      executable,
      ["stdin", "stdout", "--psm", "6", "-l", "eng"],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    let text = "",
      size = 0,
      settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        child.kill();
        reject(error);
      } else resolve(text.trim());
    };
    const timer = setTimeout(
      () => finish(Error("Local receipt OCR timed out")),
      20000,
    );
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      size += Buffer.byteLength(chunk, "utf8");
      if (size > 64000) finish(Error("OCR output exceeds the review limit"));
      else text += chunk;
    });
    child.stderr.on("data", () => undefined);
    child.on("error", () => finish(Error("Local OCR could not start")));
    child.on("close", (code) =>
      finish(
        code === 0 ? undefined : Error("Local OCR could not read this image"),
      ),
    );
    child.stdin.on("error", () => finish(Error("Local OCR input failed")));
    child.stdin.end(bytes);
  });
}
export function receiptRoutes(
  localMode: boolean,
  runner?: (bytes: Buffer) => Promise<string>,
  available?: boolean,
) {
  const router = express.Router();
  const executable = localOcrPath();
  const enabled = localMode && (available ?? Boolean(executable));
  router.get("/status", (_req, res) =>
    res.json({ available: enabled, language: "eng", localOnly: true }),
  );
  let active = false;
  router.post(
    "/ocr",
    express.raw({ type: ["image/png", "image/jpeg"], limit: "8mb" }),
    async (req, res) => {
      if (!localMode) {
        res
          .status(403)
          .json({ error: "Receipt OCR is available only in local mode" });
        return;
      }
      if (!enabled) {
        res
          .status(503)
          .json({
            error:
              "Install local Tesseract or configure TESSERACT_PATH, then restart",
          });
        return;
      }
      if (active) {
        res
          .status(429)
          .json({
            error: "One receipt is already being read. Try again shortly.",
          });
        return;
      }
      try {
        if (!Buffer.isBuffer(req.body))
          throw Error("Upload a PNG or JPEG image");
        const { width, height } = receiptImageDimensions(req.body);
        if (!width || !height || width * height > 20_000_000)
          throw Error("Receipt image must be at most 20 million pixels");
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
        return;
      }
      active = true;
      try {
        const text = await (
          runner || ((bytes: Buffer) => runLocalOcr(executable!, bytes))
        )(req.body);
        res.setHeader("Cache-Control", "no-store");
        res.json({ text, needsReview: true, language: "eng" });
      } catch {
        res
          .status(502)
          .json({
            error: "Local OCR failed. No accounting record was created.",
          });
      } finally {
        active = false;
      }
    },
  );
  return router;
}
