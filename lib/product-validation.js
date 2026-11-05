const UNITS = new Set(['pc', 'ea', 'mtr', 'pkg', 'ltr']);

function validationError(message, details) {
  const error = new Error(details ? `${message}: ${Object.values(details).join('; ')}` : message);
  error.statusCode = 400;
  error.details = details;
  error.apiMessage = message;
  return error;
}

function sanitizeText(value) {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function validateProduct(body) {
  const source = body || {};
  const description = typeof source.description === 'string' ? sanitizeText(source.description) : '';
  const unit = typeof source.unit === 'string' ? source.unit.trim().toLowerCase() : '';
  const priceText = String(source.unitprice ?? '');
  const unitprice = Number(priceText);

  const details = {};
  if (!description) details.description = 'Description is required';
  else if (description.length > 30) details.description = 'Description must be 30 characters or fewer';
  if (!UNITS.has(unit)) {
    details.unit = 'Unit must be one of: pc, ea, mtr, pkg, ltr';
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(priceText) || !Number.isFinite(unitprice) || unitprice <= 0 || unitprice > 99999999.99) {
    details.unitprice = 'Unit price must be greater than zero, at most 99,999,999.99, and have no more than two decimal places';
  }
  if (Object.keys(details).length) {
    throw validationError('Validation failed', details);
  }

  return { description, unit, unitprice };
}

module.exports = { UNITS, validateProduct };
