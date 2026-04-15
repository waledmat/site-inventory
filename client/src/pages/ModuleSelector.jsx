import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const WMS_ROLES  = new Set(['warehouse_manager', 'receiver', 'picker', 'admin', 'superuser']);
const SITE_ROLES = new Set(['admin', 'storekeeper', 'requester', 'coordinator', 'superuser']);

const ROLE_WMS_HOME = {
  warehouse_manager: '/wm', receiver: '/wm', picker: '/wm',
  admin: '/wm', superuser: '/wm',
};
const ROLE_SITE_HOME = {
  admin: '/admin', storekeeper: '/storekeeper', requester: '/requester',
  coordinator: '/coordinator', superuser: '/superuser',
};

export default function ModuleSelector() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const canWMS  = WMS_ROLES.has(user.role);
  const canSite = SITE_ROLES.has(user.role);

  const ModuleCard = ({ to, allowed, icon, title, description, tags, tagClass, cta, ctaClass, borderHover }) => {
    const inner = (
      <>
        <div className="text-5xl mb-5">{icon}</div>
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-2xl font-bold text-white">{title}</h3>
          {!allowed && (
            <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full border border-white/20">
              🔒 No Access
            </span>
          )}
        </div>
        <p className={`text-sm leading-relaxed mb-6 ${allowed ? 'text-blue-200' : 'text-white/30'}`}>
          {description}
        </p>
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <span key={tag} className={`text-xs px-2.5 py-1 rounded-full ${allowed ? tagClass : 'bg-white/5 text-white/20'}`}>
              {tag}
            </span>
          ))}
        </div>
        <div className={`mt-6 flex items-center text-sm font-medium transition-colors ${allowed ? ctaClass : 'text-white/20'}`}>
          {allowed ? cta : 'Contact admin for access'}
        </div>
      </>
    );

    if (!allowed) {
      return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 opacity-60 cursor-not-allowed">
          {inner}
        </div>
      );
    }

    return (
      <Link to={to}
        className={`group bg-white/10 hover:bg-white/20 border border-white/20 ${borderHover} rounded-2xl p-8 transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl`}>
        {inner}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5">
        <div>
          <h1 className="text-white font-bold text-lg">SIMS Platform</h1>
          <p className="text-blue-300 text-xs">Site Inventory & Warehouse Management</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-white text-sm font-medium">{user.name}</p>
            <p className="text-blue-300 text-xs capitalize">{user.role.replace('_', ' ')}</p>
          </div>
          <button onClick={logout}
            className="text-blue-300 hover:text-white text-xs border border-blue-700 hover:border-white px-3 py-1.5 rounded-lg transition-colors">
            Sign out
          </button>
        </div>
      </div>

      {/* Module Cards */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-2">Select a Module</h2>
            <p className="text-blue-300">Choose the system you want to work in</p>
          </div>

          <div className="grid grid-cols-1 gap-6 max-w-lg mx-auto w-full">
            <ModuleCard
              to={ROLE_SITE_HOME[user.role] || '/requester'}
              allowed={canSite}
              icon="🏗️"
              title="Site Inventory"
              description="Manage construction site materials — stock tracking, material requests, issue workflows, delivery notes, and project reports."
              tags={['Stock', 'Requests', 'Issues', 'Returns', 'Delivery Notes', 'Reports']}
              tagClass="bg-emerald-500/30 text-emerald-200"
              cta="Enter Site Inventory →"
              ctaClass="text-emerald-300 group-hover:text-white"
              borderHover="hover:border-emerald-400"
            />

            {/* Admin panel shortcut */}
            {user.role === 'admin' && (
              <Link to="/admin"
                className="group md:col-span-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-slate-400 rounded-2xl p-6 transition-all duration-200 flex items-center gap-4">
                <div className="text-3xl">⚙️</div>
                <div>
                  <h3 className="text-lg font-bold text-white">Admin Panel</h3>
                  <p className="text-blue-300 text-sm">User management, projects, settings, audit log</p>
                </div>
                <div className="ml-auto text-slate-400 group-hover:text-white text-sm font-medium">→</div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
