const express = require('express');
const {
  login,
  session,
  logout,
  changePassword
} = require('../controllers/auth-controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.get('/session', authenticate, session);
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, changePassword);

module.exports = router;
