import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navByRole = {
  admin: [
    { path: '/admin', label: '🏠 Dashboard' },
    { path: '/admin/users', label: '👥 Users' },
    { path: '/admin/projects', label: '🏗️ Projects' },
    { path: '/admin/settings', label: '⚙️ Settings' },
  ],
  requester: [
    { path: '/requester', label: '🏠 Dashboard' },
    { path: '/requester/submit', label: '📝 New Request' },
    { path: '/requester/requests', label: '📋 My Requests' },
  ],
  coordinator: [
    { path: '/coordinator', label: '🏠 Dashboard' },
    { path: '/coordinator/escalations', label: '🚨 Escalations' },
  ],
  storekeeper: [
    { path: '/storekeeper', label: '🏠 Dashboard' },
    { path: '/storekeeper/incoming', label: '📥 Incoming Requests' },
    { path: '/storekeeper/returns', label: '📤 Returns' },
    { path: '/storekeeper/stock', label: '🔍 Stock Search' },
  ],
  superuser: [
    { path: '/superuser', label: '🏠 Dashboard' },
    { path: '/superuser/projects', label: '🏗️ Projects' },
    { path: '/superuser/upload', label: '📂 Upload Packing List' },
    { path: '/superuser/reports', label: '📊 Reports' },
    { path: '/superuser/daily-log', label: '📅 Daily Log' },
  ],
};

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = navByRole[user?.role] || [];

  const handleLogout = () => { logout(); navigate('/login'); };

  const NavLinks = () => (
    <>
      {nav.map(item => (
        <Link
          key={item.path}
          to={item.path}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
            ${location.pathname === item.path
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'}`}
        >
          {item.label}
        </Link>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 min-h-screen">
        <div className="p-5 border-b">
          <h1 className="font-bold text-blue-700 text-sm leading-tight">Site Inventory<br/>Management System</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1"><NavLinks /></nav>
        <div className="p-4 border-t">
          <p className="text-xs text-gray-500 mb-1">{user?.name}</p>
          <p className="text-xs text-gray-400 capitalize mb-3">{user?.role}</p>
          <button onClick={handleLogout} className="w-full text-xs text-red-500 hover:text-red-700 text-left">Sign out</button>
        </div>
      </aside>

      {/* Top bar — mobile */}
      <div className="lg:hidden flex items-center justify-between bg-white border-b px-4 py-3">
        <h1 className="font-bold text-blue-700 text-sm">SIMS</h1>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-gray-600 text-xl">☰</button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMobileOpen(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white p-4 space-y-1" onClick={e => e.stopPropagation()}>
            <NavLinks />
            <button onClick={handleLogout} className="w-full text-left text-sm text-red-500 px-4 py-2 mt-4">Sign out</button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 p-4 lg:p-8 overflow-auto">{children}</main>
    </div>
  );
}
