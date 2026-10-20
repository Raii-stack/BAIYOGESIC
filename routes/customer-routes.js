const express = require('express');
const {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  restoreCustomer
} = require('../controllers/customer-controller');
const { authenticate, requireActiveUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();

router.use(authenticate, requireActiveUser);
router.get('/', requirePermission('CRM', 'view'), listCustomers);
router.post('/', requirePermission('CRM', 'edit'), createCustomer);
router.put('/:custno', requirePermission('CRM', 'edit'), updateCustomer);
router.delete('/:custno', requirePermission('CRM', 'delete'), deleteCustomer);
router.post('/:custno/restore', requirePermission('CRM', 'delete'), restoreCustomer);

module.exports = router;
