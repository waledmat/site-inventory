/**
 * Site Inventory Management System — Demo PDF Generator
 * Run: node server/scripts/generate-demo-pdf.js
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../../site-inventory-demo.pdf');
const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: 'Site Inventory Management System', Author: 'System Demo' } });
doc.pipe(fs.createWriteStream(OUT));

// ── Palette ────────────────────────────────────────────────────────────────
const C = {
  primary:   '#1d4ed8',
  accent:    '#0ea5e9',
  dark:      '#0f172a',
  mid:       '#334155',
  light:     '#64748b',
  muted:     '#94a3b8',
  bg:        '#f8fafc',
  white:     '#ffffff',
  green:     '#16a34a',
  orange:    '#ea580c',
  red:       '#dc2626',
  yellow:    '#d97706',
  purple:    '#7c3aed',
  border:    '#e2e8f0',
};

const W = 595.28; // A4 width
const H = 841.89; // A4 height
const M = 48;     // margin

// ── Helpers ────────────────────────────────────────────────────────────────
function rect(x, y, w, h, color, radius = 0) {
  doc.save().fillColor(color);
  if (radius) doc.roundedRect(x, y, w, h, radius).fill();
  else doc.rect(x, y, w, h).fill();
  doc.restore();
}

function text(str, x, y, opts = {}) {
  doc.save()
    .fillColor(opts.color || C.dark)
    .fontSize(opts.size || 11)
    .font(opts.bold ? 'Helvetica-Bold' : opts.italic ? 'Helvetica-Oblique' : 'Helvetica')
    .text(str, x, y, { width: opts.width || W - x - M, align: opts.align || 'left', lineGap: opts.lineGap || 0 })
    .restore();
}

function hline(y, color = C.border) {
  doc.save().strokeColor(color).lineWidth(0.5).moveTo(M, y).lineTo(W - M, y).stroke().restore();
}

function badge(label, x, y, bg, fg = C.white) {
  const pad = 6, fSize = 8.5;
  doc.fontSize(fSize).font('Helvetica-Bold');
  const tw = doc.widthOfString(label);
  rect(x, y - 2, tw + pad * 2, 16, bg, 4);
  text(label, x + pad, y, { color: fg, size: fSize, bold: true });
  return tw + pad * 2 + 6;
}

function pill(label, x, y, color) {
  return badge(label, x, y, color);
}

// ── PAGE 1 — Cover ─────────────────────────────────────────────────────────
function coverPage() {
  // Background gradient simulation (layered rects)
  rect(0, 0, W, H, C.dark);
  rect(0, 0, W, 480, C.primary);

  // Decorative circles
  doc.save().fillColor('#ffffff').opacity(0.04).circle(W - 60, 80, 180).fill().restore();
  doc.save().fillColor('#ffffff').opacity(0.03).circle(80, 400, 220).fill().restore();

  // Logo area
  rect(M, 60, 52, 52, C.white, 12);
  text('📦', M + 10, 70, { size: 28 });

  // Title block
  text('SITE INVENTORY', M + 64, 64, { color: C.white, size: 26, bold: true });
  text('Management System', M + 64, 94, { color: C.accent, size: 15 });

  // Version badge
  badge('v2.0  •  2026', M + 64, 120, C.accent + '33', C.white);

  // Hero text
  doc.save().fillColor(C.white).opacity(0.12).rect(M, 160, W - M * 2, 2).fill().restore();

  text('Complete Warehouse &', M, 185, { color: C.white, size: 34, bold: true });
  text('Material Control Platform', M, 225, { color: C.white, size: 34, bold: true });

  text(
    'A full-stack system for construction site material tracking — from packing list upload\nto material requests, issuance, returns, and delivery note generation.',
    M, 280, { color: '#cbd5e1', size: 12, lineGap: 4, width: W - M * 2 - 40 }
  );

  // Feature pills row
  const pills = ['Role-Based Access', 'PDF Delivery Notes', 'Excel Import', 'Real-Time KPIs', 'Audit Logging'];
  let px = M;
  pills.forEach(p => { px += pill(p, px, 340, C.accent + 'cc') + 4; });

  // Divider
  rect(M, 390, W - M * 2, 1.5, C.white + '22');

  // Stats row
  const stats = [['6', 'User Roles'], ['12+', 'UX Features'], ['5', 'Role Dashboards'], ['100%', 'Audit Trailed']];
  const sw = (W - M * 2) / stats.length;
  stats.forEach(([val, lbl], i) => {
    const sx = M + sw * i;
    text(val, sx, 410, { color: C.white, size: 28, bold: true, width: sw, align: 'center' });
    text(lbl, sx, 445, { color: C.muted, size: 9.5, width: sw, align: 'center' });
  });

  // Bottom card row
  const cards = [
    { icon: '🏗️', title: 'Projects',    desc: 'Multi-project stock tracking' },
    { icon: '📋', title: 'Requests',    desc: 'Approval workflow engine' },
    { icon: '🚚', title: 'Issuance',    desc: 'Issue & return tracking' },
    { icon: '📊', title: 'Analytics',  desc: 'KPIs and trend charts' },
  ];
  const cw = (W - M * 2 - 12) / 4;
  rect(0, H - 220, W, 220, '#0f172a');
  cards.forEach((c, i) => {
    const cx = M + (cw + 4) * i;
    rect(cx, H - 205, cw, 160, '#1e293b', 10);
    text(c.icon, cx + cw / 2 - 14, H - 185, { size: 24 });
    text(c.title, cx, H - 148, { color: C.white, size: 11, bold: true, width: cw, align: 'center' });
    text(c.desc, cx + 6, H - 132, { color: C.muted, size: 8.5, width: cw - 12, align: 'center', lineGap: 2 });
  });

  text('Confidential — Internal Use Only', 0, H - 22, { color: C.light, size: 8, align: 'center', width: W });
}

// ── PAGE 2 — System Architecture ──────────────────────────────────────────
function architecturePage() {
  doc.addPage();
  pageHeader('System Architecture', 'How the platform is built and connected');

  let y = 130;

  // Stack boxes
  const stacks = [
    { label: 'Frontend', color: C.accent,   items: ['React 19 + Vite', 'Tailwind CSS', 'React Router v7', 'Axios + JWT Auth', 'Recharts (Analytics)'] },
    { label: 'Backend',  color: C.primary,  items: ['Node.js + Express', 'JWT Auth Middleware', 'Role Guard (RBAC)', 'PDFKit (Delivery Notes)', 'XLSX (Excel Import)'] },
    { label: 'Database', color: C.purple,   items: ['PostgreSQL', 'Sequential Migrations', 'JSONB Permissions', 'UUID Primary Keys', 'Audit Log Tables'] },
  ];

  const bw = (W - M * 2 - 24) / 3;
  stacks.forEach((s, i) => {
    const bx = M + (bw + 12) * i;
    rect(bx, y, bw, 200, s.color + '15', 10);
    rect(bx, y, bw, 36, s.color, 10);
    rect(bx, y + 26, bw, 10, s.color); // flatten bottom of header
    text(s.label, bx, y + 10, { color: C.white, size: 13, bold: true, width: bw, align: 'center' });
    s.items.forEach((item, j) => {
      const iy = y + 46 + j * 28;
      rect(bx + 10, iy, bw - 20, 22, C.white, 5);
      doc.save().fillColor(s.color).circle(bx + 22, iy + 11, 4).fill().restore();
      text(item, bx + 30, iy + 6, { size: 9.5, color: C.mid });
    });
  });

  y += 220;

  // Data Flow section
  text('Key Data Flow', M, y, { size: 14, bold: true, color: C.dark });
  y += 24;
  hline(y); y += 14;

  const flows = [
    { step: '1', label: 'Upload Packing List', desc: 'Superuser uploads .xlsx → validated → confirmed → stock created', color: C.accent },
    { step: '2', label: 'Submit Request',      desc: 'Requester selects project + items → request sent for approval',     color: C.primary },
    { step: '3', label: 'Storekeeper Issues',  desc: 'Storekeeper reviews → issues stock → qty_on_hand decremented',      color: C.green },
    { step: '4', label: 'PDF Delivery Note',   desc: 'Auto-generated DN PDF attached to every material issue',            color: C.purple },
    { step: '5', label: 'Returns & Tracking',  desc: 'Returned qty tracked, pending returns visible on dashboard',        color: C.orange },
  ];

  flows.forEach((f, i) => {
    const fy = y + i * 46;
    rect(M, fy, 28, 28, f.color, 14);
    text(f.step, M, fy + 6, { color: C.white, size: 12, bold: true, width: 28, align: 'center' });
    text(f.label, M + 38, fy + 2, { size: 11, bold: true, color: C.dark });
    text(f.desc,  M + 38, fy + 16, { size: 9.5, color: C.light });
    if (i < flows.length - 1) {
      doc.save().strokeColor(f.color).lineWidth(1.5).dash(3, { space: 3 })
        .moveTo(M + 14, fy + 28).lineTo(M + 14, fy + 46).stroke().restore();
    }
  });

  pageFooter(2);
}

// ── PAGE 3 — Roles & Permissions ──────────────────────────────────────────
function rolesPage() {
  doc.addPage();
  pageHeader('Roles & Permissions', 'Six distinct roles with scoped access and configurable authority');

  const roles = [
    {
      role: 'Admin', color: C.red, icon: '👑',
      perms: ['Manage all users', 'Manage projects', 'Stock adjustment', 'Audit log access', 'System settings', 'KPI dashboard'],
    },
    {
      role: 'Superuser', color: C.purple, icon: '⚙️',
      perms: ['Upload packing lists', 'View all reports', 'Daily report log', 'Upload history', 'Analytics charts'],
    },
    {
      role: 'Storekeeper', color: C.primary, icon: '🏪',
      perms: ['Assigned projects only', 'Approve/reject requests', 'Issue materials', 'Manage returns', 'Delivery notes', 'Pending returns filter'],
    },
    {
      role: 'Requester', color: C.green, icon: '📝',
      perms: ['Submit material requests', 'View own requests', 'Filter + pagination', 'My Deliveries page', 'Low stock warnings', 'Request notes'],
    },
    {
      role: 'Coordinator', color: C.orange, icon: '🔀',
      perms: ['Resolve escalations', 'View escalation reason', 'See requester notes', 'Escalation KPI cards', 'Avg resolution time'],
    },
    {
      role: 'WM / Receiver', color: C.accent, icon: '🚚',
      perms: ['WMS module access', 'GRN receiving', 'Putaway tasks', 'Dispatch orders', 'Cycle counting', 'Item master'],
    },
  ];

  const rw = (W - M * 2 - 10) / 2;
  roles.forEach((r, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const rx = M + col * (rw + 10);
    const ry = 130 + row * 180;

    rect(rx, ry, rw, 165, C.bg, 10);
    rect(rx, ry, rw, 42, r.color, 10);
    rect(rx, ry + 32, rw, 10, r.color);

    // Icon circle
    rect(rx + 12, ry + 8, 28, 28, C.white + '33', 14);
    text(r.icon, rx + 12, ry + 12, { size: 14, width: 28, align: 'center' });
    text(r.role, rx + 48, ry + 14, { color: C.white, size: 13, bold: true });

    r.perms.forEach((p, j) => {
      const py = ry + 52 + j * 18;
      doc.save().fillColor(r.color).circle(rx + 20, py + 5, 3).fill().restore();
      text(p, rx + 30, py, { size: 9.5, color: C.mid });
    });
  });

  // Authority system note
  const ny = 680;
  rect(M, ny, W - M * 2, 70, C.primary + '10', 10);
  rect(M, ny, 4, 70, C.primary, 5);
  text('Customize Authority', M + 16, ny + 10, { size: 11, bold: true, color: C.primary });
  text(
    'Each user can be granted additional permissions beyond their role defaults. The admin opens the "Authority" modal, ' +
    'reviews the locked default permissions for the user\'s role, and toggles extra privileges individually. ' +
    'Permissions are stored as JSONB on the user record.',
    M + 16, ny + 28, { size: 9.5, color: C.mid, lineGap: 3, width: W - M * 2 - 30 }
  );

  pageFooter(3);
}

// ── PAGE 4 — Key Workflows ─────────────────────────────────────────────────
function workflowsPage() {
  doc.addPage();
  pageHeader('Key Workflows', 'End-to-end processes across roles');

  let y = 130;

  const workflows = [
    {
      title: 'Material Request → Issue → Return',
      color: C.primary,
      steps: [
        { role: 'Requester',    action: 'Submit Request',     detail: 'Selects project, adds items with qty. Low-stock badge shown if qty > on-hand.' },
        { role: 'Storekeeper',  action: 'Review Request',     detail: 'Sees request notes, approves or rejects with reason. Can escalate to coordinator.' },
        { role: 'Coordinator',  action: 'Handle Escalation',  detail: 'Sees both storekeeper rejection reason and requester escalation notes.' },
        { role: 'Storekeeper',  action: 'Issue Material',     detail: 'Issues items, stock qty_on_hand decremented, PDF delivery note auto-generated.' },
        { role: 'Requester',    action: 'View Delivery',      detail: 'My Deliveries page shows all DNs. Click row for item detail + PDF download.' },
        { role: 'Storekeeper',  action: 'Process Return',     detail: 'Returned qty tracked. Return status column shows Pending / Partial / Complete.' },
      ],
    },
    {
      title: 'Packing List Upload',
      color: C.purple,
      steps: [
        { role: 'Superuser', action: 'Download Template',  detail: 'Download .xlsx template with correct column headers pre-filled.' },
        { role: 'Superuser', action: 'Upload & Validate',  detail: 'Drag & drop .xlsx. System validates each row — shows valid count and error rows.' },
        { role: 'Superuser', action: 'Confirm Import',     detail: 'Valid rows upserted into stock_items (ON CONFLICT project+item_number). Upload logged.' },
        { role: 'Admin',     action: 'Configure Columns',  detail: 'System Settings: toggle which columns are active, rename headers, add custom fields.' },
      ],
    },
  ];

  workflows.forEach((wf, wi) => {
    rect(M, y, W - M * 2, 22, wf.color, 6);
    rect(M, y + 16, W - M * 2, 6, wf.color);
    text(wf.title, M + 12, y + 4, { color: C.white, size: 12, bold: true });

    wf.steps.forEach((s, si) => {
      const sy = y + 28 + si * 42;
      const roleColors = { Requester: C.green, Storekeeper: C.primary, Coordinator: C.orange, Superuser: C.purple, Admin: C.red };
      const rc = roleColors[s.role] || C.mid;
      rect(M, sy, W - M * 2, 38, si % 2 === 0 ? C.white : C.bg, 0);
      badge(s.role, M + 8, sy + 11, rc);
      const bw2 = doc.fontSize(8.5).widthOfString(s.role) + 18;
      text(s.action, M + 8 + bw2 + 8, sy + 10, { size: 10, bold: true, color: C.dark });
      text(s.detail, M + 8 + bw2 + 8, sy + 24, { size: 9, color: C.light, width: W - M * 2 - bw2 - 30 });
    });

    y += 28 + wf.steps.length * 42 + 20;
  });

  pageFooter(4);
}

// ── PAGE 5 — Dashboards & Analytics ──────────────────────────────────────
function dashboardsPage() {
  doc.addPage();
  pageHeader('Dashboards & Analytics', 'Role-specific insights and KPI tracking');

  let y = 130;

  // KPI Cards grid visual
  text('Admin Dashboard KPIs', M, y, { size: 13, bold: true });
  y += 20;

  const kpis = [
    { label: 'Total Users',          val: '24',  color: C.accent,   icon: '👥' },
    { label: 'Active Projects',      val: '8',   color: C.green,    icon: '🏗️' },
    { label: 'Pending Requests',     val: '3',   color: C.orange,   icon: '⏳' },
    { label: 'Issued This Month',    val: '147', color: C.primary,  icon: '📦' },
    { label: 'Low Stock Items',      val: '5',   color: C.red,      icon: '⚠️' },
    { label: 'Rejection Rate',       val: '8%',  color: C.yellow,   icon: '📉' },
    { label: 'Requests (7 days)',    val: '31',  color: C.purple,   icon: '📊' },
    { label: 'Top Item Issues',      val: 'CH-001', color: C.mid,   icon: '🔩' },
  ];

  const kw = (W - M * 2 - 21) / 4;
  kpis.forEach((k, i) => {
    const kx = M + (kw + 7) * (i % 4);
    const ky = y + Math.floor(i / 4) * 72;
    rect(kx, ky, kw, 62, C.white, 8);
    doc.save().strokeColor(C.border).lineWidth(0.5).roundedRect(kx, ky, kw, 62, 8).stroke().restore();
    rect(kx, ky, kw, 3, k.color, 8);
    rect(kx, ky + 3, kw, 2, k.color);
    text(k.icon, kx + 8, ky + 12, { size: 16 });
    text(k.val, kx + kw - 10, ky + 10, { size: 18, bold: true, color: k.color, align: 'right', width: kw - 15 });
    text(k.label, kx + 8, ky + 44, { size: 8, color: C.light, width: kw - 16 });
  });

  y += 160;

  // Chart placeholder (simulated bar chart)
  text('Issued vs Returned by Project  (Recharts BarChart)', M, y, { size: 13, bold: true });
  y += 20;

  const chartH = 120;
  rect(M, y, W - M * 2, chartH, C.bg, 8);
  doc.save().strokeColor(C.border).lineWidth(0.5).roundedRect(M, y, W - M * 2, chartH, 8).stroke().restore();

  const projects = ['PRJ-001', 'PRJ-002', 'PRJ-003', 'PRJ-004', 'PRJ-005'];
  const issued   = [80, 55, 120, 40, 95];
  const returned = [60, 30, 85,  25, 70];
  const maxVal   = 140;
  const barW     = 22;
  const groupW   = 64;
  const chartInner = W - M * 2 - 60;
  const step = chartInner / projects.length;

  projects.forEach((p, i) => {
    const bx = M + 30 + i * step;
    const iss = (issued[i] / maxVal) * (chartH - 35);
    const ret = (returned[i] / maxVal) * (chartH - 35);
    rect(bx, y + chartH - 20 - iss, barW, iss, C.primary, 3);
    rect(bx + barW + 3, y + chartH - 20 - ret, barW, ret, C.green, 3);
    text(p, bx - 5, y + chartH - 14, { size: 7, color: C.light, width: groupW });
  });

  // Legend
  rect(M + chartInner - 80, y + 8, 12, 12, C.primary, 2);
  text('Issued', M + chartInner - 65, y + 10, { size: 8, color: C.mid });
  rect(M + chartInner - 80, y + 26, 12, 12, C.green, 2);
  text('Returned', M + chartInner - 65, y + 28, { size: 8, color: C.mid });

  y += chartH + 20;

  // Coordinator stats
  text('Coordinator Escalation Stats', M, y, { size: 13, bold: true });
  y += 20;

  const escStats = [
    { label: 'Pending Escalations',    val: '2',     color: C.orange },
    { label: 'Resolved This Week',     val: '7',     color: C.green  },
    { label: 'Total Resolved',         val: '43',    color: C.primary},
    { label: 'Avg Resolution Time',    val: '3.2h',  color: C.purple },
  ];
  const ew = (W - M * 2 - 15) / 4;
  escStats.forEach((e, i) => {
    const ex = M + (ew + 5) * i;
    rect(ex, y, ew, 52, e.color + '18', 8);
    text(e.val,   ex, y + 8,  { size: 22, bold: true, color: e.color, width: ew, align: 'center' });
    text(e.label, ex + 4, y + 36, { size: 8, color: C.mid, width: ew - 8, align: 'center' });
  });

  pageFooter(5);
}

// ── PAGE 6 — WMS Module ────────────────────────────────────────────────────
function wmsPage() {
  doc.addPage();
  pageHeader('Warehouse Management System (WMS)', 'Advanced module for warehouse operations');

  let y = 130;

  const modules = [
    { icon: '📥', name: 'Receive GRN',          color: C.green,   desc: 'Goods Received Notes. Scan supplier POs, record quantities, capture batch/lot numbers.' },
    { icon: '📍', name: 'Putaway Tasks',         color: C.primary, desc: 'Assign received stock to bin locations. Location hierarchy: Zone → Aisle → Bin.' },
    { icon: '🗂️', name: 'Item Master',           color: C.purple,  desc: 'Manage SKUs, categories, UOM, reorder points, and sync with site inventory stock.' },
    { icon: '📦', name: 'Warehouse Inventory',   color: C.accent,  desc: 'Real-time stock levels per bin location. Search, filter, adjust, audit trail.' },
    { icon: '🚚', name: 'Dispatch Orders',       color: C.orange,  desc: 'Pick lists, dispatch confirmation, carrier/vehicle assignment, proof of delivery.' },
    { icon: '🔁', name: 'Cycle Counting',        color: C.red,     desc: 'Schedule and execute cycle count tasks. Variance reports with approval workflow.' },
    { icon: '🏭', name: 'Supplier Management',   color: C.yellow,  desc: 'Supplier profiles, contact info, performance tracking, linked to POs.' },
    { icon: '📊', name: 'WMS Reports',           color: C.mid,     desc: 'Receiving history, dispatch logs, inventory turnover, location utilization.' },
  ];

  const mw = (W - M * 2 - 10) / 2;
  modules.forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const mx = M + col * (mw + 10);
    const my = y + row * 88;

    rect(mx, my, mw, 78, C.white, 8);
    doc.save().strokeColor(m.color + '66').lineWidth(1).roundedRect(mx, my, mw, 78, 8).stroke().restore();
    rect(mx, my, 4, 78, m.color, 4);

    rect(mx + 14, my + 14, 40, 40, m.color + '18', 8);
    text(m.icon, mx + 14, my + 22, { size: 20, width: 40, align: 'center' });

    text(m.name, mx + 64, my + 14, { size: 11, bold: true, color: C.dark, width: mw - 80 });
    text(m.desc, mx + 64, my + 32, { size: 9, color: C.light, width: mw - 80, lineGap: 2 });
  });

  y += 4 * 88 + 16;

  // Roles in WMS
  text('WMS User Roles', M, y, { size: 13, bold: true });
  y += 20;
  hline(y); y += 12;

  const wmsRoles = [
    { role: 'warehouse_manager', color: C.primary, desc: 'Full WMS access — all modules, reports, user assignments' },
    { role: 'receiver',          color: C.green,   desc: 'GRN receiving and putaway tasks only' },
    { role: 'picker',            color: C.orange,  desc: 'Dispatch picking lists and order confirmation' },
  ];

  wmsRoles.forEach((r, i) => {
    const ry = y + i * 32;
    badge(r.role, M, ry + 4, r.color);
    const bw2 = doc.fontSize(8.5).widthOfString(r.role) + 14;
    text(r.desc, M + bw2 + 12, ry + 6, { size: 10, color: C.mid });
  });

  pageFooter(6);
}

// ── PAGE 7 — Database Schema ───────────────────────────────────────────────
function schemaPage() {
  doc.addPage();
  pageHeader('Database Schema Overview', 'PostgreSQL tables and relationships');

  let y = 130;

  const tables = [
    { name: 'users',              cols: 'id, employee_id, name, role, permissions (JSONB), is_active',                 color: C.primary },
    { name: 'projects',           cols: 'id, project_number, name, location, start_date, end_date, is_active',         color: C.green },
    { name: 'stock_items',        cols: 'id, project_id, item_number, description_1, uom, qty_on_hand, reorder_point', color: C.purple },
    { name: 'material_requests',  cols: 'id, request_number, project_id, requester_id, status, notes, created_at',     color: C.accent },
    { name: 'request_items',      cols: 'id, request_id, stock_item_id, quantity_requested, quantity_approved',         color: C.accent },
    { name: 'material_issues',    cols: 'id, issue_number, request_id, storekeeper_id, pdf_path, created_at',          color: C.orange },
    { name: 'issue_items',        cols: 'id, issue_id, stock_item_id, qty_issued, batch_number',                       color: C.orange },
    { name: 'material_returns',   cols: 'id, issue_id, returned_by, qty_returned, notes, created_at',                  color: C.red },
    { name: 'escalations',        cols: 'id, request_id, escalation_notes, escalation_status, resolution',             color: C.yellow },
    { name: 'upload_log',         cols: 'id, user_id, project_id, row_count, error_count, created_at',                 color: C.mid },
    { name: 'audit_log',          cols: 'id, user_id, action, entity_type, entity_id, payload, created_at',            color: C.mid },
    { name: 'system_settings',    cols: 'key, value (JSONB)  — packing_list_columns, etc.',                            color: C.light },
  ];

  const tw2 = W - M * 2;
  tables.forEach((t, i) => {
    const ty = y + i * 38;
    rect(M, ty, tw2, 32, i % 2 === 0 ? C.white : C.bg, 0);
    rect(M, ty, 3, 32, t.color);
    text(t.name, M + 12, ty + 8, { size: 10, bold: true, color: C.dark, width: 165 });
    text(t.cols, M + 185, ty + 8, { size: 8.5, color: C.light, width: tw2 - 195, lineGap: 2 });
    hline(ty + 32, C.border + '80');
  });

  y += tables.length * 38 + 16;

  // Migration note
  rect(M, y, W - M * 2, 52, C.primary + '0d', 8);
  rect(M, y, 4, 52, C.primary, 4);
  text('Migration Strategy', M + 16, y + 8, { size: 10, bold: true, color: C.primary });
  text(
    'All schema changes are versioned SQL files (001_*.sql → 032_*.sql). Each uses IF NOT EXISTS / ON CONFLICT so migrations are ' +
    'safe to re-run. No ORM — raw pg queries for full control and performance.',
    M + 16, y + 24, { size: 9, color: C.mid, lineGap: 3, width: W - M * 2 - 30 }
  );

  pageFooter(7);
}

// ── PAGE 8 — Deployment & Quick Start ────────────────────────────────────
function deployPage() {
  doc.addPage();
  pageHeader('Deployment & Quick Start', 'Getting the system running in minutes');

  let y = 130;

  // Two columns
  const colW = (W - M * 2 - 20) / 2;

  // LEFT — Server setup
  text('Server Setup', M, y, { size: 13, bold: true, color: C.dark });
  y += 22;

  const serverSteps = [
    ['cd server', 'Navigate to server directory'],
    ['npm install', 'Install dependencies'],
    ['cp .env.example .env', 'Configure environment'],
    ['npm run migrate', 'Run all SQL migrations'],
    ['npm run seed', 'Create default admin user'],
    ['npm run dev', 'Start on port 4000'],
  ];

  serverSteps.forEach(([cmd, desc], i) => {
    const sy = y + i * 44;
    rect(M, sy, colW, 36, C.dark, 6);
    text('$ ' + cmd, M + 10, sy + 8, { color: '#a5f3fc', size: 9.5, bold: true });
    text(desc, M + 10, sy + 22, { color: C.muted, size: 8.5 });
  });

  // RIGHT — Client setup
  const rx = M + colW + 20;
  let ry = 130;
  text('Client Setup', rx, ry, { size: 13, bold: true, color: C.dark });
  ry += 22;

  const clientSteps = [
    ['cd client', 'Navigate to client directory'],
    ['npm install', 'Install dependencies'],
    ['npm run dev', 'Start Vite on port 5173'],
    ['npm run build', 'Production build'],
    ['npm run lint', 'Run ESLint checks'],
  ];

  clientSteps.forEach(([cmd, desc], i) => {
    const sy = ry + i * 44;
    rect(rx, sy, colW, 36, C.dark, 6);
    text('$ ' + cmd, rx + 10, sy + 8, { color: '#bbf7d0', size: 9.5, bold: true });
    text(desc, rx + 10, sy + 22, { color: C.muted, size: 8.5 });
  });

  y += serverSteps.length * 44 + 24;

  // Environment variables
  text('Environment Variables  (server/.env)', M, y, { size: 13, bold: true });
  y += 20;
  rect(M, y, W - M * 2, 90, C.dark, 8);
  const envLines = [
    'DATABASE_URL=postgresql://localhost/site_inventory',
    'JWT_SECRET=site_inventory_super_secret_jwt_key_2026',
    'JWT_EXPIRES_IN=8h',
    'PORT=4000',
    'FRONTEND_URL=http://localhost:5173',
  ];
  envLines.forEach((line, i) => {
    const parts = line.split('=');
    text(parts[0] + '=', M + 14, y + 10 + i * 15, { color: '#fbbf24', size: 8.5, bold: true });
    const kw = doc.fontSize(8.5).widthOfString(parts[0] + '=');
    text(parts.slice(1).join('='), M + 14 + kw, y + 10 + i * 15, { color: '#a5f3fc', size: 8.5 });
  });

  y += 104;

  // Default credentials
  text('Default Test Credentials', M, y, { size: 13, bold: true });
  y += 18;

  const creds = [
    { id: '73106302', pw: 'Admin@1234',  role: 'admin',      name: 'Admin' },
    { id: 'waled',    pw: 'Pass@1234',   role: 'storekeeper',name: 'Waled (assign to project first)' },
    { id: '2250',     pw: 'Pass@1234',   role: 'requester',  name: 'Hassan' },
    { id: '2240',     pw: 'Pass@1234',   role: 'superuser',  name: 'Hassan1' },
  ];

  const roleColors2 = { admin: C.red, storekeeper: C.primary, requester: C.green, superuser: C.purple };
  creds.forEach((c, i) => {
    const cy = y + i * 30;
    rect(M, cy, W - M * 2, 24, i % 2 === 0 ? C.white : C.bg, 4);
    badge(c.role, M + 8, cy + 4, roleColors2[c.role] || C.mid);
    const bw2 = doc.fontSize(8.5).widthOfString(c.role) + 14;
    text(`ID: ${c.id}`, M + bw2 + 18, cy + 6, { size: 9.5, bold: true, color: C.dark });
    text(`Password: ${c.pw}`, M + bw2 + 90, cy + 6, { size: 9.5, color: C.mid });
    text(c.name, M + bw2 + 210, cy + 6, { size: 9, color: C.light });
  });

  pageFooter(8);
}

// ── Shared Components ──────────────────────────────────────────────────────
function pageHeader(title, subtitle) {
  rect(0, 0, W, 105, C.dark);
  rect(0, 0, 6, 105, C.primary);
  rect(0, 100, W, 5, C.primary);

  text('SITE INVENTORY  //', 14, 18, { color: C.muted, size: 8.5 });
  text(title,    14, 32, { color: C.white, size: 22, bold: true });
  text(subtitle, 14, 62, { color: C.muted, size: 10.5, width: W - 80 });

  // Page brand mark
  rect(W - 110, 18, 90, 28, C.primary + '33', 6);
  text('📦 SIM', W - 104, 26, { color: C.accent, size: 11, bold: true });
}

function pageFooter(pageNum) {
  hline(H - 36, C.border);
  text('Site Inventory Management System  •  Confidential', M, H - 28, { size: 8, color: C.muted });
  text(`Page ${pageNum} of 8`, 0, H - 28, { size: 8, color: C.muted, align: 'right', width: W - M });
}

// ── Render ─────────────────────────────────────────────────────────────────
coverPage();
architecturePage();
rolesPage();
workflowsPage();
dashboardsPage();
wmsPage();
schemaPage();
deployPage();

doc.end();
console.log('✅  PDF generated →', OUT);
