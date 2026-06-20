export interface OrderBadge {
  label: string;
  className: string;
}

export function getOrderBadge(
  status: string,
  entryCount: number,
  targetEndDate?: string
): OrderBadge {
  const today = new Date().toISOString().slice(0, 10);
  const isPastDue = !!targetEndDate && targetEndDate < today;

  switch (status) {
    case 'Cancelled':
      return { label: 'Cancelled', className: 'bg-slate-100 text-slate-400 border-slate-200' };
    case 'Shipped':
      return { label: 'Shipped', className: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'Completed':
      return { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'Started':
    default:
      if (entryCount === 0) {
        if (isPastDue) return { label: 'Delayed', className: 'bg-red-50 text-red-700 border-red-200' };
        return { label: 'Not Started', className: 'bg-gray-50 text-gray-500 border-gray-200' };
      }
      if (isPastDue) return { label: 'Delayed', className: 'bg-red-50 text-red-700 border-red-200' };
      if (targetEndDate) return { label: 'WIP', className: 'bg-amber-50 text-amber-700 border-amber-200' };
      return { label: 'On-time', className: 'bg-green-50 text-green-700 border-green-200' };
  }
}
