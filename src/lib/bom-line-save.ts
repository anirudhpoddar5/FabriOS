export interface BomLineFormValue {
  category?: string;
  item_name?: string;
  item_id?: string | null;
  quantity?: number | string;
  avg_consumption?: number | string;
  extra_pct?: number | string;
  rate?: number | string;
  total_amount?: number | string;
  uom?: string;
  vendor_name?: string | null;
  remarks?: string | null;
}

export function buildBomLinePayloads(bomId: string, lines: BomLineFormValue[]) {
  return lines.map((line, sort_order) => ({
    bom_id: bomId,
    category: line.category || 'fabric',
    item_name: line.item_name || '',
    item_id: line.item_id || null,
    quantity: Number(line.quantity) || 0,
    avg_consumption: Number(line.avg_consumption) || 0,
    extra_pct: Number(line.extra_pct) || 0,
    rate: Number(line.rate) || 0,
    total_amount: Number(line.total_amount) || 0,
    uom: line.uom || '',
    vendor_name: line.vendor_name || null,
    remarks: line.remarks || null,
    sort_order,
  }));
}
