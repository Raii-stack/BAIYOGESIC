const express = require('express');
const { authenticate, requireActiveUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const {
  listSales,
  getSalesCatalog,
  lookupProductPrice,
  getSaleByTransno,
  createSale,
  recordPayment,
  updatePayment,
  deletePayment,
  archiveSale,
  restoreSale
} = require('../controllers/sales-controller');

const router = express.Router();
router.use(authenticate, requireActiveUser);

router.get('/', requirePermission('Sales', 'view'), listSales);
router.get('/catalog', requirePermission('Sales', 'view'), getSalesCatalog);
router.get('/price-lookup', requirePermission('Sales', 'view'), lookupProductPrice);
router.get('/products/:prodcode/price', requirePermission('Sales', 'view'), lookupProductPrice);
router.get('/:transno', requirePermission('Sales', 'view'), getSaleByTransno);

router.post('/', requirePermission('Sales', 'edit'), createSale);
router.post('/:transno/payments', requirePermission('Sales', 'edit'), recordPayment);
router.put('/:transno/payments/:orno', requirePermission('Sales', 'edit'), updatePayment);
router.delete('/:transno/payments/:orno', requirePermission('Sales', 'delete'), deletePayment);

router.delete('/:transno', requirePermission('Sales', 'delete'), archiveSale);
router.patch('/:transno/restore', requirePermission('Sales', 'delete'), restoreSale);
router.post('/:transno/restore', requirePermission('Sales', 'delete'), restoreSale);

module.exports = router;
