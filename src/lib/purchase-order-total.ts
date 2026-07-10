export function calculatePurchaseOrderTotal(lines: Array<{ total_amount?: number | string | null }>): number {
  return lines.reduce((total, line) => total + (Number(line.total_amount) || 0), 0);
}
