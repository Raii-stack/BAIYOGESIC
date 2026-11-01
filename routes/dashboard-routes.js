const express = require('express');
const { authenticate, requireActiveUser } = require('../middleware/auth');
const { getDashboardStats } = require('../controllers/dashboard-controller');

const router = express.Router();

router.use(authenticate, requireActiveUser);

router.get('/stats', getDashboardStats);

module.exports = router;
