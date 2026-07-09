import { describe, it, expect } from 'vitest';
import {
  toSnake,
  toCamel,
  objectToSnake,
  objectToCamel,
  dbToFrontend,
  frontendToDb,
  COMPANY_TABLES,
  ORDER_HEADER_COLS,
  ORDER_ROW_COLS,
} from '@/lib/data-utils';

describe('toSnake', () => {
  it('converts simple camelCase to snake_case', () => {
    expect(toSnake('firstName')).toBe('first_name');
  });

  it('handles acronym override internalPO', () => {
    expect(toSnake('internalPO')).toBe('internal_po');
  });

  it('handles acronym override buyerPO', () => {
    expect(toSnake('buyerPO')).toBe('buyer_po');
  });

  it('handles single word', () => {
    expect(toSnake('companyid')).toBe('companyid');
  });

  it('handles consecutive uppercase', () => {
    expect(toSnake('UIButton')).toBe('ui_button');
  });

  it('handles leading uppercase', () => {
    expect(toSnake('CompanyId')).toBe('company_id');
  });

  it('handles empty string', () => {
    expect(toSnake('')).toBe('');
  });
});

describe('toCamel', () => {
  it('converts simple snake_case to camelCase', () => {
    expect(toCamel('first_name')).toBe('firstName');
  });

  it('handles acronym override internal_po', () => {
    expect(toCamel('internal_po')).toBe('internalPO');
  });

  it('handles acronym override buyer_po', () => {
    expect(toCamel('buyer_po')).toBe('buyerPO');
  });

  it('handles single word', () => {
    expect(toCamel('companyid')).toBe('companyid');
  });

  it('handles multiple underscores', () => {
    expect(toCamel('target_end_date')).toBe('targetEndDate');
  });

  it('handles empty string', () => {
    expect(toCamel('')).toBe('');
  });

  it('is inverse of toSnake for simple cases', () => {
    const original = 'createdAt';
    expect(toCamel(toSnake(original))).toBe(original);
  });
});

describe('objectToSnake', () => {
  it('converts all keys to snake_case', () => {
    const input = { firstName: 'John', lastName: 'Doe', companyId: 'abc' };
    const result = objectToSnake(input as any);
    expect(result).toEqual({ first_name: 'John', last_name: 'Doe', company_id: 'abc' });
  });

  it('skips frontend-only fields (_manualCode, _manualShort, createdAt, defaultRateBasis, defaultRateValue)', () => {
    const input = { firstName: 'John', _manualCode: 'X', createdAt: 'now', defaultRateBasis: 'per_piece' };
    const result = objectToSnake(input as any);
    expect(result).not.toHaveProperty('_manual_code');
    expect(result).not.toHaveProperty('_manualCode');
    expect(result).not.toHaveProperty('created_at');
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('default_rate_basis');
    expect(result).toHaveProperty('first_name', 'John');
  });

  it('preserves nested values as-is', () => {
    const input = { metadata: { key: 'val' } };
    const result = objectToSnake(input as any);
    expect(result).toEqual({ metadata: { key: 'val' } });
  });
});

describe('objectToCamel', () => {
  it('converts all keys to camelCase', () => {
    const input = { first_name: 'John', last_name: 'Doe', company_id: 'abc' };
    const result = objectToCamel(input);
    expect(result).toEqual({ firstName: 'John', lastName: 'Doe', companyId: 'abc' });
  });

  it('preserves nested values as-is', () => {
    const input = { meta_data: { inner_key: 'val' } };
    const result = objectToCamel(input);
    expect(result).toEqual({ metaData: { inner_key: 'val' } });
  });
});

describe('dbToFrontend', () => {
  it('converts snake_case to camelCase and adds active alias for isActive', () => {
    const input = { first_name: 'John', is_active: true, last_name: 'Doe' };
    const result = dbToFrontend(input);
    expect(result).toEqual({
      firstName: 'John',
      isActive: true,
      active: true,
      lastName: 'Doe',
    });
  });

  it('does not add active when isActive is missing', () => {
    const input = { first_name: 'John' };
    const result = dbToFrontend(input);
    expect(result).toEqual({ firstName: 'John' });
    expect(result).not.toHaveProperty('active');
  });

  it('handles empty object', () => {
    const result = dbToFrontend({});
    expect(result).toEqual({});
  });
});

describe('frontendToDb', () => {
  it('converts camelCase to snake_case and removes active, _manualCode', () => {
    const input = { firstName: 'John', active: true, _manualCode: 'X', lastName: 'Doe' };
    const result = frontendToDb(input as any, 'factories');
    expect(result).toHaveProperty('first_name', 'John');
    expect(result).toHaveProperty('last_name', 'Doe');
    expect(result).not.toHaveProperty('active');
    expect(result).not.toHaveProperty('_manualCode');
    expect(result).not.toHaveProperty('_manual_code');
  });

  it('maps active to is_active', () => {
    const input = { firstName: 'John', active: true };
    const result = frontendToDb(input as any, 'factories');
    expect(result.is_active).toBe(true);
  });

  it('converts empty strings to null', () => {
    const input = { firstName: 'John', lastName: '' };
    const result = frontendToDb(input as any, 'factories');
    expect(result.last_name).toBeNull();
  });

  it('does not map active to is_active if active is undefined', () => {
    const input = { firstName: 'John' };
    const result = frontendToDb(input as any, 'factories');
    expect(result).not.toHaveProperty('is_active');
  });

  it('handles empty object', () => {
    const result = frontendToDb({}, 'factories');
    expect(result).toEqual({});
  });
});

describe('constants', () => {
  it('COMPANY_TABLES contains expected tables', () => {
    expect(COMPANY_TABLES).toContain('factories');
    expect(COMPANY_TABLES).toContain('buyers');
    expect(COMPANY_TABLES).toContain('production_entries');
    expect(COMPANY_TABLES).not.toContain('profiles');
    expect(COMPANY_TABLES).not.toContain('order_headers');
  });

  it('ORDER_HEADER_COLS matches order_headers schema', () => {
    expect(ORDER_HEADER_COLS).toContain('company_id');
    expect(ORDER_HEADER_COLS).toContain('internal_po');
    expect(ORDER_HEADER_COLS).toContain('status');
    expect(ORDER_HEADER_COLS).not.toContain('order_qty');
    expect(ORDER_HEADER_COLS).not.toContain('fabric_id');
  });

  it('ORDER_ROW_COLS matches order_rows schema', () => {
    expect(ORDER_ROW_COLS).toContain('order_qty');
    expect(ORDER_ROW_COLS).toContain('fabric_id');
    expect(ORDER_ROW_COLS).toContain('no_of_colours');
    expect(ORDER_ROW_COLS).not.toContain('company_id');
    expect(ORDER_ROW_COLS).not.toContain('internal_po');
  });
});

describe('roundtrip', () => {
  it('dbToFrontend then frontendToDb preserves data', () => {
    const dbRow = { first_name: 'John', is_active: true, company_id: 'abc' };
    const front = dbToFrontend(dbRow);
    const back = frontendToDb(front as any, 'factories');
    expect(back.first_name).toBe('John');
    expect(back.is_active).toBe(true);
  });
});
