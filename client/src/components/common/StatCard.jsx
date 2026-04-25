import { Link } from 'react-router-dom';

export default function StatCard({ title, value, color = 'blue', icon, to, onClick }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };
  const interactive = (to || onClick)
    ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition'
    : '';
  const baseClass = `rounded-xl border p-4 ${colors[color]} ${interactive}`;

  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium opacity-80">{title}</p>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <p className="text-3xl font-bold mt-1">{value ?? '—'}</p>
    </>
  );

  if (to) {
    return <Link to={to} className={`block ${baseClass}`}>{body}</Link>;
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`text-left w-full ${baseClass}`}>
        {body}
      </button>
    );
  }
  return <div className={baseClass}>{body}</div>;
}
