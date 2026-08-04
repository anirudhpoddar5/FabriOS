import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { AppData } from '@/types';
import { dbToFrontend, frontendToDb, COMPANY_TABLES } from '@/lib/data-utils';
import { separateOrderData } from '@/lib/order-data';

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
  workers: 'workers',
  quotations: 'quotations',
  quotationLines: 'quotation_lines',
  invoices: 'invoices',
  subcontractJobs: 'subcontract_jobs',
  orderRows: 'order_rows',
};

const defaultData: AppData = {
  users: [], companies: [], factories: [], shifts: [], workerTypes: [], rateMasters: [],
  buyers: [], fabrics: [], printingTables: [], stitchingLines: [],
  printingProducts: [], stitchingProducts: [],
  orderRows: [],
  printingOrders: [], printingColourways: [],
  stitchingOrders: [], stitchingColourways: [],
  entries: [],
  workers: [],
  quotations: [],
  quotationLines: [],
  invoices: [],
  subcontractJobs: [],
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
        companies, factories, buyers, fabrics,
        printingProducts, stitchingProducts,
        workerTypes, rateMasters,
        orderHeaders, orderRows, orderColourways,
        entries, profiles, workers,
        quotations, quotationLines,
        invoices, subcontractJobs,
      ] = await Promise.all([
        supabase.from('companies').select('*').eq('id', companyId),
        supabase.from('factories').select('*').eq('company_id', companyId),
        supabase.from('buyers').select('*').eq('company_id', companyId),
        supabase.from('fabrics').select('*').eq('company_id', companyId),
        supabase.from('printing_products').select('*').eq('company_id', companyId),
        supabase.from('stitching_products').select('*').eq('company_id', companyId),
        supabase.from('worker_types').select('*').eq('company_id', companyId),
        supabase.from('rate_masters').select('*').eq('company_id', companyId),
        supabase.from('order_headers').select('*').eq('company_id', companyId),
        supabase.from('order_rows').select('*'),
        supabase.from('order_colourways').select('*'),
        supabase.from('production_entries').select('*').eq('company_id', companyId),
        supabase.from('profiles').select('*'),
        supabase.from('workers').select('*').eq('company_id', companyId),
        supabase.from('quotations').select('*').eq('company_id', companyId).order('date', { ascending: false }),
        supabase.from('quotation_lines').select('*'),
        supabase.from('invoices').select('*').eq('company_id', companyId).order('invoice_date', { ascending: false }),
        supabase.from('subcontract_jobs').select('*').eq('company_id', companyId).order('send_date', { ascending: false }),
      ]);

      // Get factory IDs for filtering shifts/tables/lines
      const factoryIds = (factories.data || []).map((f: any) => f.id);

      // Fetch shifts/tables/lines filtered by company's factory IDs
      const [shifts, printingTables, stitchingLines] = await Promise.all([
        factoryIds.length > 0
          ? supabase.from('shifts').select('*').in('factory_id', factoryIds)
          : { data: [] },
        factoryIds.length > 0
          ? supabase.from('printing_tables').select('*').in('factory_id', factoryIds)
          : { data: [] },
        factoryIds.length > 0
          ? supabase.from('stitching_lines').select('*').in('factory_id', factoryIds)
          : { data: [] },
      ]);

      // Split orders by module
      const allOrders = (orderHeaders.data || []).map(dbToFrontend);
      const allRows = (orderRows.data || []).map(dbToFrontend);

      const allColourways = (orderColourways.data || []).map(dbToFrontend);
      const relatedOrders = separateOrderData(allOrders, allRows, allColourways);

      setData({
        users: (profiles.data || []).map(dbToFrontend) as any,
        companies: (companies.data || []).map(dbToFrontend) as any,
        factories: (factories.data || []).map(dbToFrontend) as any,
        shifts: (shifts.data || []).map(dbToFrontend) as any,
        buyers: (buyers.data || []).map(dbToFrontend) as any,
        fabrics: (fabrics.data || []).map(dbToFrontend) as any,
        printingProducts: (printingProducts.data || []).map(dbToFrontend) as any,
        stitchingProducts: (stitchingProducts.data || []).map(dbToFrontend) as any,
        printingTables: (printingTables.data || []).map(dbToFrontend) as any,
        stitchingLines: (stitchingLines.data || []).map(dbToFrontend) as any,
        workerTypes: (workerTypes.data || []).map(dbToFrontend) as any,
        rateMasters: (rateMasters.data || []).map(dbToFrontend) as any,
        printingOrders: relatedOrders.printingOrders as any,
        printingColourways: relatedOrders.printingColourways as any,
        stitchingOrders: relatedOrders.stitchingOrders as any,
        stitchingColourways: relatedOrders.stitchingColourways as any,
        orderRows: relatedOrders.orderRows as any,
        entries: (entries.data || []).map(dbToFrontend) as any,
        workers: (workers.data || []).map(dbToFrontend) as any,
        quotations: (quotations.data || []).map(dbToFrontend) as any,
        quotationLines: (quotationLines.data || []).map(dbToFrontend) as any,
        invoices: (invoices.data || []).map(dbToFrontend) as any,
        subcontractJobs: (subcontractJobs.data || []).map(dbToFrontend) as any,
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
    const dbRow = frontendToDb(frontItem, key);
    
    // Add company_id for company-scoped tables
    if (COMPANY_TABLES.includes(tableName)) {
      dbRow.company_id = companyId;
    }

    // Remove undefined keys and timestamps
    Object.keys(dbRow).forEach(k => {
      if (dbRow[k] === undefined) delete dbRow[k];
    });
    delete dbRow.created_at;
    delete dbRow.updated_at;

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
    
    // Refresh data to ensure synchronization with DB
    await refreshData();
    return { error: null };
  }, [companyId, refreshData]);

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
    
    // Refresh data to ensure synchronization with DB
    await refreshData();
    return { error: null };
  }, [refreshData]);

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
    
    // Refresh data to ensure synchronization with DB
    await refreshData();
    return { error: null };
  }, [refreshData]);

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
