const express = require('express');
const { authenticate, requireActiveUser } = require('../middleware/auth');
const { getAuditLogs, getAuditLog } = require('../controllers/audit-log-controller');

const router = express.Router();

router.use(authenticate, requireActiveUser);
router.get('/', getAuditLogs);
router.get('/:auditId', getAuditLog);

module.exports = router;
