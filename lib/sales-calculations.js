const MAX_TRANSACTION_NUMBER = 999999;
const MAX_RECEIPT_NUMBER = 999999;

function roundCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function calculateLineTotal(quantity, unitPrice) {
  const qty = Number(quantity);
  const price = Number(unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) {
    return 0;
  }
  return roundCurrency(qty * price);
}

function getPaymentStatus(totalAmount, amountPaid) {
  const total = roundCurrency(totalAmount);
  const paid = roundCurrency(amountPaid);
  const balance = Math.max(0, roundCurrency(total - paid));

  if (total > 0 && balance <= 0) {
    return 'Paid';
  }
  if (paid > 0 && balance > 0) {
    return 'Partial';
  }
  return 'Unpaid';
}

function calculateOrderTotals(lines = [], payments = [], taxRate = 0) {
  const activeLines = Array.isArray(lines)
    ? lines.filter((line) => !line.is_deleted && line.status !== 'Inactive')
    : [];

  const activePayments = Array.isArray(payments)
    ? payments.filter((payment) => !payment.is_deleted && payment.status !== 'Inactive')
    : [];

  const subtotal = roundCurrency(
    activeLines.reduce((sum, line) => {
      const qty = Number(line.quantity ?? line.qty ?? 0);
      const unitPrice = Number(line.unitprice ?? line.unitPrice ?? 0);
      return roundCurrency(sum + calculateLineTotal(qty, unitPrice));
    }, 0)
  );

  const normalizedTaxRate = Number.isFinite(Number(taxRate)) && Number(taxRate) > 0 ? Number(taxRate) : 0;
  const tax = roundCurrency(subtotal * normalizedTaxRate);
  const totalAmount = roundCurrency(subtotal + tax);

  const amountPaid = roundCurrency(
    activePayments.reduce((sum, payment) => {
      const amount = Number(payment.amount ?? 0);
      return roundCurrency(sum + (Number.isFinite(amount) ? amount : 0));
    }, 0)
  );

  const balance = Math.max(0, roundCurrency(totalAmount - amountPaid));
  const paymentStatus = getPaymentStatus(totalAmount, amountPaid);

  return {
    subtotal,
    tax,
    total: totalAmount,
    totalAmount,
    total_amount: totalAmount,
    amountPaid,
    amount_paid: amountPaid,
    balance,
    paymentStatus,
    payment_status: paymentStatus
  };
}

function lookupUnitPriceAsOfDate(priceHistoryRows = [], salesDate) {
  const targetDate = typeof salesDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(salesDate.trim())
    ? salesDate.trim()
    : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

  const eligible = (Array.isArray(priceHistoryRows) ? priceHistoryRows : [])
    .filter((entry) => {
      if (!entry || entry.is_deleted) return false;
      const effDate = String(entry.effdate || entry.effectiveDate || '').slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(effDate) && effDate <= targetDate;
    })
    .sort((a, b) => {
      const dateA = String(a.effdate || a.effectiveDate || '').slice(0, 10);
      const dateB = String(b.effdate || b.effectiveDate || '').slice(0, 10);
      return dateB.localeCompare(dateA);
    });

  if (!eligible.length) {
    return null;
  }

  const rawPrice = eligible[0].unitprice ?? eligible[0].price ?? eligible[0].unitPrice;
  const numericPrice = Number(rawPrice);
  return Number.isFinite(numericPrice) ? roundCurrency(numericPrice) : null;
}

function formatSalesOrderCode(salesDate, sequenceNumber) {
  const dateStr = typeof salesDate === 'string' && /^\d{4}-\d{2}/.test(salesDate.trim())
    ? salesDate.trim().slice(0, 7).replace('-', '')
    : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }).slice(0, 7).replace('-', '');
  const seq = Math.max(1, Number.parseInt(sequenceNumber, 10) || 1);
  return `SO-${dateStr}-${String(seq).padStart(4, '0')}`;
}

async function nextTransactionNo(client) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('public.sales.transno'))");
  const result = await client.query(
    `SELECT COALESCE(MAX(substring(transno FROM 3)::integer), 0) + 1 AS next_number
     FROM public.sales
     WHERE transno ~ '^TR[0-9]{6}$'`
  );
  const nextNumber = Number(result.rows[0]?.next_number || 1);

  if (nextNumber > MAX_TRANSACTION_NUMBER) {
    const error = new Error('Transaction number limit reached; no more TR numbers are available');
    error.statusCode = 409;
    throw error;
  }

  return `TR${String(nextNumber).padStart(6, '0')}`;
}

async function nextOfficialReceiptNo(client) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('public.payment.orno'))");
  const result = await client.query(
    `SELECT COALESCE(MAX(substring(orno FROM 3)::integer), 0) + 1 AS next_number
     FROM public.payment
     WHERE orno ~ '^OR[0-9]{6}$'`
  );
  const nextNumber = Number(result.rows[0]?.next_number || 1);

  if (nextNumber > MAX_RECEIPT_NUMBER) {
    const error = new Error('Official receipt number limit reached; no more OR numbers are available');
    error.statusCode = 409;
    throw error;
  }

  return `OR${String(nextNumber).padStart(6, '0')}`;
}

function validateSalePayload(body) {
  const details = {};

  const custno = String(
    body?.custno ?? body?.customerCode ?? body?.customerId ?? ''
  ).trim();
  if (!custno) {
    details.custno = 'Customer is required';
  }

  const empno = String(
    body?.empno ?? body?.employeeCode ?? body?.employeeId ?? ''
  ).trim();
  if (!empno) {
    details.empno = 'Salesperson (employee) is required';
  }

  const rawSalesDate = String(
    body?.salesdate ?? body?.salesDate ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  ).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawSalesDate) || Number.isNaN(Date.parse(rawSalesDate))) {
    details.salesdate = 'Sales date must be a valid date in YYYY-MM-DD format';
  }

  const rawLines = body?.lines ?? body?.lineItems ?? body?.items;
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    details.lines = 'At least one line item is required';
  }

  const normalizedLines = [];
  const seenProducts = new Set();

  if (Array.isArray(rawLines)) {
    rawLines.forEach((item, index) => {
      const prodcode = String(item?.prodcode ?? item?.productCode ?? '').trim();
      const rawQty = item?.quantity ?? item?.qty;
      const qty = Number(rawQty);

      if (!prodcode) {
        details[`lines[${index}].prodcode`] = 'Product code is required';
      } else if (seenProducts.has(prodcode.toUpperCase())) {
        details[`lines[${index}].prodcode`] = `Duplicate product code ${prodcode} in line items`;
      } else {
        seenProducts.add(prodcode.toUpperCase());
      }

      if (rawQty === undefined || rawQty === null || rawQty === '' || !Number.isFinite(qty) || qty <= 0) {
        details[`lines[${index}].quantity`] = 'Quantity must be greater than zero';
        if (!details.quantity) {
          details.quantity = 'Item quantity must be greater than zero';
        }
      }

      const rawUnitPrice = item?.unitprice ?? item?.unitPrice;
      const unitprice = rawUnitPrice !== undefined && rawUnitPrice !== null && rawUnitPrice !== ''
        ? Number(rawUnitPrice)
        : null;
      if (unitprice !== null && (!Number.isFinite(unitprice) || unitprice <= 0)) {
        details[`lines[${index}].unitprice`] = 'Unit price must be a positive number';
      }

      normalizedLines.push({
        prodcode,
        quantity: roundCurrency(qty),
        unitprice: unitprice !== null ? roundCurrency(unitprice) : null
      });
    });
  }

  if (Object.keys(details).length > 0) {
    const firstMessage = Object.values(details)[0];
    const error = new Error(firstMessage || 'Validation failed');
    error.statusCode = 400;
    error.details = details;
    throw error;
  }

  return {
    custno,
    empno,
    salesdate: rawSalesDate,
    lines: normalizedLines
  };
}

module.exports = {
  roundCurrency,
  calculateLineTotal,
  getPaymentStatus,
  calculateOrderTotals,
  lookupUnitPriceAsOfDate,
  formatSalesOrderCode,
  nextTransactionNo,
  nextOfficialReceiptNo,
  validateSalePayload
};
