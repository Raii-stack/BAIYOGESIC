const express = require('express');
const { register, login, logout } = require('../controllers/auth-controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticate, logout);

module.exports = router;
