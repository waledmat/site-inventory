require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,       // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: false,
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
}));
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:5174',
];
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)), credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
// Serve uploaded files (delivery note PDFs) only to authenticated users
const auth = require('./middleware/auth');
const fs = require('fs');
app.use('/uploads', auth, (req, res, next) => {
  const filePath = path.join(__dirname, '../uploads', req.path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()) });
});

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/projects', require('./routes/projects.routes'));
app.use('/api/requests', require('./routes/requests.routes'));
app.use('/api/issues', require('./routes/issues.routes'));
app.use('/api/returns', require('./routes/returns.routes'));
app.use('/api/stock', require('./routes/stock.routes'));
app.use('/api/upload', require('./routes/upload.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/audit', require('./routes/audit.routes'));
app.use('/api/transactions', require('./routes/transactions.routes'));

// WMS routes
app.use('/api/wms/suppliers',  require('./routes/wms.suppliers.routes'));
app.use('/api/wms/items',      require('./routes/wms.items.routes'));
app.use('/api/wms/locations',  require('./routes/wms.locations.routes'));
app.use('/api/wms/receiving',  require('./routes/wms.receiving.routes'));
app.use('/api/wms/putaway',    require('./routes/wms.putaway.routes'));
app.use('/api/wms/inventory',  require('./routes/wms.inventory.routes'));
app.use('/api/wms/dispatch',   require('./routes/wms.dispatch.routes'));
app.use('/api/wms/cyclecount', require('./routes/wms.cyclecount.routes'));
app.use('/api/wms/reports',    require('./routes/wms.reports.routes'));

app.use(require('./middleware/errorHandler'));

// Start cron job only when running for real (not during tests)
if (process.env.NODE_ENV !== 'test') {
  require('./jobs/dailyReport.job');
}

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
}
