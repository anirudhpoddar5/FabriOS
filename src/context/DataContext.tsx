import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { AppData } from '@/types';

// Maps AppData keys to Supabase table names
const TABLE_MAP: Record<keyof AppData, string> = {
  users: 'profiles',
  companies: 'companies',
  factories: 'factories',
  shifts: 'shifts',
  workerTypes: 'worker_types',
  rateMasters: 'rate_masters',
  buyers: 'buyers',
  fabrics: 'fabrics',
  printingTables: 'printing_tables',
  stitchingLines: 'stitching_lines',
  printingProducts: 'printing_products',
  stitchingProducts: 'stitching_products',
  printingOrders: 'order_headers',
  printingColourways: 'order_colourways',
  stitchingOrders: 'order_headers',
  stitchingColourways: 'order_colourways',
  entries: 'production_entries',
};

// Maps known snake_case → camelCase for acronyms
const CAMEL_OVERRIDES: Record<string, string> = {
  internal_po: 'internalPO',
  buyer_po: 'buyerPO',
};

// camelCase → snake_case
// Handles consecutive uppercase as a single token (e.g. internalPO → internal_po)
// Also handles edge cases like "noOfColours" → "no_of_colours"
function toSnake(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch >= 'A' && ch <= 'Z') {
      const prev = i > 0 ? str[i - 1] : '';
      const next = i + 1 < str.length ? str[i + 1] : '';
      const nextNext = i + 2 < str.length ? str[i + 2] : '';
      // Insert underscore before uppercase when previous char is lowercase
      if (prev >= 'a' && prev <= 'z') {
        result += '_';
      }
      // Insert underscore between consecutive uppercase if followed by lowercase
      // e.g., "UIButton" → "UI_Button"
      else if (prev >= 'A' && prev <= 'Z' && next >= 'a' && next <= 'z') {
        result += '_';
      }
    }
    result += ch.toLowerCase();
  }
  return result;
}

// snake_case → camelCase
function toCamel(str: string): string {
  if (CAMEL_OVERRIDES[str]) return CAMEL_OVERRIDES[str];
  return str.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
}

function objectToSnake(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const snakeKey = toSnake(k);
    // Skip internal/frontend-only fields
    if (k === '_manualCode' || k === '_manualShort' || k === 'createdAt' || k === 'defaultRateBasis' || k === 'defaultRateValue') continue;
    result[snakeKey] = v;
  }
  return result;
}

function objectToCamel(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[toCamel(k)] = v;
  }
  return result;
}

// Map DB row to frontend object, adding `active` alias for `is_active`
function dbToFrontend(row: Record<string, any>): Record<string, any> {
  const camel = objectToCamel(row);
  if ('isActive' in camel) {
    camel.active = camel.isActive;
  }
  return camel;
}

// Map frontend object to DB row
function frontendToDb(obj: Record<string, any>, dataKey: keyof AppData): Record<string, any> {
  const cleaned = { ...obj };
  // Remove frontend-only fields
  delete cleaned._manualCode;
  delete cleaned.active; // use is_active instead
  
  const snake = objectToSnake(cleaned);
  
  // Convert empty strings to null — DB rejects '' for numeric columns
  for (const key of Object.keys(snake)) {
    if (snake[key] === '') snake[key] = null;
  }
  
  // Map `active` → `is_active` if it was set
  if ('active' in obj && obj.active !== undefined) {
    snake.is_active = obj.active;
  }
  
  return snake;
}

const defaultData: AppData = {
  users: [], companies: [], factories: [], shifts: [], workerTypes: [], rateMasters: [],
  buyers: [], fabrics: [], printingTables: [], stitchingLines: [],
  printingProducts: [], stitchingProducts: [],
  printingOrders: [], printingColourways: [],
  stitchingOrders: [], stitchingColourways: [],
  entries: [],
};

export function generateId(): string {
  return crypto.randomUUID();
}

interface DataContextType {
  data: AppData;
  loading: boolean;
  currentFactoryId: string | null;
  setCurrentFactoryId: (id: string | null) => void;
  addItem: <K extends keyof AppData>(key: K, item: AppData[K][number]) => Promise<{ error: string | null }>;
  updateItem: <K extends keyof AppData>(key: K, id: string, updates: Partial<AppData[K][number]>) => Promise<{ error: string | null }>;
  deleteItem: <K extends keyof AppData>(key: K, id: string) => Promise<{ error: string | null }>;
  getItems: <K extends keyof AppData>(key: K) => AppData[K];
  addItems: <K extends keyof AppData>(key: K, items: AppData[K][number][]) => Promise<{ error: string | null }>;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [data, setData] = useState<AppData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [currentFactoryId, setCurrentFactoryId] = useState<string | null>(
    () => localStorage.getItem('fabrios_factory') || null
  );
  const companyId = profile?.company_id;
  const loadedRef = useRef(false);

  useEffect(() => {
    if (currentFactoryId) localStorage.setItem('fabrios_factory', currentFactoryId);
    else localStorage.removeItem('fabrios_factory');
  }, [currentFactoryId]);

  const fetchAllData = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [
        factories, shifts, buyers, fabrics,
        printingProducts, stitchingProducts,
        printingTables, stitchingLines,
        workerTypes, rateMasters,
        orderHeaders, orderRows, orderColourways,
        entries, profiles,
      ] = await Promise.all([
        supabase.from('factories').select('*').eq('company_id', companyId),
        supabase.from('shifts').select('*'),
        supabase.from('buyers').select('*').eq('company_id', companyId),
        supabase.from('fabrics').select('*').eq('company_id', companyId),
        supabase.from('printing_products').select('*').eq('company_id', companyId),
        supabase.from('stitching_products').select('*').eq('company_id', companyId),
        supabase.from('printing_tables').select('*'),
        supabase.from('stitching_lines').select('*'),
        supabase.from('worker_types').select('*').eq('company_id', companyId),
        supabase.from('rate_masters').select('*').eq('company_id', companyId),
        supabase.from('order_headers').select('*').eq('company_id', companyId),
        supabase.from('order_rows').select('*'),
        supabase.from('order_colourways').select('*'),
        supabase.from('production_entries').select('*').eq('company_id', companyId),
        supabase.from('profiles').select('*'),
      ]);

      // Get factory IDs for filtering shifts/tables/lines
      const factoryIds = (factories.data || []).map((f: any) => f.id);

      // Split orders by module
      const allOrders = (orderHeaders.data || []).map(dbToFrontend);
      const allRows = (orderRows.data || []).map(dbToFrontend);

      // Merge order_rows data into each order (orderQty, fabricId, uom, etc. live in order_rows)
      const rowByOrderId: Record<string, any> = {};
      allRows.forEach((r: any) => { rowByOrderId[r.orderId] = r; });

      const mergeOrderRow = (order: any) => {
        const row = rowByOrderId[order.id];
        if (!row) return order;
        return {
          ...order,
          orderQty: row.orderQty,
          chartQty: row.chartQty,
          fabricId: row.fabricId,
          fabricWidth: row.fabricWidth,
          uom: row.uom,
          ratePerItem: row.ratePerItem,
          noOfColours: row.noOfColours,
          printingProductId: row.productId,
          stitchingProductId: row.productId,
        };
      };

      const printingOrders = allOrders.filter((o: any) => o.module === 'printing').map(mergeOrderRow);
      const stitchingOrders = allOrders.filter((o: any) => o.module === 'stitching').map(mergeOrderRow);

      // Get order row IDs grouped by module
      const printingOrderIds = new Set(printingOrders.map((o: any) => o.id));
      const stitchingOrderIds = new Set(stitchingOrders.map((o: any) => o.id));
      const printingRowIds = new Set(allRows.filter((r: any) => printingOrderIds.has(r.orderId)).map((r: any) => r.id));
      const stitchingRowIds = new Set(allRows.filter((r: any) => stitchingOrderIds.has(r.orderId)).map((r: any) => r.id));

      // Split colourways by module  
      const allColourways = (orderColourways.data || []).map(dbToFrontend);
      const printingColourways = allColourways.filter((c: any) => printingRowIds.has(c.orderRowId));
      const stitchingColourways = allColourways.filter((c: any) => stitchingRowIds.has(c.orderRowId));

      // For backward compatibility, map colourway.orderRowId → orderId
      const rowToOrder: Record<string, string> = {};
      allRows.forEach((r: any) => { rowToOrder[r.id] = r.orderId; });
      
      const mapColourway = (c: any) => ({
        ...c,
        orderId: rowToOrder[c.orderRowId] || c.orderRowId,
      });

      setData({
        users: (profiles.data || []).map(dbToFrontend) as any,
        companies: [], // not needed at this level
        factories: (factories.data || []).map(dbToFrontend) as any,
        shifts: (shifts.data || []).filter((s: any) => factoryIds.includes(s.factory_id)).map(dbToFrontend) as any,
        buyers: (buyers.data || []).map(dbToFrontend) as any,
        fabrics: (fabrics.data || []).map(dbToFrontend) as any,
        printingProducts: (printingProducts.data || []).map(dbToFrontend) as any,
        stitchingProducts: (stitchingProducts.data || []).map(dbToFrontend) as any,
        printingTables: (printingTables.data || []).filter((t: any) => factoryIds.includes(t.factory_id)).map(dbToFrontend) as any,
        stitchingLines: (stitchingLines.data || []).filter((l: any) => factoryIds.includes(l.factory_id)).map(dbToFrontend) as any,
        workerTypes: (workerTypes.data || []).map(dbToFrontend) as any,
        rateMasters: (rateMasters.data || []).map(dbToFrontend) as any,
        printingOrders: printingOrders as any,
        printingColourways: printingColourways.map(mapColourway) as any,
        stitchingOrders: stitchingOrders as any,
        stitchingColourways: stitchingColourways.map(mapColourway) as any,
        entries: (entries.data || []).map(dbToFrontend) as any,
      });
    } catch (err) {
      console.error('Failed to load data:', err);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    if (companyId && !loadedRef.current) {
      loadedRef.current = true;
      fetchAllData();
    }
  }, [companyId, fetchAllData]);

  const refreshData = useCallback(async () => {
    loadedRef.current = false;
    await fetchAllData();
    loadedRef.current = true;
  }, [fetchAllData]);

  const addItem = useCallback(async <K extends keyof AppData>(key: K, item: AppData[K][number]): Promise<{ error: string | null }> => {
    if (!companyId) return { error: 'No company selected' };
    const tableName = TABLE_MAP[key];
    const frontItem = item as any;

    // Build DB row
    const dbRow: Record<string, any> = frontendToDb(frontItem, key);
    
    // Add company_id for company-scoped tables
    const companyTables = ['factories', 'buyers', 'fabrics', 'printing_products', 'stitching_products', 'worker_types', 'rate_masters', 'production_entries'];
    if (companyTables.includes(tableName)) {
      dbRow.company_id = companyId;
    }

    // Remove undefined keys and timestamps
    Object.keys(dbRow).forEach(k => {
      if (dbRow[k] === undefined) delete dbRow[k];
    });
    delete dbRow.created_at;
    delete dbRow.updated_at;

    // For orders: split into order_headers + order_rows (orderQty, fabricId etc. live in order_rows)
    if (key === 'printingOrders' || key === 'stitchingOrders') {
      dbRow.module = key === 'printingOrders' ? 'printing' : 'stitching';
      dbRow.company_id = companyId;

      const headerCols = ['company_id', 'module', 'internal_po', 'buyer_id', 'buyer_po',
        'style', 'currency', 'target_end_date', 'buyer_delivery_date', 'status', 'remarks'];
      const rowCols = ['product_id', 'fabric_id', 'fabric_width', 'uom', 'order_qty',
        'chart_qty', 'rate_per_item', 'no_of_colours'];

      const headerRow: Record<string, any> = {};
      const orderRow: Record<string, any> = {};
      Object.entries(dbRow).forEach(([k, v]) => {
        if (headerCols.includes(k)) headerRow[k] = v;
        else if (rowCols.includes(k)) orderRow[k] = v;
      });

      const { data: newHeader, error: hErr } = await supabase
        .from(tableName as any).insert(headerRow as any).select('id').single();
      if (hErr) return { error: hErr.message };

      if (Object.keys(orderRow).length > 0) {
        orderRow.id = generateId();
        orderRow.order_id = newHeader.id;
        const { error: rErr } = await supabase.from('order_rows').insert(orderRow as any);
        if (rErr) return { error: rErr.message };
      }

      setData(prev => ({
        ...prev,
        [key]: [...prev[key], { ...frontItem, active: true }] as any,
      }));
      return { error: null };
    }

    // For colourways, map orderId back to order_row_id
    if (key === 'printingColourways' || key === 'stitchingColourways') {
      if (dbRow.order_id && !dbRow.order_row_id) {
        dbRow.order_row_id = dbRow.order_id;
        delete dbRow.order_id;
      }
    }

    const { error } = await supabase.from(tableName as any).insert(dbRow as any);
    if (error) {
      console.error(`Insert error on ${tableName}:`, error);
      return { error: error.message };
    }

    // Optimistically update local state
    setData(prev => ({ ...prev, [key]: [...prev[key], { ...frontItem, active: frontItem.active ?? frontItem.isActive ?? true }] } as AppData));
    return { error: null };
  }, [companyId]);

  const addItems = useCallback(async <K extends keyof AppData>(key: K, items: AppData[K][number][]): Promise<{ error: string | null }> => {
    for (const item of items) {
      const result = await addItem(key, item);
      if (result.error) return result;
    }
    return { error: null };
  }, [addItem]);

  const updateItem = useCallback(async <K extends keyof AppData>(key: K, id: string, updates: Partial<AppData[K][number]>): Promise<{ error: string | null }> => {
    const tableName = TABLE_MAP[key];
    const dbUpdates = frontendToDb(updates as any, key);
    
    delete dbUpdates.id;
    delete dbUpdates.created_at;
    delete dbUpdates.updated_at;
    delete dbUpdates.company_id;
    
    Object.keys(dbUpdates).forEach(k => {
      if (dbUpdates[k] === undefined) delete dbUpdates[k];
    });

    const { error } = await supabase.from(tableName as any).update(dbUpdates as any).eq('id', id);
    if (error) {
      console.error(`Update error on ${tableName}:`, error);
      return { error: error.message };
    }

    setData(prev => ({
      ...prev,
      [key]: (prev[key] as any[]).map((item: any) => item.id === id ? { ...item, ...updates } : item),
    } as AppData));
    return { error: null };
  }, []);

  const deleteItem = useCallback(async <K extends keyof AppData>(key: K, id: string): Promise<{ error: string | null }> => {
    const tableName = TABLE_MAP[key];
    const { error } = await supabase.from(tableName as any).delete().eq('id', id);
    if (error) {
      console.error(`Delete error on ${tableName}:`, error);
      return { error: error.message };
    }
    setData(prev => ({
      ...prev,
      [key]: (prev[key] as any[]).filter((item: any) => item.id !== id),
    } as AppData));
    return { error: null };
  }, []);

  const getItems = useCallback(<K extends keyof AppData>(key: K): AppData[K] => data[key], [data]);

  return (
    <DataContext.Provider value={{ data, loading, currentFactoryId, setCurrentFactoryId, addItem, addItems, updateItem, deleteItem, getItems, refreshData }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
