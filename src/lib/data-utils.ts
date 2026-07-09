import { AppData } from '@/types';

// Maps known snake_case → camelCase for acronyms
const CAMEL_OVERRIDES: Record<string, string> = {
  internal_po: 'internalPO',
  buyer_po: 'buyerPO',
};

// Maps known camelCase → snake_case for acronyms
const SNAKE_OVERRIDES: Record<string, string> = {
  internalPO: 'internal_po',
  buyerPO: 'buyer_po',
};

// camelCase → snake_case
export function toSnake(str: string): string {
  if (SNAKE_OVERRIDES[str]) return SNAKE_OVERRIDES[str];
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch >= 'A' && ch <= 'Z') {
      const prev = i > 0 ? str[i - 1] : '';
      const next = i + 1 < str.length ? str[i + 1] : '';
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
export function toCamel(str: string): string {
  if (CAMEL_OVERRIDES[str]) return CAMEL_OVERRIDES[str];
  return str.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
}

export function objectToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const snakeKey = toSnake(k);
    if (['_manualCode', '_manualShort', 'createdAt', 'defaultRateBasis', 'defaultRateValue'].includes(k)) continue;
    result[snakeKey] = v;
  }
  return result;
}

export function objectToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[toCamel(k)] = v;
  }
  return result;
}

export function dbToFrontend(row: Record<string, unknown>): Record<string, unknown> {
  const camel = objectToCamel(row);
  if ('isActive' in camel) {
    camel.active = camel.isActive;
  }
  return camel;
}

export function frontendToDb(obj: Record<string, unknown>, dataKey: keyof AppData): Record<string, unknown> {
  const cleaned = { ...obj };
  delete cleaned._manualCode;
  delete cleaned.active;

  const snake = objectToSnake(cleaned);

  for (const key of Object.keys(snake)) {
    if (snake[key] === '') snake[key] = null;
  }

  if ('active' in obj && obj.active !== undefined) {
    snake.is_active = obj.active;
  }

  return snake;
}

export const COMPANY_TABLES = [
  'factories', 'buyers', 'fabrics', 'printing_products',
  'stitching_products', 'worker_types', 'rate_masters', 'production_entries',
  'workers', 'quotations', 'invoices', 'subcontract_jobs',
];

export const ORDER_HEADER_COLS = [
  'company_id', 'module', 'internal_po', 'buyer_id', 'buyer_po',
  'style', 'currency', 'target_end_date', 'buyer_delivery_date', 'status', 'remarks',
];

export const ORDER_ROW_COLS = [
  'product_id', 'fabric_id', 'fabric_width', 'uom', 'order_qty',
  'chart_qty', 'rate_per_item', 'no_of_colours',
];
