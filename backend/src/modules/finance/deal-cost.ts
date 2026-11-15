/**
 * Shared commercial cost rule for Sales Register and Sales Analytics.
 *
 * A supplier obligation equal to or greater than the customer sale is treated
 * as a legacy/demo projection (often auto-created from a booking amount), not
 * as a real cost. In that case the frozen commercial snapshot/product cost is
 * used instead.
 */
export function shouldUseObligationCost(sales: number, obligationCost: number): boolean {
  return obligationCost > 0 && obligationCost < sales;
}

export function resolveDealCost(input: {
  sales: number;
  obligationCost: number;
  snapshotCost: number;
  productCost: number;
}): number {
  return shouldUseObligationCost(input.sales, input.obligationCost)
    ? input.obligationCost
    : input.snapshotCost || input.productCost;
}
