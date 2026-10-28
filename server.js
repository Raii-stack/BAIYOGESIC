require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { supabase } = require('./db');
const { asyncHandler, errorHandler } = require('./middleware/error-handler');
const { auditContext } = require('./middleware/audit-context');
const authRoutes = require('./routes/auth-routes');
const customerRoutes = require('./routes/customer-routes');
const productRoutes = require('./routes/product-routes');
const employeeRoutes = require('./routes/employee-routes');
const userRoutes = require('./routes/user-routes');

const app = express();
const port = Number.parseInt(process.env.PORT || '3000', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

app.disable('x-powered-by');
app.use(helmet());
const allowedOrigins = new Set(
  (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

if (process.env.VERCEL_URL) {
  allowedOrigins.add(`https://${process.env.VERCEL_URL}`);
}
if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  allowedOrigins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || /\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api/auth', auditContext, authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/departments', employeeRoutes.departmentRouter);
app.use('/api/jobs', employeeRoutes.jobRouter);
app.use('/api/users', userRoutes);

app.get(['/health', '/api/health'], asyncHandler(async (req, res) => {
  const { error } = await supabase.from('_health_check').select('*').limit(1);

  // A missing health-check table is expected until the first schema is deployed.
  if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
    const databaseError = new Error('Database health check failed');
    databaseError.statusCode = 503;
    throw databaseError;
  }

  res.json({ success: true, data: { status: 'ok' } });
}));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { message: 'Route not found', statusCode: 404 }
  });
});

app.use(errorHandler);

if (require.main === module) {
  app.listen(port, () => {
    console.log(`HOPE, Inc. API listening on port ${port}`);
  });
}

module.exports = app;
