// Shared status badge color classes used across WMS pages

export const STATUS_COLORS = {
  // Generic
  active:    'bg-green-100 text-green-700',
  inactive:  'bg-gray-100 text-gray-500',

  // PO / GRN / Dispatch status
  draft:      'bg-gray-100 text-gray-700',
  sent:       'bg-blue-100 text-blue-700',
  partial:    'bg-yellow-100 text-yellow-700',
  received:   'bg-green-100 text-green-700',
  confirmed:  'bg-green-100 text-green-700',
  dispatched: 'bg-purple-100 text-purple-700',
  cancelled:  'bg-red-100 text-red-700',

  // Cycle count
  open:      'bg-gray-100 text-gray-700',
  counting:  'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',

  // Putaway
  pending:   'bg-yellow-100 text-yellow-700',

  // Condition
  good:       'bg-green-100 text-green-700',
  damaged:    'bg-red-100 text-red-700',
  quarantine: 'bg-yellow-100 text-yellow-700',
};

export function statusClass(value) {
  return STATUS_COLORS[value] ?? 'bg-gray-100 text-gray-600';
}
