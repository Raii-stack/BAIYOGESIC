require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { supabase } = require('./db');
const { asyncHandler, errorHandler } = require('./middleware/error-handler');
const { auditContext } = require('./middleware/audit-context');
const authRoutes = require('./routes/auth-routes');

const app = express();
const port = Number.parseInt(process.env.PORT || '3000', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

app.disable('x-powered-by');
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api/auth', auditContext, authRoutes);

app.get('/health', asyncHandler(async (req, res) => {
  const { error } = await supabase.from('_health_check').select('*').limit(1);

  // A missing health-check table is expected until the first schema is deployed.
  if (error && error.code !== '42P01') {
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
