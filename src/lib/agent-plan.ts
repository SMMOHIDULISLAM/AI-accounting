import {
  applyOperation,
  type Operations,
  type OperationCommand,
} from "./operations";
export interface AgentPlan {
  basis: string;
  actions: {
    title: string;
    reason: string;
    command: Record<string, unknown>;
  }[];
  questions: string[];
  mode: "review-only-rules";
}
export function operationsBasis(state: Operations): string {
  return state.events.length + ":" + (state.events.at(-1)?.id || "empty");
}
/** A deterministic tool coordinator. Local generative AI is optional, never an execution authority. */
export function planOperations(
  state: Operations,
  request: string,
  date: string,
): AgentPlan {
  const plan: AgentPlan = {
    basis: operationsBasis(state),
    actions: [],
    questions: [],
    mode: "review-only-rules",
  };
  if (request.length > 4000)
    throw Error("Keep the agent request within 4,000 characters");
  const input = request.toLowerCase();
  if (/reorder|purchase|মজুত|ক্রয়|কেনা/.test(input)) {
    for (const item of state.items.filter((i) => i.kind !== "service")) {
      const onHand = state.stock
        .filter((s) => s.itemId === item.id && s.location !== "transit")
        .reduce((n, s) => n + BigInt(s.quantity), 0n);
      if (onHand >= BigInt(item.reorder)) continue;
      const last = state.purchases
        .filter((p) => p.itemId === item.id && p.status === "received")
        .at(-1);
      if (!last) {
        plan.questions.push(
          "Choose a supplier and current price for: " + item.name,
        );
        continue;
      }
      const quantity = Number(BigInt(item.reorder) - onHand);
      const total = Number(
        (BigInt(last.total) * BigInt(quantity) + BigInt(last.quantity) / 2n) /
          BigInt(last.quantity),
      );
      if (!Number.isSafeInteger(total) || total <= 0) {
        plan.questions.push("Confirm a valid purchase price for: " + item.name);
        continue;
      }
      plan.actions.push({
        title: "Draft replenishment purchase",
        reason:
          "Uses the last received order's supplier and price as a proposal only. Verify both before approval. " +
          item.name,
        command: {
          type: "purchase",
          supplierId: last.supplierId,
          itemId: item.id,
          quantity,
          total,
        },
      });
    }
  } else if (/production|manufactur|উৎপাদন/.test(input)) {
    for (const row of state.production.filter((p) => p.status === "draft")) {
      const command = {
        id: "agent-probe-" + row.id,
        date,
        type: "start-production",
        entityId: row.id,
      } as OperationCommand;
      try {
        applyOperation(state, command);
        plan.actions.push({
          title: "Review production start",
          reason:
            "Current material and capacity checks passed. Confirm the physical release before starting.",
          command: { type: "start-production", entityId: row.id },
        });
      } catch (e) {
        plan.questions.push((e as Error).message + " · " + row.id);
      }
    }
  } else if (/payroll|salary|বেতন/.test(input))
    plan.questions.push(
      "Confirm employee, period, paid days, allowances and statutory deductions in HR & payroll. The agent will not invent payroll policy.",
    );
  else if (/sale|dispatch|বিক্র|পাঠা/.test(input)) {
    for (const row of state.sales.filter(
      (p) =>
        p.status === "approved" &&
        state.items.find((i) => i.id === p.itemId)?.kind !== "service",
    ))
      plan.actions.push({
        title: "Review goods dispatch",
        reason:
          "Check the delivery instruction and physical goods before moving them into transit.",
        command: { type: "dispatch-sale", entityId: row.id },
      });
  } else
    plan.questions.push(
      "Ask for replenishment, production readiness, dispatch review or payroll guidance.",
    );
  if (!plan.actions.length && !plan.questions.length)
    plan.questions.push(
      "No matching action is currently required. Review your records before changing anything.",
    );
  return plan;
}
