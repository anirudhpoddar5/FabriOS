export type DelayExceptionType =
  | 'days_late'
  | 'no_output'
  | 'below_target'
  | 'due_today'
  | null;

export interface OrderDelayResult {
  exception: DelayExceptionType;
  exceptionMessage: string | null;
  dueDate: string | null;
  remainingQty: number;
  remainingWorkingDays: number;
  requiredDailyOutput: number;
  actualDailyOutput: number;
  daysLate: number | null;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function getPreviousWorkingDay(dateStr: string, workingDays: number[]): string {
  let d = addDays(dateStr, -1);
  while (!workingDays.includes(new Date(d).getDay())) {
    d = addDays(d, -1);
  }
  return d;
}

function countWorkingDays(fromInc: string, toInc: string, workingDays: number[]): number {
  let count = 0;
  let d = new Date(fromInc);
  const end = new Date(toInc);
  while (d <= end) {
    if (workingDays.includes(d.getDay())) {
      count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export function getOrderDelay(
  order: {
    id: string;
    status: string;
    targetEndDate?: string;
    buyerDeliveryDate?: string;
  },
  colourways: { orderId: string; orderedQty: number }[],
  entries: { orderId: string; outputQty: number; date: string }[],
  now: Date,
  workingDays: number[],
): OrderDelayResult {
  const today = now.toISOString().slice(0, 10);
  const currentHour = now.getHours();
  const dueDate = order.targetEndDate || order.buyerDeliveryDate || null;

  if (order.status === 'Cancelled' || order.status === 'Completed' || order.status === 'Shipped') {
    return {
      exception: null,
      exceptionMessage: null,
      dueDate,
      remainingQty: 0,
      remainingWorkingDays: 0,
      requiredDailyOutput: 0,
      actualDailyOutput: 0,
      daysLate: null,
    };
  }

  const colourwayQty = colourways
    .filter(c => c.orderId === order.id)
    .reduce((s, c) => s + (c.orderedQty || 0), 0);
  const orderedQty = colourwayQty > 0 ? colourwayQty : (order as any).orderQty || 0;

  const producedQty = entries
    .filter(e => e.orderId === order.id)
    .reduce((s, e) => s + (e.outputQty || 0), 0);

  const remainingQty = Math.max(orderedQty - producedQty, 0);
  const incomplete = remainingQty > 0;

  if (!incomplete) {
    return {
      exception: null,
      exceptionMessage: null,
      dueDate,
      remainingQty: 0,
      remainingWorkingDays: 0,
      requiredDailyOutput: 0,
      actualDailyOutput: 0,
      daysLate: null,
    };
  }

  const comparisonDay = currentHour < 17
    ? getPreviousWorkingDay(today, workingDays)
    : today;

  const dailyActualOutput = entries
    .filter(e => e.orderId === order.id && e.date === comparisonDay)
    .reduce((s, e) => s + (e.outputQty || 0), 0);

  const daysLate = dueDate ? Math.max(daysBetween(today, dueDate), 0) : null;

  if (dueDate && daysLate !== null && daysLate > 0) {
    return {
      exception: 'days_late',
      exceptionMessage: `${daysLate} day${daysLate === 1 ? '' : 's'} late`,
      dueDate,
      remainingQty,
      remainingWorkingDays: 0,
      requiredDailyOutput: 0,
      actualDailyOutput: dailyActualOutput,
      daysLate,
    };
  }

  if (dueDate) {
    const workingDaysUntilDue = dueDate >= today
      ? countWorkingDays(addDays(today, 1), dueDate, workingDays)
      : 0;
    const requiredDailyOutput = workingDaysUntilDue > 0
      ? remainingQty / workingDaysUntilDue
      : 0;

    if (dueDate === today) {
      return {
        exception: 'due_today',
        exceptionMessage: 'Due today',
        dueDate,
        remainingQty,
        remainingWorkingDays: workingDaysUntilDue,
        requiredDailyOutput,
        actualDailyOutput: dailyActualOutput,
        daysLate: null,
      };
    }

    const dueWithinSevenWorkingDays = workingDaysUntilDue <= 7 && workingDaysUntilDue > 0;

    if (dueWithinSevenWorkingDays && dailyActualOutput === 0) {
      return {
        exception: 'no_output',
        exceptionMessage: 'No output logged today',
        dueDate,
        remainingQty,
        remainingWorkingDays: workingDaysUntilDue,
        requiredDailyOutput,
        actualDailyOutput: 0,
        daysLate: null,
      };
    }

    if (dailyActualOutput < requiredDailyOutput) {
      return {
        exception: 'below_target',
        exceptionMessage: 'Line is below required daily output',
        dueDate,
        remainingQty,
        remainingWorkingDays: workingDaysUntilDue,
        requiredDailyOutput,
        actualDailyOutput: dailyActualOutput,
        daysLate: null,
      };
    }

    return {
      exception: null,
      exceptionMessage: null,
      dueDate,
      remainingQty,
      remainingWorkingDays: workingDaysUntilDue,
      requiredDailyOutput,
      actualDailyOutput: dailyActualOutput,
      daysLate: null,
    };
  }

  return {
    exception: null,
    exceptionMessage: null,
    dueDate: null,
    remainingQty,
    remainingWorkingDays: 0,
    requiredDailyOutput: 0,
    actualDailyOutput: dailyActualOutput,
    daysLate: null,
  };
}
