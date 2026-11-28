import { useState } from "react";
import { t, useLanguage, uiMoney } from "../lib/i18n";
import {
  planOperations,
  operationsBasis,
  type AgentPlan,
} from "../lib/agent-plan";
import { quantityText, type Operations } from "../lib/operations";
import { today } from "./utils";

export default function AgentWorkbench({
  state,
  busy,
  execute,
}: {
  state: Operations;
  busy: boolean;
  execute: (command: Record<string, unknown>) => Promise<void>;
}) {
  useLanguage();
  const [request, setRequest] = useState("");
  const [plan, setPlan] = useState<AgentPlan>();
  const [error, setError] = useState("");
  const [planning, setPlanning] = useState(false);
  async function prepare() {
    setError("");
    setPlanning(true);
    try {
      const expected = planOperations(state, request, today());
      const payload = JSON.stringify({ state, request, date: today() });
      if (
        import.meta.env.VITE_CLOUD_MODE !== "true" &&
        new TextEncoder().encode(payload).length < 60_000
      ) {
        const response = await fetch("/api/engines/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });
        if (response.ok) {
          const actual = await response.json();
          if (
            actual.basis !== expected.basis ||
            JSON.stringify(actual.actions) !== JSON.stringify(expected.actions)
          )
            throw Error(
              "Agent plan differs from the checked application policy",
            );
        } else if (response.status !== 404 && response.status !== 403)
          throw Error((await response.json()).error || "Agent planning failed");
      }
      setPlan(expected);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPlanning(false);
    }
  }
  async function apply(command: Record<string, unknown>) {
    setError("");
    try {
      if (plan?.basis !== operationsBasis(state))
        throw Error("The plan is stale. Generate a new plan.");
      await execute(command);
      setPlan(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function target(command: Record<string, unknown>) {
    const order =
      state.production.find((p) => p.id === command.entityId) ||
      state.sales.find((s) => s.id === command.entityId);
    const itemId = command.itemId || order?.itemId;
    return state.items.find((i) => i.id === itemId)?.name || "";
  }
  return (
    <section className="panel padded">
      <h3>{t("Agent workspace")}</h3>
      <p>
        {t(
          "Prepare operational drafts from current records. Every proposed action requires your review. Local Ollama is optional; this coordinator works without a paid AI API.",
        )}
      </p>
      <label>
        {t("Your instruction")}
        <textarea
          value={request}
          maxLength={4000}
          aria-label={t("Your instruction")}
          onChange={(e) => setRequest(e.target.value)}
        />
      </label>
      <div className="heading-buttons">
        {[
          "Review replenishment",
          "Review production",
          "Review dispatch",
          "Review payroll",
        ].map((label, index) => (
          <button
            className="secondary"
            key={label}
            onClick={() =>
              setRequest(
                ["reorder", "production", "dispatch", "payroll"][index],
              )
            }
          >
            {t(label)}
          </button>
        ))}
      </div>
      <button
        disabled={busy || planning || !request.trim()}
        onClick={() => void prepare()}
      >
        {t(planning ? "Working…" : "Prepare review plan")}
      </button>
      {error && (
        <p role="alert" className="alert error">
          {t(error)}
        </p>
      )}
      {plan && (
        <>
          <p className="note">
            {t(
              "Rules-based plan. No autonomous ledger posting, payroll payment, messaging or tax filing.",
            )}
          </p>
          {plan.questions.map((q, i) => (
            <p key={i}>{t(q)}</p>
          ))}
          {plan.actions.map((a, i) => (
            <article className="note" key={i}>
              <h4>
                {t(a.title)} · {target(a.command)}
              </h4>
              <p>{t(a.reason)}</p>
              {typeof a.command.quantity === "number" && (
                <p>
                  {t("Quantity")}: {quantityText(a.command.quantity)}
                </p>
              )}
              {typeof a.command.total === "number" && (
                <p>
                  {t("Total amount")}:{" "}
                  {uiMoney(a.command.total, state.currency)}
                </p>
              )}
              {typeof a.command.supplierId === "string" && (
                <p>
                  {t("Supplier")}:{" "}
                  {
                    state.contacts.find((c) => c.id === a.command.supplierId)
                      ?.name
                  }
                </p>
              )}
              <button
                disabled={busy || plan.basis !== operationsBasis(state)}
                onClick={() => void apply(a.command)}
              >
                {t("Confirm reviewed action")}
              </button>
            </article>
          ))}
          {plan.basis !== operationsBasis(state) && (
            <p>{t("The plan is stale. Generate a new plan.")}</p>
          )}
        </>
      )}
    </section>
  );
}
