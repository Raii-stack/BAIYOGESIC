const express = require('express');
const { authenticate, requireActiveUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const reports = require('../controllers/report-controller');

const router = express.Router();
router.use(authenticate, requireActiveUser);

router.get('/top-customers', requirePermission('Reports', 'top-customers'), reports.topCustomers);
router.get('/product-master', requirePermission('Reports', 'product-master'), reports.productMaster);
router.get('/top-products', requirePermission('Reports', 'top-products'), reports.topProducts);
router.get('/active-employees', requirePermission('Reports', 'active-employees'), reports.activeEmployees);
router.get('/all-employees', requirePermission('Reports', 'all-employees'), reports.allEmployees);
router.get('/job-history', requirePermission('Reports', 'job-history'), reports.jobHistory);
router.get('/top-sales', requirePermission('Reports', 'top-sales'), reports.topSales);

module.exports = router;
