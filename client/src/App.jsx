import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppShell from './components/layout/AppShell';

// Auth
import LoginPage from './pages/auth/LoginPage';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import ProjectManagement from './pages/admin/ProjectManagement';
import SystemSettings from './pages/admin/SystemSettings';
import AuditLog from './pages/admin/AuditLog';
import StockAdjustment from './pages/admin/StockAdjustment';

// Requester
import RequesterDashboard from './pages/requester/RequesterDashboard';
import SubmitRequest from './pages/requester/SubmitRequest';
import MyRequests from './pages/requester/MyRequests';
import MyDeliveries from './pages/requester/MyDeliveries';
import StockBrowse from './pages/requester/StockBrowse';

// Coordinator
import CoordinatorDashboard from './pages/coordinator/CoordinatorDashboard';

// Storekeeper
import StorekeeperDashboard from './pages/storekeeper/StorekeeperDashboard';
import IncomingRequests from './pages/storekeeper/IncomingRequests';
import IssueMaterial from './pages/storekeeper/IssueMaterial';
import PendingReturns from './pages/storekeeper/PendingReturns';
import StockSearch from './pages/storekeeper/StockSearch';
import DeliveryNotes from './pages/storekeeper/DeliveryNotes';

// Super User
import SuperUserDashboard from './pages/superuser/SuperUserDashboard';
import UploadPackingList from './pages/superuser/UploadPackingList';
import Reports from './pages/superuser/Reports';
import DailyReportLog from './pages/superuser/DailyReportLog';
import SuperuserProjects from './pages/admin/ProjectManagement';
import ItemLabels from './pages/superuser/ItemLabels';

const SITE_HOME = {
  admin: '/admin',
  superuser: '/superuser',
  storekeeper: '/storekeeper',
  requester: '/requester',
  coordinator: '/coordinator',
  // WMS roles hidden — redirect to login
  warehouse_manager: '/login',
  receiver: '/login',
  picker: '/login',
};

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const home = SITE_HOME[user.role];
  if (home) return <Navigate to={home} replace />;
  return <Navigate to="/login" replace />;
}

function Shell({ children }) {
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><RoleRedirect /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><Shell><AdminDashboard /></Shell></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><Shell><UserManagement /></Shell></ProtectedRoute>} />
          <Route path="/admin/projects" element={<ProtectedRoute roles={['admin']}><Shell><ProjectManagement /></Shell></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']}><Shell><SystemSettings /></Shell></ProtectedRoute>} />
          <Route path="/admin/audit-log" element={<ProtectedRoute roles={['admin']}><Shell><AuditLog /></Shell></ProtectedRoute>} />
          <Route path="/admin/stock-adjustment" element={<ProtectedRoute roles={['admin']}><Shell><StockAdjustment /></Shell></ProtectedRoute>} />

          {/* Requester */}
          <Route path="/requester" element={<ProtectedRoute roles={['requester']}><Shell><RequesterDashboard /></Shell></ProtectedRoute>} />
          <Route path="/requester/submit" element={<ProtectedRoute roles={['requester']}><Shell><SubmitRequest /></Shell></ProtectedRoute>} />
          <Route path="/requester/requests" element={<ProtectedRoute roles={['requester']}><Shell><MyRequests /></Shell></ProtectedRoute>} />
          <Route path="/requester/stock" element={<ProtectedRoute roles={['requester']}><Shell><StockBrowse /></Shell></ProtectedRoute>} />
          <Route path="/requester/deliveries" element={<ProtectedRoute roles={['requester']}><Shell><MyDeliveries /></Shell></ProtectedRoute>} />

          {/* Coordinator */}
          <Route path="/coordinator" element={<ProtectedRoute roles={['coordinator']}><Shell><CoordinatorDashboard /></Shell></ProtectedRoute>} />
          <Route path="/coordinator/escalations" element={<ProtectedRoute roles={['coordinator']}><Shell><CoordinatorDashboard /></Shell></ProtectedRoute>} />

          {/* Storekeeper */}
          <Route path="/storekeeper" element={<ProtectedRoute roles={['storekeeper']}><Shell><StorekeeperDashboard /></Shell></ProtectedRoute>} />
          <Route path="/storekeeper/incoming" element={<ProtectedRoute roles={['storekeeper']}><Shell><IncomingRequests /></Shell></ProtectedRoute>} />
          <Route path="/storekeeper/issue/:requestId" element={<ProtectedRoute roles={['storekeeper']}><Shell><IssueMaterial /></Shell></ProtectedRoute>} />
          <Route path="/storekeeper/returns" element={<ProtectedRoute roles={['storekeeper']}><Shell><PendingReturns /></Shell></ProtectedRoute>} />
          <Route path="/storekeeper/delivery-notes" element={<ProtectedRoute roles={['storekeeper']}><Shell><DeliveryNotes /></Shell></ProtectedRoute>} />
          <Route path="/storekeeper/stock" element={<ProtectedRoute roles={['storekeeper']}><Shell><StockSearch /></Shell></ProtectedRoute>} />

          {/* Super User */}
          <Route path="/superuser" element={<ProtectedRoute roles={['superuser']}><Shell><SuperUserDashboard /></Shell></ProtectedRoute>} />
          <Route path="/superuser/projects" element={<ProtectedRoute roles={['superuser']}><Shell><SuperuserProjects /></Shell></ProtectedRoute>} />
          <Route path="/superuser/upload" element={<ProtectedRoute roles={['superuser']}><Shell><UploadPackingList /></Shell></ProtectedRoute>} />
          <Route path="/superuser/reports" element={<ProtectedRoute roles={['superuser']}><Shell><Reports /></Shell></ProtectedRoute>} />
          <Route path="/superuser/daily-log" element={<ProtectedRoute roles={['superuser']}><Shell><DailyReportLog /></Shell></ProtectedRoute>} />
          <Route path="/superuser/audit-log" element={<ProtectedRoute roles={['superuser']}><Shell><AuditLog /></Shell></ProtectedRoute>} />
          <Route path="/superuser/item-labels" element={<ProtectedRoute roles={['superuser']}><Shell><ItemLabels /></Shell></ProtectedRoute>} />

          {/* Warehouse Manager — hidden (routes disabled) */}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
