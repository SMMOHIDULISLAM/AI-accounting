import { Router, json } from "express";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planOperations } from "../src/lib/agent-plan";
import { validateOperations } from "../src/lib/operations";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function integer(value: unknown, positive = false): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < (positive ? 1 : 0)
  )
    throw Error("Safe nonnegative integer required");
  return value;
}
async function runFile(
  executable: string,
  args: string[],
  input = "",
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: root,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    let output = "",
      error = "",
      length = 0,
      settled = false;
    const finish = (failure?: Error, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      failure ? reject(failure) : resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(Error("Native engine timed out"));
    }, 10000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      length += Buffer.byteLength(chunk);
      if (length > 128000) {
        child.kill();
        finish(Error("Native engine output exceeded its limit"));
      } else output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      if (error.length < 1000) error += chunk;
    });
    child.on("error", (e) => finish(e));
    child.on("close", (code) => {
      if (code !== 0) finish(Error(error || "Native engine failed"));
      else
        try {
          finish(undefined, JSON.parse(output));
        } catch {
          finish(Error("Native engine returned invalid JSON"));
        }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}
export function engineRoutes(localMode: boolean) {
  const router = Router();
  router.use((_req, res, next) =>
    localMode
      ? next()
      : void res
          .status(403)
          .json({ error: "Native engines are available only in local mode" }),
  );
  router.use(json({ limit: 64 * 1024 }));
  router.post("/plan", (req, res) => {
    void (async () => {
      const state = validateOperations(req.body?.state),
        request = req.body?.request,
        date = req.body?.date;
      if (typeof request !== "string" || typeof date !== "string")
        throw Error("Invalid planning request");
      // Node retains the authoritative tool policy; Python cannot add executable commands.
      const expected = planOperations(state, request, date);
      if (
        process.env.PYTHON_EXECUTABLE &&
        !/production|manufactur|উৎপাদন/i.test(request)
      ) {
        const result = await runFile(
          process.env.PYTHON_EXECUTABLE,
          [path.join(root, "engines/python/planner.py")],
          JSON.stringify({ state, request, date }),
        );
        if (JSON.stringify(result) !== JSON.stringify(expected))
          throw Error(
            "Python plan differs from the checked application policy",
          );
        res.json({ ...expected, engine: "python" });
      } else res.json({ ...expected, engine: "typescript" });
    })().catch((e) => res.status(400).json({ error: (e as Error).message }));
  });
  router.post("/payroll", (req, res) => {
    void (async () => {
      const { salary, paidDays, scheduledDays, allowances, deductions } =
        req.body || {};
      [salary, paidDays, allowances, deductions].forEach((x) => integer(x));
      integer(scheduledDays, true);
      if (paidDays > scheduledDays) throw Error("Invalid paid days");
      const gross = Number(
        (BigInt(salary) * BigInt(paidDays) + BigInt(scheduledDays) / 2n) /
          BigInt(scheduledDays) +
          BigInt(allowances),
      );
      integer(gross, true);
      if (deductions > gross) throw Error("Invalid deductions");
      const expected = { gross, deductions, net: gross - deductions };
      if (process.env.JAVA_EXECUTABLE) {
        const actual = await runFile(process.env.JAVA_EXECUTABLE, [
          path.join(root, "engines/java/PayrollEngine.java"),
          ...[salary, paidDays, scheduledDays, allowances, deductions].map(
            String,
          ),
        ]);
        if (JSON.stringify(actual) !== JSON.stringify(expected))
          throw Error("Java payroll parity check failed");
        res.json({ ...expected, engine: "java" });
      } else res.json({ ...expected, engine: "typescript" });
    })().catch((e) => res.status(400).json({ error: (e as Error).message }));
  });
  router.post("/cost", (req, res) => {
    void (async () => {
      const { value, held, sold } = req.body || {};
      integer(value);
      integer(held, true);
      integer(sold, true);
      if (sold > held) throw Error("Insufficient stock");
      const cost = Number(
          (BigInt(value) * BigInt(sold) + BigInt(held) / 2n) / BigInt(held),
        ),
        expected = {
          cost,
          remainingValue: value - cost,
          remainingQuantity: held - sold,
        };
      if (process.env.CPP_COST_ENGINE) {
        const actual = await runFile(
          process.env.CPP_COST_ENGINE,
          [value, held, sold].map(String),
        );
        if (JSON.stringify(actual) !== JSON.stringify(expected))
          throw Error("C++ costing parity check failed");
        res.json({ ...expected, engine: "cpp" });
      } else res.json({ ...expected, engine: "typescript" });
    })().catch((e) => res.status(400).json({ error: (e as Error).message }));
  });
  return router;
}
