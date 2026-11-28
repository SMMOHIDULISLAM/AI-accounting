import { latinDigits } from "./digits";
import { assertDate } from "./accounting";

export type Location = "warehouse" | "wip" | "finished" | "transit";
export type ItemKind = "raw" | "finished" | "trading" | "service";
export type PostingHead =
  | "inventory"
  | "ap"
  | "ar"
  | "sales"
  | "cogs"
  | "wages"
  | "payroll-payable"
  | "deductions";
export interface Proposal {
  id: string;
  date: string;
  description: string;
  lines: { head: PostingHead; debit: number; credit: number }[];
}
export interface Operations {
  version: 1;
  currency: string;
  contacts: { id: string; name: string; kind: "supplier" | "customer" }[];
  items: {
    id: string;
    sku: string;
    name: string;
    kind: ItemKind;
    unit: string;
    reorder: number;
  }[];
  stock: {
    itemId: string;
    location: Location;
    quantity: number;
    value: number;
  }[];
  purchases: {
    id: string;
    supplierId: string;
    itemId: string;
    quantity: number;
    total: number;
    status: "draft" | "approved" | "received";
  }[];
  boms: {
    id: string;
    itemId: string;
    components: { itemId: string; quantity: number }[];
  }[];
  centres: { id: string; name: string; minutesPerDay: number }[];
  production: {
    id: string;
    itemId: string;
    quantity: number;
    centreId: string;
    minutes: number;
    date: string;
    status: "draft" | "started" | "complete";
    cost: number;
  }[];
  sales: {
    id: string;
    customerId: string;
    itemId: string;
    quantity: number;
    total: number;
    date: string;
    status: "draft" | "approved" | "dispatched" | "delivered";
    cost: number;
  }[];
  employees: {
    id: string;
    name: string;
    role: string;
    monthlySalary: number;
    active: boolean;
  }[];
  attendance: {
    employeeId: string;
    date: string;
    status: "present" | "absent" | "leave";
  }[];
  payroll: {
    id: string;
    employeeId: string;
    period: string;
    gross: number;
    deductions: number;
    net: number;
    status: "draft" | "approved";
  }[];
  proposals: Proposal[];
  events: {
    id: string;
    date: string;
    action: string;
    entityId: string;
    fingerprint: string;
  }[];
}
export type OperationCommand =
  | {
      id: string;
      date: string;
      type: "contact";
      name: string;
      kind: "supplier" | "customer";
    }
  | {
      id: string;
      date: string;
      type: "item";
      sku: string;
      name: string;
      kind: ItemKind;
      unit: string;
      reorder: number;
    }
  | {
      id: string;
      date: string;
      type: "purchase";
      supplierId: string;
      itemId: string;
      quantity: number;
      total: number;
    }
  | {
      id: string;
      date: string;
      type:
        | "approve-purchase"
        | "receive-purchase"
        | "start-production"
        | "finish-production"
        | "approve-sale"
        | "dispatch-sale"
        | "deliver-sale"
        | "approve-payroll";
      entityId: string;
    }
  | {
      id: string;
      date: string;
      type: "bom";
      itemId: string;
      components: { itemId: string; quantity: number }[];
    }
  | {
      id: string;
      date: string;
      type: "centre";
      name: string;
      minutesPerDay: number;
    }
  | {
      id: string;
      date: string;
      type: "production";
      itemId: string;
      quantity: number;
      centreId: string;
      minutes: number;
    }
  | {
      id: string;
      date: string;
      type: "sale";
      customerId: string;
      itemId: string;
      quantity: number;
      total: number;
    }
  | {
      id: string;
      date: string;
      type: "employee";
      name: string;
      role: string;
      monthlySalary: number;
    }
  | {
      id: string;
      date: string;
      type: "attendance";
      employeeId: string;
      status: "present" | "absent" | "leave";
    }
  | {
      id: string;
      date: string;
      type: "payroll";
      employeeId: string;
      period: string;
      paidDays: number;
      scheduledDays: number;
      allowances: number;
      deductions: number;
    };

export function emptyOperations(currency = "BDT"): Operations {
  return {
    version: 1,
    currency,
    contacts: [],
    items: [],
    stock: [],
    purchases: [],
    boms: [],
    centres: [],
    production: [],
    sales: [],
    employees: [],
    attendance: [],
    payroll: [],
    proposals: [],
    events: [],
  };
}
const safe = (value: number, positive = false) => {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0))
    throw Error("Enter a valid nonnegative amount or quantity");
  return value;
};
const exact = (value: bigint) => {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw Error("Operational total exceeds the exact supported range");
  return Number(value);
};
const named = (value: string, max = 160) => {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw Error("A bounded name or reference is required");
  return value.trim();
};
const find = <T extends { id: string }>(rows: T[], id: string): T => {
  const value = rows.find((x) => x.id === id);
  if (!value) throw Error("Operational record not found");
  return value;
};
export function quantityFromText(value: string): number {
  const input = latinDigits(value).trim();
  if (!/^\d+(?:\.\d{1,3})?$/.test(input))
    throw Error("Use quantities with at most three decimal places");
  const [whole, fraction = ""] = input.split(".");
  return exact(BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0")));
}
export function quantityText(value: number): string {
  safe(value);
  return `${Math.floor(value / 1000)}.${String(value % 1000).padStart(3, "0")}`;
}
export function validateOperations(value: unknown): Operations {
  if (
    !value ||
    typeof value !== "object" ||
    (value as Operations).version !== 1
  )
    throw Error("Invalid operations backup");
  const state = value as Operations;
  if (
    !["BDT", "USD", "GBP", "EUR", "CAD", "INR", "AUD"].includes(state.currency)
  )
    throw Error("Invalid operations currency");
  const keys = Object.keys(emptyOperations()).filter(
    (x) => x !== "version" && x !== "currency",
  ) as (keyof Operations)[];
  for (const key of keys)
    if (!Array.isArray(state[key]) || (state[key] as unknown[]).length > 5000)
      throw Error("Invalid or oversized operations data");
  for (const row of state.stock) {
    safe(row.quantity);
    safe(row.value);
    if (
      !state.items.some((x) => x.id === row.itemId) ||
      !["warehouse", "wip", "finished", "transit"].includes(row.location)
    )
      throw Error("Invalid stock identity");
  }
  for (const row of state.events)
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(row.id))
      throw Error("Invalid operational event ID");
  validateDetails(state);
  return state;
}
function validateDetails(state: Operations): void {
  for (const key of [
    "contacts",
    "items",
    "purchases",
    "boms",
    "centres",
    "production",
    "sales",
    "employees",
    "payroll",
    "proposals",
    "events",
  ] as const) {
    const ids = new Set<string>();
    for (const row of state[key]) {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(row.id) || ids.has(row.id))
        throw Error("Invalid or duplicate operational identity");
      ids.add(row.id);
    }
  }
  for (const row of state.contacts) {
    named(row.name);
    if (!["supplier", "customer"].includes(row.kind))
      throw Error("Invalid contact type");
  }
  for (const row of state.items) {
    named(row.name);
    named(row.sku, 60);
    named(row.unit, 30);
    safe(row.reorder);
    if (!["raw", "finished", "trading", "service"].includes(row.kind))
      throw Error("Invalid item type");
  }
  if (new Set(state.items.map((x) => x.sku)).size !== state.items.length)
    throw Error("Item SKU already exists");
  if (
    new Set(state.stock.map((x) => x.itemId + ":" + x.location)).size !==
    state.stock.length
  )
    throw Error("Duplicate stock position");
  for (const row of state.purchases) {
    find(state.contacts, row.supplierId);
    find(state.items, row.itemId);
    safe(row.quantity, true);
    safe(row.total, true);
    if (!["draft", "approved", "received"].includes(row.status))
      throw Error("Invalid purchase status");
  }
  for (const row of state.centres) {
    named(row.name);
    safe(row.minutesPerDay, true);
  }
  for (const row of state.boms) {
    find(state.items, row.itemId);
    if (
      !Array.isArray(row.components) ||
      !row.components.length ||
      row.components.length > 100
    )
      throw Error("Invalid bill of materials");
    const ids = new Set<string>();
    for (const c of row.components) {
      find(state.items, c.itemId);
      safe(c.quantity, true);
      if (c.itemId === row.itemId || ids.has(c.itemId))
        throw Error("Invalid or repeated bill-of-materials component");
      ids.add(c.itemId);
    }
  }
  for (const row of state.production) {
    find(state.items, row.itemId);
    find(state.centres, row.centreId);
    safe(row.quantity, true);
    safe(row.cost);
    safe(row.minutes, true);
    assertDate(row.date);
    if (!["draft", "started", "complete"].includes(row.status))
      throw Error("Invalid production status");
  }
  for (const row of state.sales) {
    find(state.contacts, row.customerId);
    find(state.items, row.itemId);
    safe(row.quantity, true);
    safe(row.total, true);
    safe(row.cost);
    assertDate(row.date);
    if (!["draft", "approved", "dispatched", "delivered"].includes(row.status))
      throw Error("Invalid sales status");
  }
  for (const row of state.employees) {
    named(row.name);
    named(row.role);
    safe(row.monthlySalary);
    if (typeof row.active !== "boolean") throw Error("Invalid employee status");
  }
  for (const row of state.attendance) {
    find(state.employees, row.employeeId);
    assertDate(row.date);
    if (!["present", "absent", "leave"].includes(row.status))
      throw Error("Invalid attendance status");
  }
  if (
    new Set(state.attendance.map((x) => x.employeeId + ":" + x.date)).size !==
    state.attendance.length
  )
    throw Error("Duplicate attendance record");
  for (const row of state.payroll) {
    find(state.employees, row.employeeId);
    safe(row.gross, true);
    safe(row.deductions);
    safe(row.net);
    if (
      row.net !== row.gross - row.deductions ||
      !["draft", "approved"].includes(row.status) ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period)
    )
      throw Error("Invalid payroll record");
  }
  if (
    new Set(state.payroll.map((x) => x.employeeId + ":" + x.period)).size !==
    state.payroll.length
  )
    throw Error("Duplicate payroll period");
  for (const row of state.proposals) {
    assertDate(row.date);
    named(row.description, 400);
    if (!Array.isArray(row.lines) || !row.lines.length || row.lines.length > 10)
      throw Error("Invalid operational journal proposal");
    let debit = 0n,
      credit = 0n;
    for (const line of row.lines) {
      if (
        ![
          "inventory",
          "ap",
          "ar",
          "sales",
          "cogs",
          "wages",
          "payroll-payable",
          "deductions",
        ].includes(line.head) ||
        (line.debit > 0 && line.credit > 0)
      )
        throw Error("Invalid operational journal proposal");
      debit += BigInt(safe(line.debit));
      credit += BigInt(safe(line.credit));
    }
    if (!debit || debit !== credit)
      throw Error("Operational journal proposal must balance");
    exact(debit);
  }
  for (const row of state.events) {
    assertDate(row.date);
    named(row.action, 60);
    named(row.entityId, 100);
    if (typeof row.fingerprint !== "string")
      throw Error("Invalid operational event ID");
  }
}
function position(state: Operations, itemId: string, location: Location) {
  let row = state.stock.find(
    (x) => x.itemId === itemId && x.location === location,
  );
  if (!row) {
    row = { itemId, location, quantity: 0, value: 0 };
    state.stock.push(row);
  }
  return row;
}
function addStock(
  state: Operations,
  itemId: string,
  location: Location,
  quantity: number,
  value: number,
) {
  const row = position(state, itemId, location);
  row.quantity = exact(BigInt(row.quantity) + BigInt(safe(quantity, true)));
  row.value = exact(BigInt(row.value) + BigInt(safe(value)));
}
function takeStock(
  state: Operations,
  itemId: string,
  location: Location,
  quantity: number,
): number {
  const row = position(state, itemId, location);
  safe(quantity, true);
  if (quantity > row.quantity)
    throw Error("Insufficient stock at the selected location");
  const cost =
    quantity === row.quantity
      ? row.value
      : exact(
          (BigInt(row.value) * BigInt(quantity) + BigInt(row.quantity) / 2n) /
            BigInt(row.quantity),
        );
  row.quantity -= quantity;
  row.value -= cost;
  return cost;
}
function proposal(
  state: Operations,
  command: OperationCommand,
  description: string,
  lines: Proposal["lines"],
) {
  const debit = lines.reduce((n, l) => n + BigInt(safe(l.debit)), 0n),
    credit = lines.reduce((n, l) => n + BigInt(safe(l.credit)), 0n);
  if (debit !== credit || !debit)
    throw Error("Operational journal proposal must balance");
  exact(debit);
  state.proposals.push({
    id: command.id,
    date: command.date,
    description,
    lines,
  });
}
/** Pure, replay-safe operational transitions. Posting proposals never posts the financial ledger. */
export function applyOperation(
  original: Operations,
  command: OperationCommand,
): Operations {
  validateOperations(original);
  assertDate(command.date);
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(command.id))
    throw Error("Invalid operational event ID");
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => [key, canonical(value)]),
          )
        : value;
  const fingerprint = JSON.stringify(canonical(command));
  const previous = original.events.find((e) => e.id === command.id);
  if (previous) {
    if (previous.fingerprint !== fingerprint)
      throw Error("Operational event ID was reused with different content");
    return original;
  }
  const s = structuredClone(original);
  let entityId = command.id;
  switch (command.type) {
    case "contact":
      s.contacts.push({
        id: command.id,
        name: named(command.name),
        kind: command.kind,
      });
      break;
    case "item":
      if (s.items.some((x) => x.sku === command.sku.trim()))
        throw Error("Item SKU already exists");
      s.items.push({
        id: command.id,
        sku: named(command.sku, 60),
        name: named(command.name),
        kind: command.kind,
        unit: named(command.unit, 30),
        reorder: safe(command.reorder),
      });
      break;
    case "purchase":
      if (
        find(s.contacts, command.supplierId).kind !== "supplier" ||
        find(s.items, command.itemId).kind === "service"
      )
        throw Error("Choose a supplier and a stock item");
      s.purchases.push({
        id: command.id,
        supplierId: command.supplierId,
        itemId: command.itemId,
        quantity: safe(command.quantity, true),
        total: safe(command.total, true),
        status: "draft",
      });
      break;
    case "approve-purchase": {
      const row = find(s.purchases, command.entityId);
      if (row.status !== "draft")
        throw Error("This action is not valid for the current status");
      row.status = "approved";
      entityId = row.id;
      break;
    }
    case "receive-purchase": {
      const row = find(s.purchases, command.entityId);
      if (row.status !== "approved")
        throw Error("Approve the purchase order before receiving stock");
      const item = find(s.items, row.itemId);
      addStock(
        s,
        row.itemId,
        item.kind === "finished" ? "finished" : "warehouse",
        row.quantity,
        row.total,
      );
      row.status = "received";
      entityId = row.id;
      proposal(s, command, "Goods received: " + item.name, [
        { head: "inventory", debit: row.total, credit: 0 },
        { head: "ap", debit: 0, credit: row.total },
      ]);
      break;
    }
    case "bom": {
      if (
        find(s.items, command.itemId).kind !== "finished" ||
        !command.components.length
      )
        throw Error("A bill of materials needs a finished item and components");
      const ids = new Set<string>();
      for (const c of command.components) {
        const item = find(s.items, c.itemId);
        safe(c.quantity, true);
        if (
          c.itemId === command.itemId ||
          ids.has(c.itemId) ||
          item.kind === "service"
        )
          throw Error("Invalid or repeated bill-of-materials component");
        ids.add(c.itemId);
      }
      if (s.boms.some((x) => x.itemId === command.itemId))
        throw Error("A bill of materials already exists for this item");
      s.boms.push({
        id: command.id,
        itemId: command.itemId,
        components: command.components,
      });
      break;
    }
    case "centre":
      s.centres.push({
        id: command.id,
        name: named(command.name),
        minutesPerDay: safe(command.minutesPerDay, true),
      });
      break;
    case "production":
      find(s.items, command.itemId);
      find(s.centres, command.centreId);
      if (!s.boms.some((x) => x.itemId === command.itemId))
        throw Error("Create a bill of materials first");
      s.production.push({
        id: command.id,
        itemId: command.itemId,
        quantity: safe(command.quantity, true),
        centreId: command.centreId,
        minutes: safe(command.minutes, true),
        date: command.date,
        status: "draft",
        cost: 0,
      });
      break;
    case "start-production": {
      const row = find(s.production, command.entityId);
      if (row.status !== "draft")
        throw Error("This action is not valid for the current status");
      const centre = find(s.centres, row.centreId);
      const committed = s.production
        .filter(
          (x) =>
            x.centreId === row.centreId &&
            x.date === row.date &&
            x.status !== "draft",
        )
        .reduce((n, x) => n + BigInt(x.minutes), 0n);
      if (committed + BigInt(row.minutes) > BigInt(centre.minutesPerDay))
        throw Error("Work-centre capacity is exceeded for this date");
      const bom = s.boms.find((x) => x.itemId === row.itemId)!;
      let cost = 0n;
      for (const c of bom.components) {
        const product = BigInt(c.quantity) * BigInt(row.quantity);
        if (product % 1000n)
          throw Error("Material precision exceeds three decimal places");
        cost += BigInt(
          takeStock(
            s,
            c.itemId,
            find(s.items, c.itemId).kind === "finished"
              ? "finished"
              : "warehouse",
            exact(product / 1000n),
          ),
        );
      }
      row.cost = exact(cost);
      addStock(s, row.itemId, "wip", row.quantity, row.cost);
      row.status = "started";
      entityId = row.id;
      break;
    }
    case "finish-production": {
      const row = find(s.production, command.entityId);
      if (row.status !== "started")
        throw Error("Start production before completing it");
      // Preserve this order's tracked material cost rather than re-average another order's WIP.
      const wip = position(s, row.itemId, "wip");
      if (wip.quantity < row.quantity || wip.value < row.cost)
        throw Error("Inconsistent work-in-progress balance");
      wip.quantity -= row.quantity;
      wip.value -= row.cost;
      addStock(s, row.itemId, "finished", row.quantity, row.cost);
      row.status = "complete";
      entityId = row.id;
      break;
    }
    case "sale":
      if (find(s.contacts, command.customerId).kind !== "customer")
        throw Error("Choose a customer and an item");
      find(s.items, command.itemId);
      s.sales.push({
        id: command.id,
        customerId: command.customerId,
        itemId: command.itemId,
        quantity: safe(command.quantity, true),
        total: safe(command.total, true),
        date: command.date,
        status: "draft",
        cost: 0,
      });
      break;
    case "approve-sale": {
      const row = find(s.sales, command.entityId);
      if (row.status !== "draft")
        throw Error("This action is not valid for the current status");
      row.status = "approved";
      entityId = row.id;
      break;
    }
    case "dispatch-sale": {
      const row = find(s.sales, command.entityId);
      if (row.status !== "approved")
        throw Error("Approve the sale before dispatch");
      const item = find(s.items, row.itemId);
      row.cost = takeStock(
        s,
        row.itemId,
        item.kind === "finished" ? "finished" : "warehouse",
        row.quantity,
      );
      addStock(s, row.itemId, "transit", row.quantity, row.cost);
      row.status = "dispatched";
      entityId = row.id;
      break;
    }
    case "deliver-sale": {
      const row = find(s.sales, command.entityId),
        service = find(s.items, row.itemId).kind === "service";
      if (row.status !== (service ? "approved" : "dispatched"))
        throw Error(
          "Approve and dispatch goods, or approve a service, before completion",
        );
      if (!service) {
        const transit = position(s, row.itemId, "transit");
        if (transit.quantity < row.quantity || transit.value < row.cost)
          throw Error("Inconsistent transit balance");
        transit.quantity -= row.quantity;
        transit.value -= row.cost;
      }
      row.status = "delivered";
      entityId = row.id;
      proposal(
        s,
        command,
        "Delivered sale: " + find(s.items, row.itemId).name,
        [
          { head: "ar", debit: row.total, credit: 0 },
          { head: "sales", debit: 0, credit: row.total },
          ...(row.cost
            ? [
                { head: "cogs" as const, debit: row.cost, credit: 0 },
                { head: "inventory" as const, debit: 0, credit: row.cost },
              ]
            : []),
        ],
      );
      break;
    }
    case "employee":
      s.employees.push({
        id: command.id,
        name: named(command.name),
        role: named(command.role),
        monthlySalary: safe(command.monthlySalary),
        active: true,
      });
      break;
    case "attendance":
      find(s.employees, command.employeeId);
      if (
        s.attendance.some(
          (x) => x.employeeId === command.employeeId && x.date === command.date,
        )
      )
        throw Error("Attendance already exists for that date");
      s.attendance.push({
        employeeId: command.employeeId,
        date: command.date,
        status: command.status,
      });
      entityId = command.employeeId;
      break;
    case "payroll": {
      const employee = find(s.employees, command.employeeId);
      if (!employee.active || !/^\d{4}-(0[1-9]|1[0-2])$/.test(command.period))
        throw Error("Choose an active employee and valid payroll period");
      if (
        s.payroll.some(
          (x) => x.employeeId === employee.id && x.period === command.period,
        )
      )
        throw Error("Payroll already exists for this employee and period");
      safe(command.scheduledDays, true);
      safe(command.paidDays);
      safe(command.allowances);
      safe(command.deductions);
      if (command.paidDays > command.scheduledDays)
        throw Error("Paid days cannot exceed scheduled days");
      const base =
        (BigInt(employee.monthlySalary) * BigInt(command.paidDays) +
          BigInt(command.scheduledDays) / 2n) /
        BigInt(command.scheduledDays);
      const gross = exact(base + BigInt(command.allowances));
      if (command.deductions > gross || gross === 0)
        throw Error("Payroll deductions cannot exceed positive gross pay");
      s.payroll.push({
        id: command.id,
        employeeId: employee.id,
        period: command.period,
        gross,
        deductions: command.deductions,
        net: gross - command.deductions,
        status: "draft",
      });
      break;
    }
    case "approve-payroll": {
      const row = find(s.payroll, command.entityId);
      if (row.status !== "draft")
        throw Error("This action is not valid for the current status");
      row.status = "approved";
      entityId = row.id;
      proposal(s, command, "Payroll accrual: " + row.period, [
        { head: "wages", debit: row.gross, credit: 0 },
        ...(row.net
          ? [{ head: "payroll-payable" as const, debit: 0, credit: row.net }]
          : []),
        ...(row.deductions
          ? [{ head: "deductions" as const, debit: 0, credit: row.deductions }]
          : []),
      ]);
      break;
    }
    default:
      throw Error("Unsupported operation");
  }
  s.events.push({
    id: command.id,
    date: command.date,
    action: command.type,
    entityId,
    fingerprint,
  });
  return validateOperations(s);
}
export function capacityForDay(s: Operations, date: string) {
  assertDate(date);
  return s.centres.map((c) => ({
    name: c.name,
    available: c.minutesPerDay,
    committed: s.production
      .filter(
        (p) => p.centreId === c.id && p.date === date && p.status !== "draft",
      )
      .reduce((n, p) => n + p.minutes, 0),
  }));
}
export function marketShareBasisPoints(
  companySales: number,
  totalMarket: number,
): number {
  safe(companySales);
  safe(totalMarket, true);
  if (companySales > totalMarket)
    throw Error("Market total must include your company sales");
  return exact(
    (BigInt(companySales) * 10000n + BigInt(totalMarket) / 2n) /
      BigInt(totalMarket),
  );
}
