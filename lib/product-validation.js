const UNITS = new Set(['pc', 'ea', 'mtr', 'pkg', 'ltr']);

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function validateProduct(body) {
  const source = body || {};
  const description = typeof source.description === 'string' ? source.description.trim() : '';
  const unit = typeof source.unit === 'string' ? source.unit.trim().toLowerCase() : '';
  const priceText = String(source.unitprice ?? '');
  const unitprice = Number(priceText);

  if (!description || description.length > 30) {
    throw validationError('Description is required and must be at most 30 characters');
  }
  if (!UNITS.has(unit)) {
    throw validationError('Unit must be pc, ea, mtr, pkg, or ltr');
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(priceText) || !Number.isFinite(unitprice) || unitprice <= 0 || unitprice > 99999999.99) {
    throw validationError('Unit price must be greater than zero, at most 99,999,999.99, and have no more than two decimal places');
  }

  return { description, unit, unitprice };
}

module.exports = { UNITS, validateProduct };
