import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  readFileSync(path.join(root, "third_party/provenance.json"), "utf8"),
);
let files = 0;
for (const source of manifest.sources)
  for (const entry of source.files) {
    const full = path.resolve(root, entry.path);
    if (!full.startsWith(path.join(root, "third_party") + path.sep))
      throw Error("Invalid vendored source path");
    const digest = createHash("sha256")
      .update(readFileSync(full))
      .digest("hex");
    if (digest !== entry.sha256)
      throw Error(`Vendored source changed: ${entry.path}`);
    files++;
  }
console.log(
  JSON.stringify({
    vendoredSources: "verified",
    projects: manifest.sources.length,
    files,
  }),
);
