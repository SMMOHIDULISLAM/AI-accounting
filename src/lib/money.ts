/** Exact decimal text for a validated integer, without floating-point division. */
export function minorUnitsText(amount: number): string {
  if (!Number.isSafeInteger(amount))
    throw new Error("Money must be a safe integer");
  const text = Math.abs(amount).toString().padStart(3, "0");
  return `${amount < 0 ? "-" : ""}${text.slice(0, -2)}.${text.slice(-2)}`;
}
