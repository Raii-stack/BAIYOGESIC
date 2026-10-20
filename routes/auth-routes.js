const express = require('express');
const {
  setPassword,
  forgotPassword,
  resetPassword,
  login,
  session,
  logout,
  changePassword
} = require('../controllers/auth-controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/set-password', setPassword);
router.post('/first-time-login', setPassword);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/login', login);
router.get('/session', authenticate, session);
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, changePassword);

module.exports = router;
