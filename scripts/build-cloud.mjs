import { spawnSync } from "node:child_process";
const copy = spawnSync(process.execPath, ["scripts/copy-wasm.mjs"], {stdio: "inherit", windowsHide: true});
if (copy.status !== 0) throw Error("Could not prepare the SQLite runtime");
for (const name of ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"])
  if (!process.env[name])
    throw Error(`Set ${name} before building the cloud edition`);
if (!process.env.VITE_SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_"))
  throw Error(
    "Use a public publishable key, never a service-role or secret key",
  );
const result = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", "--outDir", "dist-cloud"],
  {
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, VITE_CLOUD_MODE: "true" },
  },
);
process.exitCode = result.status ?? 1;
