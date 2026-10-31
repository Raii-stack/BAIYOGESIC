const { db } = require('../helpers');
const { ensureQaUsers } = require('./qa-users');

module.exports = async () => {
  await ensureQaUsers(db);
};