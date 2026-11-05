const express = require('express');
const { authenticate, requireActiveUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const {
  listProducts,
  getPriceHistory,
  addPriceHistory,
  createProduct,
  updateProduct,
  archiveProduct,
  restoreProduct
} = require('../controllers/product-controller');

const router = express.Router();
router.use(authenticate, requireActiveUser);
router.get('/', requirePermission('Inventory', 'view'), listProducts);

// Dedicated price history endpoints (Issue #104)
router.get('/:prodcode/price-history', requirePermission('Inventory', 'view'), getPriceHistory);
router.post('/:prodcode/price-history', requirePermission('Inventory', 'edit'), addPriceHistory);

// Backwards-compatible aliases
router.get('/:prodcode/prices', requirePermission('Inventory', 'view'), getPriceHistory);
router.post('/:prodcode/prices', requirePermission('Inventory', 'edit'), addPriceHistory);

router.post('/', requirePermission('Inventory', 'edit'), createProduct);
router.put('/:prodcode', requirePermission('Inventory', 'edit'), updateProduct);
router.delete('/:prodcode', requirePermission('Inventory', 'delete'), archiveProduct);
router.post('/:prodcode/restore', requirePermission('Inventory', 'delete'), restoreProduct);

module.exports = router;
