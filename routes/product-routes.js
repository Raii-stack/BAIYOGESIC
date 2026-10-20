const express = require('express');
const { authenticate, requireActiveUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { listProducts, getPriceHistory, createProduct, updateProduct, archiveProduct, restoreProduct } = require('../controllers/product-controller');

const router = express.Router();
router.use(authenticate, requireActiveUser);
router.get('/', requirePermission('Inventory', 'view'), listProducts);
router.get('/:prodcode/prices', requirePermission('Inventory', 'view'), getPriceHistory);
router.post('/', requirePermission('Inventory', 'edit'), createProduct);
router.put('/:prodcode', requirePermission('Inventory', 'edit'), updateProduct);
router.delete('/:prodcode', requirePermission('Inventory', 'delete'), archiveProduct);
router.post('/:prodcode/restore', requirePermission('Inventory', 'delete'), restoreProduct);

module.exports = router;
