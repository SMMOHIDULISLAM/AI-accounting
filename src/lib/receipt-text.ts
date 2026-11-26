import { isValidDate, parseMoney } from "./accounting";
export function receiptCandidates(text: string) {
  const totals: { amount: number; currency?: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match =
      /^\s*(?:grand\s+total|total\s+amount|amount\s+due|total)\s*[:=]?\s*(?:(BDT|USD|GBP|EUR|CAD|INR|AUD)\s*)?([\d,]+(?:\.\d{1,2})?)\s*(BDT|USD|GBP|EUR|CAD|INR|AUD)?\s*$/i.exec(
        line,
      );
    if (!match) continue;
    try {
      const amount = parseMoney(match[2]);
      if (amount > 0)
        totals.push({
          amount,
          currency: (match[1] || match[3])?.toUpperCase(),
        });
    } catch {
      /* Unreadable totals remain unknown. */
    }
  }
  const dates = [...text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)]
    .map((match) => match[0])
    .filter(isValidDate);
  const unique = [
    ...new Map(
      totals.map((total) => [`${total.currency}:${total.amount}`, total]),
    ).values(),
  ];
  return {
    totals: unique,
    dates: [...new Set(dates)],
    needsReview: true as const,
  };
}
