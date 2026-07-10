import { describe, it, expect } from 'vitest';
import { getOrderDelay } from '@/lib/order-delay';

const WORKING_DAYS = [1, 2, 3, 4, 5, 6]; // Mon–Sat
const COLOURWAYS = (orderId: string, qty: number) => [
  { orderId, orderedQty: qty, id: 'cw-1', colourName: 'Red', orderRowId: 'row-1', sortOrder: 1 },
];

function order(overrides: any = {}) {
  return { id: 'order-1', status: 'Started', targetEndDate: null, buyerDeliveryDate: null, ...overrides };
}

describe('Sunday exclusion', () => {
  // Sun Jul 19 2026 is a non-working day (0)
  it('counts working days correctly excluding Sunday', () => {
    const now = new Date('2026-07-13T10:00:00'); // Monday
    const due = '2026-07-19'; // Sunday
    const result = getOrderDelay(
      order({ targetEndDate: due }),
      COLOURWAYS('order-1', 100),
      [],
      now,
      WORKING_DAYS,
    );
    // tomorrow (Tue Jul 14) through Sun Jul 19 inclusive: Tue Wed Thu Fri Sat = 5 working days
    expect(result.remainingWorkingDays).toBe(5);
    // Sunday itself excluded
  });
});

describe('Monday calculation', () => {
  it('counts 4 working days Mon->Fri due Fri', () => {
    const now = new Date('2026-07-13T10:00:00'); // Monday
    const due = '2026-07-17'; // Friday
    const result = getOrderDelay(
      order({ targetEndDate: due }),
      COLOURWAYS('order-1', 100),
      [],
      now,
      WORKING_DAYS,
    );
    // tomorrow (Tue Jul 14) through Fri Jul 17 = 4 working days
    expect(result.remainingWorkingDays).toBe(4);
  });
});

describe('days_late exception', () => {
  it('returns days_late when due date has passed and incomplete', () => {
    const now = new Date('2026-07-13T10:00:00'); // Monday
    const due = '2026-07-10'; // Friday — 3 days ago
    const result = getOrderDelay(
      order({ targetEndDate: due }),
      COLOURWAYS('order-1', 100),
      [],
      now,
      WORKING_DAYS,
    );
    expect(result.exception).toBe('days_late');
    expect(result.exceptionMessage).toBe('3 days late');
    expect(result.daysLate).toBe(3);
  });

  it('shows singular "day" when 1 day late', () => {
    const now = new Date('2026-07-14T10:00:00'); // Tuesday
    const due = '2026-07-13'; // Monday — 1 day ago
    const result = getOrderDelay(
      order({ targetEndDate: due }),
      COLOURWAYS('order-1', 100),
      [],
      now,
      WORKING_DAYS,
    );
    expect(result.exception).toBe('days_late');
    expect(result.exceptionMessage).toBe('1 day late');
  });
});

describe('due_today exception', () => {
  it('returns due_today when due date is today and incomplete', () => {
    const now = new Date('2026-07-13T10:00:00');
    const due = '2026-07-13';
    const result = getOrderDelay(
      order({ targetEndDate: due }),
      COLOURWAYS('order-1', 10),
      [],
      now,
      WORKING_DAYS,
    );
    expect(result.exception).toBe('due_today');
    expect(result.exceptionMessage).toBe('Due today');
  });
});

describe('no_output exception', () => {
  it('returns no_output when due within 7 working days and comparison day has zero output', () => {
    // Today Mon Jul 13, due Tue Jul 14 (1 working day away)
    const now = new Date('2026-07-13T10:00:00'); // before 17:00
    const due = '2026-07-14'; // Tuesday
    const result = getOrderDelay(
      order({ targetEndDate: due }),
      COLOURWAYS('order-1', 10),
      [],
      now,
      WORKING_DAYS,
    );
    // Before 17:00, comparison is previous working day = Sat Jul 11, which has 0 output
    expect(result.exception).toBe('no_output');
    expect(result.exceptionMessage).toBe('No output logged today');
  });

  it('does NOT return no_output when there IS output on comparison day', () => {
    const now = new Date('2026-07-13T10:00:00');
    const due = '2026-07-14';
    const entries = [{ orderId: 'order-1', outputQty: 10, date: '2026-07-11' }]; // Sat — previous working day
    const result = getOrderDelay(
      order({ targetEndDate: due }),
      COLOURWAYS('order-1', 10),
      entries,
      now,
      WORKING_DAYS,
    );
    expect(result.exception).not.toBe('no_output');
  });

  it('returns no_output when after 17:00 and today has zero output', () => {
    const now = new Date('2026-07-13T18:00:00'); // after 17:00
    const due = '2026-07-14'; // Tuesday
    const result = getOrderDelay(
      order({ targetEndDate: due }),
      COLOURWAYS('order-1', 10),
      [],
      now,
      WORKING_DAYS,
    );
    // After 17:00, comparison is today (Mon Jul 13), which has 0 output
    expect(result.exception).toBe('no_output');
  });

  it('does NOT return no_output when due further than 7 working days', () => {
    const now = new Date('2026-07-13T10:00:00');
    const due = '2026-07-25'; // 10 working days away (Sat Jul 25)
    const result = getOrderDelay(
      order({ targetEndDate: due }),
      COLOURWAYS('order-1', 100),
      [],
      now,
      WORKING_DAYS,
    );
    // More than 7 working days away — no no_output exception
    expect(result.exception).not.toBe('no_output');
  });
});

describe('below_target exception', () => {
  it('returns below_target when actual output is below required daily', () => {
    const now = new Date('2026-07-13T10:00:00'); // Monday
    const due = '2026-07-17'; // Friday (4 working days)
    // Required: 100 units / 4 = 25/day. Actual on Sat Jul 11 (prev working day): 5
    const entries = [{ orderId: 'order-1', outputQty: 5, date: '2026-07-11' }];
    const result = getOrderDelay(
      order({ targetEndDate: due }),
      COLOURWAYS('order-1', 100),
      entries,
      now,
      WORKING_DAYS,
    );
    expect(result.exception).toBe('below_target');
    expect(result.exceptionMessage).toBe('Line is below required daily output');
  });

  it('does NOT return below_target when actual meets or exceeds required', () => {
    const now = new Date('2026-07-13T10:00:00');
    const due = '2026-07-17';
    const entries = [{ orderId: 'order-1', outputQty: 30, date: '2026-07-11' }];
    const result = getOrderDelay(
      order({ targetEndDate: due }),
      COLOURWAYS('order-1', 100),
      entries,
      now,
      WORKING_DAYS,
    );
    expect(result.exception).toBeNull();
  });
});

describe('completed/cancelled exclusion', () => {
  it('returns null exception for Completed orders', () => {
    const now = new Date('2026-07-13T10:00:00');
    const result = getOrderDelay(
      order({ status: 'Completed', targetEndDate: '2026-07-10' }),
      COLOURWAYS('order-1', 100),
      [],
      now,
      WORKING_DAYS,
    );
    expect(result.exception).toBeNull();
    expect(result.remainingQty).toBe(0);
  });

  it('returns null exception for Cancelled orders', () => {
    const now = new Date('2026-07-13T10:00:00');
    const result = getOrderDelay(
      order({ status: 'Cancelled' }),
      COLOURWAYS('order-1', 100),
      [],
      now,
      WORKING_DAYS,
    );
    expect(result.exception).toBeNull();
    expect(result.remainingQty).toBe(0);
  });

  it('returns null exception for Shipped orders', () => {
    const now = new Date('2026-07-13T10:00:00');
    const result = getOrderDelay(
      order({ status: 'Shipped' }),
      COLOURWAYS('order-1', 100),
      [],
      now,
      WORKING_DAYS,
    );
    expect(result.exception).toBeNull();
  });
});

describe('complete orders show no exception', () => {
  it('returns null exception when produced qty meets ordered qty', () => {
    const now = new Date('2026-07-13T10:00:00');
    const entries = [{ orderId: 'order-1', outputQty: 100, date: '2026-07-11' }];
    const result = getOrderDelay(
      order({ targetEndDate: '2026-07-10' }),
      COLOURWAYS('order-1', 100),
      entries,
      now,
      WORKING_DAYS,
    );
    expect(result.exception).toBeNull();
    expect(result.remainingQty).toBe(0);
  });
});

describe('pre-17:00 comparison day', () => {
  it('uses previous working day before 17:00', () => {
    const now = new Date('2026-07-13T10:00:00'); // Monday morning
    const entries = [
      { orderId: 'order-1', outputQty: 50, date: '2026-07-11' }, // Saturday
      { orderId: 'order-1', outputQty: 10, date: '2026-07-13' }, // Monday (today)
    ];
    const result = getOrderDelay(
      order({ targetEndDate: '2026-07-20' }),
      COLOURWAYS('order-1', 500),
      entries,
      now,
      WORKING_DAYS,
    );
    // Before 17:00 → compare vs previous working day (Sat Jul 11) → 50
    expect(result.actualDailyOutput).toBe(50);
  });

  it('uses today after 17:00', () => {
    const now = new Date('2026-07-13T18:00:00'); // Monday evening
    const entries = [
      { orderId: 'order-1', outputQty: 50, date: '2026-07-11' }, // Saturday
      { orderId: 'order-1', outputQty: 10, date: '2026-07-13' }, // Monday (today)
    ];
    const result = getOrderDelay(
      order({ targetEndDate: '2026-07-20' }),
      COLOURWAYS('order-1', 500),
      entries,
      now,
      WORKING_DAYS,
    );
    // After 17:00 → compare vs today (Mon Jul 13) → 10
    expect(result.actualDailyOutput).toBe(10);
  });
});

describe('no due date', () => {
  it('returns remaining qty but no exception when no due date', () => {
    const now = new Date('2026-07-13T10:00:00');
    const result = getOrderDelay(
      order({ targetEndDate: null, buyerDeliveryDate: null }),
      COLOURWAYS('order-1', 100),
      [],
      now,
      WORKING_DAYS,
    );
    expect(result.exception).toBeNull();
    expect(result.remainingQty).toBe(100);
    expect(result.dueDate).toBeNull();
  });
});
