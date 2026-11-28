import { useEffect, useRef, useState } from "react";
import { t, useLanguage, uiMoney, uiNumber } from "../lib/i18n";
import { parseMoney } from "../lib/accounting";
import {
  applyOperation,
  emptyOperations,
  validateOperations,
  quantityFromText,
  quantityText,
  capacityForDay,
  marketShareBasisPoints,
  type Operations as State,
  type OperationCommand,
} from "../lib/operations";
import {
  localOperationsStorage,
  parseOperationsBackup,
  type OperationsStorage,
} from "../lib/operations-store";
import { saveOperationalDraft } from "../lib/operations-posting";
import { today, saveFile } from "../components/utils";
import type { Ledger } from "../lib/db";
import type { Snapshot } from "../lib/types";
import AgentWorkbench from "../components/AgentWorkbench";

type Option = { value: string; label: string };
type Field = {
  key: string;
  label: string;
  options?: Option[];
  value?: string;
  type?: "date" | "month" | "text";
};
function EntryForm({
  title,
  fields,
  submit,
  busy,
}: {
  title: string;
  fields: Field[];
  submit: (data: Record<string, string>) => Promise<void>;
  busy: boolean;
}) {
  useLanguage();
  const [values, setValues] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  return (
    <form
      className="panel padded"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await submit(
            Object.fromEntries(
              fields.map((f) => [f.key, values[f.key] ?? f.value ?? ""]),
            ),
          );
          setValues({});
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <h3>{t(title)}</h3>
      <div className="form-grid">
        {fields.map((f) => (
          <label key={f.key}>
            {t(f.label)}
            {f.options ? (
              <select
                aria-label={t(f.label)}
                required
                value={values[f.key] ?? f.value ?? ""}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.value })
                }
              >
                <option value="">{t("Choose an option")}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label={t(f.label)}
                required
                type={f.type || "text"}
                value={values[f.key] ?? f.value ?? ""}
                maxLength={160}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.value })
                }
              />
            )}
          </label>
        ))}
      </div>
      {error && (
        <p className="alert error" role="alert">
          {t(error)}
        </p>
      )}
      <button disabled={busy}>
        {t(busy ? "Working…" : "Save for review")}
      </button>
    </form>
  );
}
export default function Operations({
  ledger,
  data,
  run,
  storage = localOperationsStorage,
}: {
  ledger: Ledger;
  data: Snapshot;
  run: (fn: () => Promise<unknown>, notice?: string) => Promise<boolean>;
  storage?: OperationsStorage;
}) {
  useLanguage();
  const [state, setState] = useState<State>(),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("Supply chain");
  const current = useRef<State | undefined>(undefined),
    saving = useRef(false);
  const [market, setMarket] = useState(""),
    [own, setOwn] = useState("");
  useEffect(() => {
    let active = true;
    void storage
      .load()
      .then((value) => {
        const result =
          value === undefined
            ? emptyOperations(data.settings.currency)
            : validateOperations(value);
        if (active) {
          current.current = result;
          setState(result);
        }
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [storage, data.settings.currency]);
  const execute = async (
    command: Omit<OperationCommand, "id" | "date"> | Record<string, unknown>,
    date = today(),
  ) => {
    if (saving.current) throw Error("Wait for the current save to finish");
    if (!current.current) throw Error("Operations are still loading");
    if (current.current.currency !== data.settings.currency)
      throw Error("Operations and ledger currencies must match");
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = applyOperation(current.current, {
        ...command,
        id: crypto.randomUUID(),
        date,
      } as OperationCommand);
      await storage.save(next);
      current.current = next;
      setState(next);
      setNotice(
        "Operation saved. Financial proposals still require ledger review.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const action = async (type: string, entityId: string) => {
    try {
      await execute({ type, entityId });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  async function restore(file?: File) {
    if (!file || saving.current) return;
    setError("");
    try {
      if (file.size > 1_000_000) throw Error("Operations backup exceeds 1 MB");
      const next = parseOperationsBackup(await file.text());
      if (next.currency !== data.settings.currency)
        throw Error("Operations and ledger currencies must match");
      if (
        !confirm(
          t(
            "Replace operations from this backup? Export the current operations and ledger first. The ledger is separate and will not be replaced.",
          ),
        )
      )
        return;
      saving.current = true;
      setBusy(true);
      await storage.save(next);
      current.current = next;
      setState(next);
      setNotice(
        "Operations backup restored. Reconcile its journal proposals with the separate ledger.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  if (!state)
    return (
      <section className="panel padded">
        <h2>{t("Business operations")}</h2>
        <p role="status">{t(error || "Loading…")}</p>
      </section>
    );
  const items = state.items.map((i) => ({
    value: i.id,
    label: i.sku + " · " + i.name,
  }));
  const options = (kind: "supplier" | "customer") =>
    state.contacts
      .filter((c) => c.kind === kind)
      .map((c) => ({ value: c.id, label: c.name }));
  const employees = state.employees.map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const status = (value: string) => t(value);
  const itemName = (id: string) =>
    state.items.find((i) => i.id === id)?.name || id;
  const money = (amount: number) => uiMoney(amount, state.currency);
  const button = (label: string, type: string, id: string) => (
    <button
      className="secondary"
      disabled={busy}
      onClick={() => {
        void action(type, id);
      }}
    >
      {t(label)}
    </button>
  );
  const base = { busy };
  const field = (key: string, label: string, value?: string): Field => ({
    key,
    label,
    value,
  });
  const select = (key: string, label: string, options: Option[]): Field => ({
    key,
    label,
    options,
  });
  let share = "";
  try {
    if (market && own)
      share =
        (
          marketShareBasisPoints(parseMoney(own), parseMoney(market)) / 100
        ).toFixed(2) + "%";
  } catch (e) {
    share = t((e as Error).message);
  }
  return (
    <div className="operations-workspace">
      <div className="panel padded">
        <h2>{t("Business operations")}</h2>
        <p>
          {t(
            "Purchasing, raw materials, WIP, finished goods, transit, sales and payroll in one review workflow.",
          )}
        </p>
        <p className="note">
          {t(
            "Operational stock changes do not automatically post financial journals. Export the operations JSON as well as the separate SQLite ledger backup.",
          )}
        </p>
        <button
          className="secondary"
          onClick={() =>
            saveFile(
              "operations-" + today() + ".json",
              JSON.stringify(state, null, 2),
              "application/json",
            )
          }
        >
          {t("Download operations backup")}
        </button>
        <label className="file-label">
          {t("Restore operations backup")}
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void restore(file);
            }}
          />
        </label>
      </div>
      <div className="tabs">
        {[
          "Supply chain",
          "Production",
          "Sales & delivery",
          "HR & payroll",
          "Capacity & market",
          "Agent workspace",
          "Journal proposals",
        ].map((x) => (
          <button
            key={x}
            className={tab === x ? "selected" : ""}
            onClick={() => setTab(x)}
          >
            {t(x)}
          </button>
        ))}
      </div>
      {error && (
        <p className="alert error" role="alert">
          {t(error)}
        </p>
      )}
      {notice && (
        <p className="note" role="status">
          {t(notice)}
        </p>
      )}
      {state.currency !== data.settings.currency && (
        <p className="alert error">
          {t("Operations and ledger currencies must match")}
        </p>
      )}
      {tab === "Supply chain" && (
        <>
          <div className="settings-layout">
            <EntryForm
              {...base}
              title="Add supplier or customer"
              fields={[
                field("name", "Name"),
                select("kind", "Contact type", [
                  { value: "supplier", label: t("Supplier") },
                  { value: "customer", label: t("Customer") },
                ]),
              ]}
              submit={(v) => execute({ type: "contact", ...v })}
            />
            <EntryForm
              {...base}
              title="Add item"
              fields={[
                field("sku", "SKU"),
                field("name", "Item name"),
                select(
                  "kind",
                  "Item type",
                  ["raw", "finished", "trading", "service"].map((x) => ({
                    value: x,
                    label: t(x),
                  })),
                ),
                field("unit", "Unit", "piece"),
                field("reorder", "Reorder level", "0"),
              ]}
              submit={(v) =>
                execute({
                  type: "item",
                  ...v,
                  reorder: quantityFromText(v.reorder),
                })
              }
            />
            <EntryForm
              {...base}
              title="New purchase order"
              fields={[
                select("supplierId", "Supplier", options("supplier")),
                select(
                  "itemId",
                  "Item",
                  items.filter(
                    (i) =>
                      state.items.find((s) => s.id === i.value)?.kind !==
                      "service",
                  ),
                ),
                field("quantity", "Quantity"),
                field("total", "Total amount"),
              ]}
              submit={(v) =>
                execute({
                  type: "purchase",
                  ...v,
                  quantity: quantityFromText(v.quantity),
                  total: parseMoney(v.total),
                })
              }
            />
          </div>
          <section className="panel padded">
            <h3>{t("Purchase orders")}</h3>
            {state.purchases.map((p) => (
              <div className="source-row" key={p.id}>
                <div>
                  <strong>{itemName(p.itemId)}</strong>
                  <small>
                    {quantityText(p.quantity)} · {money(p.total)} ·{" "}
                    {status(p.status)}
                  </small>
                </div>
                {p.status === "draft"
                  ? button("Approve purchase", "approve-purchase", p.id)
                  : p.status === "approved"
                    ? button("Receive full order", "receive-purchase", p.id)
                    : null}
              </div>
            ))}
            {!state.purchases.length && (
              <p>
                {t(
                  "Create an item and a supplier, then record a purchase order.",
                )}
              </p>
            )}
          </section>
        </>
      )}
      {tab === "Production" && (
        <>
          <div className="settings-layout">
            <EntryForm
              {...base}
              title="Add work centre"
              fields={[
                field("name", "Name"),
                field("minutesPerDay", "Available minutes per day", "480"),
              ]}
              submit={(v) =>
                execute({
                  type: "centre",
                  name: v.name,
                  minutesPerDay: quantityFromText(v.minutesPerDay) / 1000,
                })
              }
            />
            <BomForm
              items={state.items}
              busy={busy}
              submit={(itemId, components) =>
                execute({ type: "bom", itemId, components })
              }
            />
            <EntryForm
              {...base}
              title="New production order"
              fields={[
                select(
                  "itemId",
                  "Finished item",
                  items.filter(
                    (i) =>
                      state.items.find((s) => s.id === i.value)?.kind ===
                      "finished",
                  ),
                ),
                select(
                  "centreId",
                  "Work centre",
                  state.centres.map((c) => ({ value: c.id, label: c.name })),
                ),
                field("quantity", "Quantity"),
                field("minutes", "Required minutes"),
                {
                  key: "date",
                  label: "Production date",
                  type: "date",
                  value: today(),
                },
              ]}
              submit={(v) =>
                execute(
                  {
                    type: "production",
                    itemId: v.itemId,
                    centreId: v.centreId,
                    quantity: quantityFromText(v.quantity),
                    minutes: quantityFromText(v.minutes) / 1000,
                  },
                  v.date,
                )
              }
            />
          </div>
          <section className="panel padded">
            <h3>{t("Production orders")}</h3>
            <p>
              {t(
                "Start reserves material cost into WIP. Complete moves the same cost into finished goods. This pilot excludes conversion-cost capitalization, scrap and subcontracting.",
              )}
            </p>
            {state.production.map((p) => (
              <div className="source-row" key={p.id}>
                <div>
                  <strong>{itemName(p.itemId)}</strong>
                  <small>
                    {p.date} · {quantityText(p.quantity)} · {status(p.status)} ·{" "}
                    {money(p.cost)}
                  </small>
                </div>
                {p.status === "draft"
                  ? button("Start production", "start-production", p.id)
                  : p.status === "started"
                    ? button("Complete production", "finish-production", p.id)
                    : null}
              </div>
            ))}
          </section>
        </>
      )}
      {tab === "Sales & delivery" && (
        <>
          <EntryForm
            {...base}
            title="New sales or service order"
            fields={[
              select("customerId", "Customer", options("customer")),
              select("itemId", "Item", items),
              field("quantity", "Quantity"),
              field("total", "Total amount"),
            ]}
            submit={(v) =>
              execute({
                type: "sale",
                ...v,
                quantity: quantityFromText(v.quantity),
                total: parseMoney(v.total),
              })
            }
          />
          <section className="panel padded">
            <h3>{t("Sales & delivery")}</h3>
            {state.sales.map((p) => (
              <div className="source-row" key={p.id}>
                <div>
                  <strong>{itemName(p.itemId)}</strong>
                  <small>
                    {quantityText(p.quantity)} · {money(p.total)} ·{" "}
                    {status(p.status)}
                  </small>
                </div>
                {p.status === "draft"
                  ? button("Approve sale", "approve-sale", p.id)
                  : p.status === "approved"
                    ? state.items.find((i) => i.id === p.itemId)?.kind ===
                      "service"
                      ? button(
                          "Record service completion",
                          "deliver-sale",
                          p.id,
                        )
                      : button("Dispatch to transit", "dispatch-sale", p.id)
                    : p.status === "dispatched"
                      ? button("Confirm delivery", "deliver-sale", p.id)
                      : null}
              </div>
            ))}
          </section>
        </>
      )}
      {tab === "HR & payroll" && (
        <>
          <p className="note">
            {t(
              "Payroll uses reviewed paid days, allowances and deductions. Tax, statutory benefits, leave entitlement and legal compliance are not calculated automatically. Approval creates an accrual proposal; it does not pay employees.",
            )}
          </p>
          <div className="settings-layout">
            <EntryForm
              {...base}
              title="Add employee"
              fields={[
                field("name", "Name"),
                field("role", "Job role"),
                field("salary", "Monthly salary"),
              ]}
              submit={(v) =>
                execute({
                  type: "employee",
                  name: v.name,
                  role: v.role,
                  monthlySalary: parseMoney(v.salary),
                })
              }
            />
            <EntryForm
              {...base}
              title="Record attendance or leave"
              fields={[
                select("employeeId", "Employee", employees),
                { key: "date", label: "Date", type: "date", value: today() },
                select(
                  "status",
                  "Status",
                  ["present", "absent", "leave"].map((x) => ({
                    value: x,
                    label: t(x),
                  })),
                ),
              ]}
              submit={(v) =>
                execute(
                  {
                    type: "attendance",
                    employeeId: v.employeeId,
                    status: v.status,
                  },
                  v.date,
                )
              }
            />
            <EntryForm
              {...base}
              title="Prepare payroll"
              fields={[
                select("employeeId", "Employee", employees),
                {
                  key: "period",
                  label: "Payroll period",
                  type: "month",
                  value: today().slice(0, 7),
                },
                field("scheduledDays", "Scheduled days", "30"),
                field("paidDays", "Paid days", "30"),
                field("allowances", "Allowances", "0"),
                field("deductions", "Deductions", "0"),
              ]}
              submit={(v) =>
                execute({
                  type: "payroll",
                  ...v,
                  scheduledDays: quantityFromText(v.scheduledDays) / 1000,
                  paidDays: quantityFromText(v.paidDays) / 1000,
                  allowances: parseMoney(v.allowances),
                  deductions: parseMoney(v.deductions),
                })
              }
            />
          </div>
          <section className="panel padded">
            <h3>{t("Payroll review")}</h3>
            {state.payroll.map((p) => (
              <div className="source-row" key={p.id}>
                <div>
                  <strong>
                    {state.employees.find((e) => e.id === p.employeeId)?.name}
                  </strong>
                  <small>
                    {p.period} · {t("Gross")}: {money(p.gross)} · {t("Net")}:{" "}
                    {money(p.net)} · {status(p.status)}
                  </small>
                </div>
                {p.status === "draft" &&
                  button("Approve payroll accrual", "approve-payroll", p.id)}
              </div>
            ))}
          </section>
        </>
      )}
      {tab === "Capacity & market" && (
        <div className="settings-layout">
          <section className="panel padded">
            <h3>{t("Capacity today")}</h3>
            {capacityForDay(state, today()).map((c) => (
              <p key={c.name}>
                {c.name}: {uiNumber(c.committed)} / {uiNumber(c.available)}{" "}
                {t("minutes")}
              </p>
            ))}
            <p>
              {t(
                "Only started/completed orders reserve capacity for their planned date.",
              )}
            </p>
          </section>
          <section className="panel padded">
            <h3>{t("Market share estimate")}</h3>
            <p>
              {t(
                "Enter independently sourced market sales for the same period, currency and market definition. This calculator does not fetch or verify market data.",
              )}
            </p>
            <label>
              {t("Your sales")}
              <input value={own} onChange={(e) => setOwn(e.target.value)} />
            </label>
            <label>
              {t("Total market sales")}
              <input
                value={market}
                onChange={(e) => setMarket(e.target.value)}
              />
            </label>
            <strong>{share}</strong>
          </section>
        </div>
      )}
      {tab === "Agent workspace" && (
        <AgentWorkbench
          state={state}
          busy={busy}
          execute={(command) => execute(command)}
        />
      )}
      {tab === "Agent workspace" && (
        <section className="panel padded">
          <h3>{t("Agent workspace")}</h3>
          <p>
            {t(
              "This rules-based coordinator reads operations and highlights the next review steps. The separate local AI assistant can explain decisions when Ollama is installed. No agent autonomously posts journals, pays, sends emails or messages, or files taxes.",
            )}
          </p>
          <ul>
            {state.items
              .filter((i) => i.kind !== "service")
              .filter(
                (i) =>
                  state.stock
                    .filter(
                      (s) => s.itemId === i.id && s.location !== "transit",
                    )
                    .reduce((n, s) => n + s.quantity, 0) < i.reorder,
              )
              .map((i) => (
                <li key={i.id}>
                  {t("Reorder review")}: {i.name}
                </li>
              ))}
          </ul>
          <p>
            {t("Purchase approvals")}:{" "}
            {uiNumber(
              state.purchases.filter((p) => p.status === "draft").length,
            )}
          </p>
          <p>
            {t("Production to finish")}:{" "}
            {uiNumber(
              state.production.filter((p) => p.status === "started").length,
            )}
          </p>
          <p>
            {t("Deliveries in transit")}:{" "}
            {uiNumber(
              state.sales.filter((p) => p.status === "dispatched").length,
            )}
          </p>
          <p>
            {t("Journal proposals")}: {uiNumber(state.proposals.length)}
          </p>
        </section>
      )}
      {tab === "Journal proposals" && (
        <section className="panel padded">
          <h3>{t("Journal proposals")}</h3>
          <p>
            {t(
              "Review the event, currency, tax and accounts. Creating a proposal draft may add COGS/payroll heads when absent. Conflicting account types are blocked. Review and post separately in Transactions.",
            )}
          </p>
          {state.proposals.map((p) => (
            <article className="note" key={p.id}>
              <strong>
                {p.date} · {p.description}
              </strong>
              {p.lines.map((l, i) => (
                <div className="statement-row" key={i}>
                  <span>{t(l.head)}</span>
                  <span>
                    {t("Debit")}: {money(l.debit)} · {t("Credit")}:{" "}
                    {money(l.credit)}
                  </span>
                </div>
              ))}
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await run(
                      () => saveOperationalDraft(ledger, p, state.currency),
                      "Operational draft saved for review",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("Create ledger draft")}
              </button>
            </article>
          ))}
        </section>
      )}
      <section className="panel padded">
        <h3>{t("Stock by location")}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {["Item", "Location", "Quantity", "Value"].map((x) => (
                  <th key={x}>{t(x)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.stock.map((s) => (
                <tr key={s.itemId + ":" + s.location}>
                  <td>{itemName(s.itemId)}</td>
                  <td>{t(s.location)}</td>
                  <td>{quantityText(s.quantity)}</td>
                  <td>{money(s.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          {t(
            "Physical quantities and financial journal posting are separate controls. Reconcile inventory value with the financial ledger after reviewing all proposals.",
          )}
        </p>
      </section>
    </div>
  );
}
function BomForm({
  items,
  busy,
  submit,
}: {
  items: State["items"];
  busy: boolean;
  submit: (
    itemId: string,
    components: { itemId: string; quantity: number }[],
  ) => Promise<void>;
}) {
  useLanguage();
  const [itemId, setItemId] = useState(""),
    [components, setComponents] = useState([{ itemId: "", quantity: "1" }]),
    [error, setError] = useState("");
  return (
    <form
      className="panel padded"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await submit(
            itemId,
            components.map((c) => ({
              itemId: c.itemId,
              quantity: quantityFromText(c.quantity),
            })),
          );
          setItemId("");
          setComponents([{ itemId: "", quantity: "1" }]);
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <h3>{t("Bill of materials")}</h3>
      <label>
        {t("Finished item")}
        <select
          aria-label={t("Finished item")}
          value={itemId}
          required
          onChange={(e) => setItemId(e.target.value)}
        >
          <option value="">{t("Choose an option")}</option>
          {items
            .filter((i) => i.kind === "finished")
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
        </select>
      </label>
      {components.map((c, index) => (
        <div className="form-grid" key={index}>
          <label>
            {t("Component")}
            <select
              aria-label={t("Component")}
              required
              value={c.itemId}
              onChange={(e) =>
                setComponents(
                  components.map((x, n) =>
                    n === index ? { ...x, itemId: e.target.value } : x,
                  ),
                )
              }
            >
              <option value="">{t("Choose an option")}</option>
              {items
                .filter((i) => i.id !== itemId && i.kind !== "service")
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {t("Quantity per finished unit")}
            <input
              aria-label={t("Quantity per finished unit")}
              value={c.quantity}
              required
              onChange={(e) =>
                setComponents(
                  components.map((x, n) =>
                    n === index ? { ...x, quantity: e.target.value } : x,
                  ),
                )
              }
            />
          </label>
        </div>
      ))}
      <button
        type="button"
        className="text-btn"
        onClick={() =>
          setComponents([...components, { itemId: "", quantity: "1" }])
        }
      >
        {t("Add component")}
      </button>
      {error && <p className="alert error">{t(error)}</p>}
      <button disabled={busy}>{t("Save for review")}</button>
    </form>
  );
}
