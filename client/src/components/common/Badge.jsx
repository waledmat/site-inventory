const colors = {
  pending: 'bg-yellow-100 text-yellow-800',
  issued: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  escalated: 'bg-orange-100 text-orange-800',
  returned: 'bg-green-100 text-green-800',
  partial: 'bg-purple-100 text-purple-800',
  good: 'bg-green-100 text-green-800',
  damaged: 'bg-orange-100 text-orange-800',
  lost: 'bg-red-100 text-red-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-700',
  admin: 'bg-indigo-100 text-indigo-800',
  storekeeper: 'bg-blue-100 text-blue-800',
  requester: 'bg-teal-100 text-teal-800',
  superuser: 'bg-purple-100 text-purple-800',
  coordinator: 'bg-pink-100 text-pink-800',
};

export default function Badge({ value, label }) {
  const key = (value || '').toLowerCase();
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${colors[key] || 'bg-gray-100 text-gray-700'}`}>
      {label || value}
    </span>
  );
}
