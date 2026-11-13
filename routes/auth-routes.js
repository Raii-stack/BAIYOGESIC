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
const { activityLimiter, authLimiter } = require('../middleware/rate-limiter');
const { requirePermission } = require('../middleware/permissions');
const { registrationNotifications } = require('../controllers/user-controller');

const router = express.Router();

router.post('/login', authLimiter, login);
router.post('/activity', activityLimiter, authenticate, requireActiveUser, recordActivity);
router.get('/active-employees', activityLimiter, authenticate, requireActiveUser, listActiveEmployees);
router.get('/registration-notifications', activityLimiter, authenticate, requireActiveUser, requirePermission('Users', 'approve'), registrationNotifications);
router.get('/session', authenticate, session);
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, changePassword);
router.post('/register', authLimiter, register);
router.post('/register/send-code', authLimiter, sendRegistrationCode);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/validate', authLimiter, validateResetToken);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/set-password', authLimiter, setPassword);

module.exports = router;
