const express = require('express');
const { authenticate, requireActiveUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const {
  listUsers,
  listUserOptions,
  createUser,
  updateUser,
  setBlockStatus,
  updateUserRights
} = require('../controllers/user-controller');

const router = express.Router();

router.use(authenticate, requireActiveUser);
router.get('/', requirePermission('Users', 'view'), listUsers);
router.get('/options', requirePermission('Users', 'view'), listUserOptions);
router.post('/', requirePermission('Users', 'edit'), createUser);
router.put('/:userId', requirePermission('Users', 'edit'), updateUser);
router.patch('/:userId/block', requirePermission('Users', 'edit'), setBlockStatus);
router.put('/:userId/rights', requirePermission('Users', 'edit'), updateUserRights);

module.exports = router;
