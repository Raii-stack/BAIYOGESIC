const express = require('express');
const {
  login,
  session,
  logout,
  changePassword,
  register,
  sendRegistrationCode,
  validateResetToken,
  forgotPassword,
  resetPassword,
  setPassword
} = require('../controllers/auth-controller');
const { authenticate, requireActiveUser } = require('../middleware/auth');
const { recordActivity, listActiveEmployees } = require('../controllers/activity-controller');
const { activityLimiter } = require('../middleware/rate-limiter');
const { requirePermission } = require('../middleware/permissions');
const { registrationNotifications } = require('../controllers/user-controller');

const router = express.Router();

router.post('/login', login);
router.post('/activity', activityLimiter, authenticate, requireActiveUser, recordActivity);
router.get('/active-employees', activityLimiter, authenticate, requireActiveUser, listActiveEmployees);
router.get('/registration-notifications', activityLimiter, authenticate, requireActiveUser, requirePermission('Users', 'approve'), registrationNotifications);
router.get('/session', authenticate, session);
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, changePassword);
router.post('/register', register);
router.post('/register/send-code', sendRegistrationCode);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/validate', validateResetToken);
router.post('/reset-password', resetPassword);
router.post('/set-password', setPassword);

module.exports = router;
