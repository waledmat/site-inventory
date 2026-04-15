import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navByRole = {
  admin: [
    { path: '/admin', label: '🏠 Dashboard' },
    { path: '/admin/users', label: '👥 Users' },
    { path: '/admin/projects', label: '🏗️ Projects' },
    { path: '/admin/stock-adjustment', label: '📦 Stock Adjustment' },
    { path: '/admin/audit-log', label: '📋 Audit Log' },
    { path: '/admin/settings', label: '⚙️ Settings' },
  ],
  requester: [
    { path: '/requester', label: '🏠 Dashboard' },
    { path: '/requester/submit', label: '📝 New Request' },
    { path: '/requester/requests', label: '📋 My Requests' },
    { path: '/requester/stock', label: '🔍 Browse Stock' },
    { path: '/requester/deliveries', label: '📦 My Deliveries' },
  ],
  coordinator: [
    { path: '/coordinator', label: '🏠 Dashboard' },
    { path: '/coordinator/escalations', label: '🚨 Escalations' },
  ],
  storekeeper: [
    { path: '/storekeeper', label: '🏠 Dashboard' },
    { path: '/storekeeper/incoming', label: '📥 Incoming Requests' },
    { path: '/storekeeper/delivery-notes', label: '📋 Delivery Notes' },
    { path: '/storekeeper/returns', label: '📤 Returns' },
    { path: '/storekeeper/stock', label: '🔍 Stock Search' },
  ],
  superuser: [
    { path: '/superuser', label: '🏠 Dashboard' },
    { path: '/superuser/projects', label: '🏗️ Projects' },
    { path: '/superuser/upload', label: '📂 Upload Packing List' },
    { path: '/superuser/reports', label: '📊 Reports' },
    { path: '/superuser/daily-log', label: '📅 Daily Log' },
    { path: '/superuser/audit-log', label: '📋 Audit Log' },
    { path: '/superuser/item-labels', label: '🏷️ Item Labels' },
  ],
  warehouse_manager: [
    { path: '/wm', label: '🏠 Dashboard' },
    { path: '/wm/suppliers', label: '🏭 Suppliers' },
    { path: '/wm/items', label: '📦 Item Master' },
    { path: '/wm/locations', label: '🗂️ Locations' },
    { path: '/wm/po', label: '📋 Purchase Orders' },
    { path: '/wm/grn', label: '📥 Receive (GRN)' },
    { path: '/wm/putaway', label: '🔀 Putaway Tasks' },
    { path: '/wm/inventory', label: '📊 Inventory' },
    { path: '/wm/dispatch', label: '🚚 Dispatch Orders' },
    { path: '/wm/cyclecount', label: '🔄 Cycle Counting' },
    { path: '/wm/reports', label: '📈 Reports' },
  ],
  receiver: [
    { path: '/wm', label: '🏠 Dashboard' },
    { path: '/wm/grn', label: '📥 Receive (GRN)' },
    { path: '/wm/putaway', label: '🔀 Putaway Tasks' },
    { path: '/wm/inventory', label: '📊 Inventory' },
    { path: '/wm/cyclecount', label: '🔄 Cycle Counting' },
    { path: '/wm/reports', label: '📈 Reports' },
  ],
  picker: [
    { path: '/wm', label: '🏠 Dashboard' },
    { path: '/wm/putaway', label: '🔀 Putaway Tasks' },
    { path: '/wm/inventory', label: '📊 Inventory' },
    { path: '/wm/dispatch', label: '🚚 Dispatch Orders' },
    { path: '/wm/cyclecount', label: '🔄 Cycle Counting' },
    { path: '/wm/reports', label: '📈 Reports' },
  ],
};

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = navByRole[user?.role] || [];

  const handleLogout = () => { logout(); navigate('/login'); };

  const rootByRole = { warehouse_manager: '/wm', receiver: '/wm', picker: '/wm' };
  const roleRoot = rootByRole[user?.role] || `/${user?.role}`;

  const isActive = (path) => {
    if (path === roleRoot) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const NavLinks = () => (
    <>
      {nav.map(item => (
        <Link
          key={item.path}
          to={item.path}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
            ${isActive(item.path)
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
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 min-h-screen shrink-0">
        <div className="p-5 border-b flex items-center gap-3">
          <img src="/favicon.svg" alt="logo" className="w-9 h-9 shrink-0" />
          <h1 className="font-bold text-blue-700 text-sm leading-tight">Site Inventory<br/>Management System</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto"><NavLinks /></nav>
        <div className="p-4 border-t">
          <p className="text-xs font-medium text-gray-700 truncate">{user?.name}</p>
          <p className="text-xs text-gray-400 capitalize mb-3">{user?.role?.replace('_',' ')}</p>
          <Link to="/modules" className="w-full text-xs text-blue-500 hover:text-blue-700 text-left py-1 block mb-1">
            ⬡ Module Selector
          </Link>
          <button onClick={handleLogout} className="w-full text-xs text-red-500 hover:text-red-700 text-left py-1">
            Sign out →
          </button>
        </div>
      </aside>

      {/* Top bar — mobile */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-white border-b px-4 py-3 shadow-sm">
        <h1 className="font-bold text-blue-700 text-sm">SIMS</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 capitalize hidden sm:block">{user?.role}</span>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-gray-600 text-xl p-1 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Open menu"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b bg-blue-700">
              <h1 className="font-bold text-white text-sm">Site Inventory System</h1>
              <p className="text-blue-200 text-xs mt-1 capitalize">{user?.name} · {user?.role}</p>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              <NavLinks />
            </nav>
            <div className="p-4 border-t">
              <button onClick={handleLogout} className="w-full text-sm text-red-500 hover:text-red-700 text-left py-2 px-4 rounded-lg hover:bg-red-50">
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
