import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import type { ProductionEntry } from '@/types';
import { frontendToDb } from '@/lib/data-utils';

export type ConsumptionStatus = 'consumed' | 'not_available';

export interface SaveProductionEntryWithConsumptionResult {
  productionEntryId: string;
  consumptionStatus: ConsumptionStatus;
  consumptionCount: number;
}

export function calculatePlannedConsumption(avgConsumption: number | null | undefined, outputQty: number): number | null {
  const avg = Number(avgConsumption) || 0;
  const output = Number(outputQty) || 0;
  if (avg <= 0 || output <= 0) return null;
  return avg * output;
}

export function calculateConsumptionAdjustment(previousActualQty: number, nextActualQty: number): number {
  return nextActualQty - previousActualQty;
}

export function calculateStockAdjustmentQty(previousActualQty: number, nextActualQty: number): number {
  return -calculateConsumptionAdjustment(previousActualQty, nextActualQty);
}

export function buildProductionEntryPayload(entry: ProductionEntry): Json {
  const dbRow = frontendToDb(entry as unknown as Record<string, unknown>, 'entries');
  delete dbRow.company_id;
  delete dbRow.created_at;
  delete dbRow.updated_at;

  Object.keys(dbRow).forEach(key => {
    if (dbRow[key] === undefined) delete dbRow[key];
  });

  return dbRow as Json;
}

export async function saveProductionEntryWithConsumption(
  client: SupabaseClient<Database>,
  entry: ProductionEntry,
): Promise<{ data: SaveProductionEntryWithConsumptionResult | null; error: string | null }> {
  const { data, error } = await client.rpc('save_production_entry_with_consumption', {
    payload: buildProductionEntryPayload(entry),
  });

  if (error) return { data: null, error: error.message };

  const value = (data || {}) as Record<string, unknown>;
  return {
    data: {
      productionEntryId: String(value.production_entry_id || entry.id),
      consumptionStatus: value.consumption_status === 'consumed' ? 'consumed' : 'not_available',
      consumptionCount: Number(value.consumption_count || 0),
    },
    error: null,
  };
}
