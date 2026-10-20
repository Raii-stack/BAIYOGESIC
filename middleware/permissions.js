const PERMISSIONS = {
  administrator: {
    CRM: new Set(['view', 'edit', 'delete']),
    Inventory: new Set(['view', 'edit', 'delete']),
    HR: new Set(['view', 'edit', 'salary'])
  },
  admin: {
    CRM: new Set(['view', 'edit']),
    Inventory: new Set(['view', 'edit']),
    HR: new Set(['view', 'edit', 'salary'])
  },
  user: {
    CRM: new Set(['view']),
    Inventory: new Set(['view']),
    HR: new Set(['view'])
  },
  employee: {
    CRM: new Set(['view']),
    Inventory: new Set(['view']),
    HR: new Set(['view'])
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
