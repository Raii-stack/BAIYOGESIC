const express = require('express');
const { authenticate, requireActiveUser } = require('../middleware/auth');
const { getAuditLogs } = require('../controllers/audit-log-controller');

const router = express.Router();

router.use(authenticate, requireActiveUser);
router.get('/', getAuditLogs);

module.exports = router;
