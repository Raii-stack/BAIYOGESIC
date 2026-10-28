const express = require('express');
const { authenticate, requireActiveUser } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const {
  listEmployees,
  getEmployee,
  listOptions,
  createEmployee,
  updateEmployee,
  archiveEmployee,
  restoreEmployee,
  listJobs,
  createJob,
  updateJob,
  archiveJob,
  restoreJob,
  listDepartments,
  createDepartment,
  updateDepartment,
  archiveDepartment,
  restoreDepartment
} = require('../controllers/employee-controller');

const router = express.Router();
router.use(authenticate, requireActiveUser);
router.get('/', requirePermission('HR', 'view'), listEmployees);
router.get('/options', requirePermission('HR', 'view'), listOptions);

router.get('/jobs', requirePermission('HR', 'view'), listJobs);
router.post('/jobs', requirePermission('HR', 'edit'), createJob);
router.put('/jobs/:jobcode', requirePermission('HR', 'edit'), updateJob);
router.delete('/jobs/:jobcode', requirePermission('HR', 'delete'), archiveJob);
router.post('/jobs/:jobcode/restore', requirePermission('HR', 'delete'), restoreJob);

router.get('/departments', requirePermission('HR', 'view'), listDepartments);
router.post('/departments', requirePermission('HR', 'edit'), createDepartment);
router.put('/departments/:deptcode', requirePermission('HR', 'edit'), updateDepartment);
router.delete('/departments/:deptcode', requirePermission('HR', 'delete'), archiveDepartment);
router.post('/departments/:deptcode/restore', requirePermission('HR', 'delete'), restoreDepartment);

router.get('/:empno', requirePermission('HR', 'view'), getEmployee);
router.post('/', requirePermission('HR', 'edit'), createEmployee);
router.put('/:empno', requirePermission('HR', 'edit'), updateEmployee);
router.delete('/:empno', requirePermission('HR', 'delete'), archiveEmployee);
router.post('/:empno/restore', requirePermission('HR', 'delete'), restoreEmployee);

const departmentRouter = express.Router();
departmentRouter.use(authenticate, requireActiveUser);
departmentRouter.get('/', requirePermission('HR', 'view'), listDepartments);
departmentRouter.post('/', requirePermission('HR', 'edit'), createDepartment);
departmentRouter.put('/:deptcode', requirePermission('HR', 'edit'), updateDepartment);
departmentRouter.delete('/:deptcode', requirePermission('HR', 'delete'), archiveDepartment);
departmentRouter.post('/:deptcode/restore', requirePermission('HR', 'delete'), restoreDepartment);

const jobRouter = express.Router();
jobRouter.use(authenticate, requireActiveUser);
jobRouter.get('/', requirePermission('HR', 'view'), listJobs);
jobRouter.post('/', requirePermission('HR', 'edit'), createJob);
jobRouter.put('/:jobcode', requirePermission('HR', 'edit'), updateJob);
jobRouter.delete('/:jobcode', requirePermission('HR', 'delete'), archiveJob);
jobRouter.post('/:jobcode/restore', requirePermission('HR', 'delete'), restoreJob);

router.departmentRouter = departmentRouter;
router.jobRouter = jobRouter;

module.exports = router;
