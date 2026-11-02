const express = require('express');
const {
  login,
  session,
  logout,
  changePassword,
  register,
  forgotPassword,
  resetPassword,
  setPassword
} = require('../controllers/auth-controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.get('/session', authenticate, session);
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, changePassword);
router.post('/register', register);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/set-password', setPassword);

module.exports = router;
