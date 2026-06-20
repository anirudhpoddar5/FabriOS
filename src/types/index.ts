export interface User {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

export interface Company {
  id: string;
  name: string;
  legalName?: string;
  address?: string;
  active: boolean;
}

export interface Factory {
  id: string;
  code: string;
  name: string;
  type: 'printing' | 'stitching' | 'mixed';
  active: boolean;
}

export interface Shift {
  id: string;
  factoryId: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  active: boolean;
}

export interface WorkerType {
  id: string;
  name: string;
  factoryId: string;
  module: 'printing' | 'stitching' | 'both';
  active: boolean;
}

export type RateBasis = 'per_person_per_shift' | 'per_piece' | 'per_meter';

export interface RateMaster {
  id: string;
  factoryId: string;
  shiftId: string;
  workerTypeId: string;
  rateBasis: RateBasis;
  rateValue: number;
  effectiveFrom: string;
  effectiveTo?: string;
  active: boolean;
}

export interface Buyer {
  id: string;
  code: string;
  name?: string;
  contactPerson?: string;
  address?: string;
  phone?: string;
  email?: string;
  country: string;
  active: boolean;
}

export interface Fabric {
  id: string;
  name: string;
  shortForm: string;
  active: boolean;
}

export interface PrintingTable {
  id: string;
  factoryId: string;
  code: string;
  name: string;
  size?: string;
  supervisorName?: string;
  active: boolean;
}

export interface StitchingLine {
  id: string;
  factoryId: string;
  code: string;
  name: string;
  machines?: number;
  supervisorName?: string;
  active: boolean;
}

export interface PrintingProduct {
  id: string;
  code: string;
  name: string;
  size?: string;
  uom: string;
  active: boolean;
}

export interface StitchingProduct {
  id: string;
  code: string;
  name: string;
  sizeSpec?: string;
  uom: string;
  active: boolean;
}

export type OrderStatus = 'Started' | 'Completed' | 'Cancelled' | 'Shipped';

// Fields from order_headers table
export interface OrderHeader {
  id: string;
  buyerId: string;
  style: string;
  internalPO: string;
  buyerPO?: string;
  currency: string;
  targetEndDate: string;
  buyerDeliveryDate: string;
  remarks?: string;
  status: OrderStatus;
  createdAt: string;
}

// Fields from order_rows table
export interface OrderRow {
  orderQty: number;
  chartQty: number;
  fabricId?: string;
  fabricWidth?: string;
  uom: string;
  ratePerItem?: number;
  noOfColours?: number;
}

// Merged type — used for display after DataContext merges order_rows into order_headers
export interface PrintingOrder extends OrderHeader, OrderRow {
  printingProductId: string;
}

export interface PrintingColourway {
  id: string;
  orderId: string;
  colourName: string;
  orderedQty: number;
  uom: string;
  notes?: string;
}

// Merged type — used for display after DataContext merges order_rows into order_headers
export interface StitchingOrder extends OrderHeader, OrderRow {
  stitchingProductId: string;
  linkedPrintingOrderId?: string;
}

export interface StitchingColourway {
  id: string;
  orderId: string;
  colourName: string;
  orderedQty: number;
  uom: string;
  notes?: string;
}

export interface ProductionEntry {
  id: string;
  date: string;
  module: 'printing' | 'stitching';
  orderId: string;
  colourwayId: string;
  factoryId: string;
  shiftId: string;
  resourceId: string;
  workerTypeId: string;
  personsUsed: number;
  outputQty: number;
  outputUOM: string;
  rateMasterId: string;
  rateBasis: RateBasis;
  rateValue: number;
  costAmount: number;
  notes?: string;
  createdAt: string;
}

export interface AppData {
  users: User[];
  companies: Company[];
  factories: Factory[];
  shifts: Shift[];
  workerTypes: WorkerType[];
  rateMasters: RateMaster[];
  buyers: Buyer[];
  fabrics: Fabric[];
  printingTables: PrintingTable[];
  stitchingLines: StitchingLine[];
  printingProducts: PrintingProduct[];
  stitchingProducts: StitchingProduct[];
  printingOrders: PrintingOrder[];
  printingColourways: PrintingColourway[];
  stitchingOrders: StitchingOrder[];
  stitchingColourways: StitchingColourway[];
  entries: ProductionEntry[];
}

export type AppModule = 'printing' | 'stitching' | 'both';
