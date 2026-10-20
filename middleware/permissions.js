const PERMISSIONS = {
  superadmin: {
    CRM: new Set(['view', 'edit', 'delete']),
    Inventory: new Set(['view', 'edit', 'delete']),
    HR: new Set(['view', 'edit', 'delete', 'salary']),
    Sales: new Set(['view', 'edit', 'delete']),
    Reports: new Set(['view']),
    Users: new Set(['view', 'edit', 'delete'])
  },
  administrator: {
    CRM: new Set(['view', 'edit', 'delete']),
    Inventory: new Set(['view', 'edit', 'delete']),
    HR: new Set(['view', 'edit', 'delete', 'salary']),
    Sales: new Set(['view', 'edit', 'delete']),
    Reports: new Set(['view']),
    Users: new Set(['view', 'edit', 'delete'])
  },
  admin: {
    CRM: new Set(['view', 'edit', 'delete']),
    Inventory: new Set(['view', 'edit', 'delete']),
    HR: new Set(['view', 'edit', 'delete', 'salary']),
    Sales: new Set(['view', 'edit', 'delete']),
    Reports: new Set(['view']),
    Users: new Set(['view', 'edit'])
  },
  user: {
    CRM: new Set(['view']),
    Inventory: new Set(['view']),
    HR: new Set(['view']),
    Sales: new Set(['view']),
    Reports: new Set(['view'])
  },
  employee: {
    CRM: new Set(['view']),
    Inventory: new Set(['view']),
    HR: new Set(['view']),
    Sales: new Set(['view']),
    Reports: new Set(['view'])
  }
};

const EMPLOYEE_RIGHT_RULES = {
  CRM: {
    view: ['customers.access', 'customers.add', 'customers.edit', 'customers.delete'],
    edit: ['customers.add', 'customers.edit'],
    delete: ['customers.delete']
  },
  Inventory: {
    view: ['products.access', 'products.add', 'products.edit', 'products.delete', 'products.price.add', 'products.price.edit', 'products.price.delete'],
    edit: ['products.add', 'products.edit', 'products.price.add', 'products.price.edit'],
    delete: ['products.delete', 'products.price.delete']
  },
  HR: {
    view: [
      'hr.access',
      'hr.job.add', 'hr.job.edit', 'hr.job.delete',
      'hr.department.add', 'hr.department.edit', 'hr.department.delete',
      'hr.employee.add', 'hr.employee.edit', 'hr.employee.delete',
      'hr.history.view', 'hr.history.add', 'hr.history.edit', 'hr.history.delete'
    ],
    edit: [
      'hr.job.add', 'hr.job.edit',
      'hr.department.add', 'hr.department.edit',
      'hr.employee.add', 'hr.employee.edit',
      'hr.history.add', 'hr.history.edit'
    ],
    delete: [
      'hr.job.delete',
      'hr.department.delete',
      'hr.employee.delete',
      'hr.history.delete'
    ]
  },
  Sales: {
    view: ['sales.access', 'sales.add', 'sales.edit', 'sales.delete', 'sales.details.view', 'sales.details.add', 'sales.details.edit', 'sales.details.delete'],
    edit: ['sales.add', 'sales.edit', 'sales.details.add', 'sales.details.edit'],
    delete: ['sales.delete', 'sales.details.delete']
  },
  Reports: {
    view: [
      'reports.access',
      'reports.top-customers',
      'reports.product-master',
      'reports.top-products',
      'reports.active-employees',
      'reports.all-employees',
      'reports.job-history',
      'reports.top-sales'
    ]
  }
};

function hasGranularRight(user, moduleName, action) {
  if (!user || !Array.isArray(user.rights)) {
    return null;
  }
  const moduleRules = EMPLOYEE_RIGHT_RULES[moduleName];
  if (!moduleRules || !moduleRules[action]) {
    return false;
  }
  const rightSet = new Set(user.rights);
  return moduleRules[action].some((code) => rightSet.has(code));
}

function requirePermission(moduleName, action) {
  return (req, res, next) => {
    const role = req.user && req.user.role;
    if ((role === 'employee' || role === 'user') && Array.isArray(req.user.rights)) {
      if (hasGranularRight(req.user, moduleName, action)) {
        return next();
      }
      return res.status(403).json({
        success: false,
        error: { message: 'Insufficient permissions', statusCode: 403 }
      });
    }

    const rolePermissions = PERMISSIONS[role];
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

function isSuperAdminRole(role) {
  return role === 'superadmin' || role === 'administrator';
}

function isAdminOrSuperAdmin(role) {
  return isSuperAdminRole(role) || role === 'admin';
}

module.exports = { requirePermission, isSuperAdminRole, isAdminOrSuperAdmin };
