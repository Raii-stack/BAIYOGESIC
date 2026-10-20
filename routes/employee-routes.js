const express = require('express');
const { authenticate, requireActiveUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { listEmployees, getEmployee, listOptions, createEmployee, updateEmployee } = require('../controllers/employee-controller');

const router = express.Router();
router.use(authenticate, requireActiveUser);
router.get('/', requirePermission('HR', 'view'), listEmployees);
router.get('/options', requirePermission('HR', 'view'), listOptions);
router.get('/:empno', requirePermission('HR', 'view'), getEmployee);
router.post('/', requirePermission('HR', 'edit'), createEmployee);
router.put('/:empno', requirePermission('HR', 'edit'), updateEmployee);

module.exports = router;
