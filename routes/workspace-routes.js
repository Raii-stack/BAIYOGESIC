const router = require('express').Router();
const { authenticate, requireActiveUser } = require('../middleware/auth');
const { getPreferences, updatePreferences, listNotifications, markNotificationRead, markAllRead, openNotification } = require('../controllers/workspace-controller');

router.use(authenticate, requireActiveUser);
router.get('/preferences', getPreferences);
router.patch('/preferences', updatePreferences);
router.get('/notifications', listNotifications);
router.post('/notifications/read-all', markAllRead);
router.patch('/notifications/:notificationId/read', markNotificationRead);
router.get('/notifications/:notificationId/open', openNotification);
module.exports = router;
