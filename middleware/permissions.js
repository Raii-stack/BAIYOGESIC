const PERMISSIONS = {
  administrator: {
    CRM: new Set(['view', 'edit', 'delete'])
  },
  admin: {
    CRM: new Set(['view', 'edit'])
  },
  user: {
    CRM: new Set(['view'])
  }
};

function requirePermission(moduleName, action) {
  return (req, res, next) => {
    const rolePermissions = PERMISSIONS[req.user && req.user.role];
    const allowedActions = rolePermissions && rolePermissions[moduleName];

    if (!allowedActions || !allowedActions.has(action)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Insufficient permissions', statusCode: 403 }
      });
    }

    next();
  };
}

module.exports = { requirePermission };
