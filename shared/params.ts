// Query-string numbers for the API, made safe to compute with.

/**
 * A whole number from a query value, kept within [lo, hi]. Missing or non-numeric input
 * ("abc", "") gives the default instead of NaN, which would otherwise flow into array sizes.
 */
export function intParam(raw: string | undefined | null, def: number, lo: number, hi: number): number {
  const n = raw == null || raw.trim() === "" ? NaN : Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}

/** Recall planner limits: the knapsack table is (candidates x budget x staff), so both are capped. */
export const RECALL_BUDGET = { def: 10, lo: 1, hi: 60 } as const;
export const RECALL_STAFF = { def: 3, lo: 1, hi: 10 } as const;

export function recallParams(budget: string | undefined, staff: string | undefined) {
  return {
    budget: intParam(budget, RECALL_BUDGET.def, RECALL_BUDGET.lo, RECALL_BUDGET.hi),
    staff: intParam(staff, RECALL_STAFF.def, RECALL_STAFF.lo, RECALL_STAFF.hi),
  };
}
