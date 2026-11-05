import { describe, expect, it, vi } from 'vitest';

const {
  roundCurrency,
  calculateLineTotal,
  getPaymentStatus,
  calculateOrderTotals,
  lookupUnitPriceAsOfDate,
  formatSalesOrderCode,
  nextTransactionNo,
  nextOfficialReceiptNo,
  validateSalePayload
} = require('./sales-calculations');

describe('lib/sales-calculations', () => {
  it('rounds currency and line totals without floating-point drift', () => {
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
    expect(calculateLineTotal(3, 19.99)).toBe(59.97);
    expect(calculateLineTotal(15, 197.99)).toBe(2969.85);
  });

  it('computes order subtotal, tax, total amount, balance, and payment status', () => {
    const lines = [
      { prodcode: 'P-001', quantity: 10, unitprice: 13.75, is_deleted: false },
      { prodcode: 'P-002', quantity: 5, unitprice: 19.4, is_deleted: false }
    ];

    const unpaid = calculateOrderTotals(lines, []);
    expect(unpaid.subtotal).toBe(234.5);
    expect(unpaid.tax).toBe(0);
    expect(unpaid.totalAmount).toBe(234.5);
    expect(unpaid.amountPaid).toBe(0);
    expect(unpaid.balance).toBe(234.5);
    expect(unpaid.paymentStatus).toBe('Unpaid');

    const partial = calculateOrderTotals(lines, [{ amount: 150, is_deleted: false }]);
    expect(partial.amountPaid).toBe(150);
    expect(partial.balance).toBe(84.5);
    expect(partial.paymentStatus).toBe('Partial');

    const paid = calculateOrderTotals(lines, [
      { amount: 150, is_deleted: false },
      { amount: 84.5, is_deleted: false }
    ]);
    expect(paid.amountPaid).toBe(234.5);
    expect(paid.balance).toBe(0);
    expect(paid.paymentStatus).toBe('Paid');
    expect(getPaymentStatus(234.5, 234.5)).toBe('Paid');
  });

  it('looks up unit price effective on or before the sales date', () => {
    const history = [
      { prodcode: 'P-001', effdate: '2026-01-01', unitprice: 10.0, is_deleted: false },
      { prodcode: 'P-001', effdate: '2026-06-01', unitprice: 12.5, is_deleted: false },
      { prodcode: 'P-001', effdate: '2026-09-01', unitprice: 13.75, is_deleted: false }
    ];

    expect(lookupUnitPriceAsOfDate(history, '2026-03-15')).toBe(10.0);
    expect(lookupUnitPriceAsOfDate(history, '2026-06-01')).toBe(12.5);
    expect(lookupUnitPriceAsOfDate(history, '2026-10-15')).toBe(13.75);
    expect(lookupUnitPriceAsOfDate(history, '2025-12-31')).toBeNull();
  });

  it('formats sequential transaction and receipt numbers', async () => {
    expect(formatSalesOrderCode('2026-10-15', 42)).toBe('SO-202610-0042');

    const client = {
      query: vi.fn(async (sql) => {
        if (sql.includes('FROM public.sales')) {
          return { rows: [{ next_number: 125 }] };
        }
        if (sql.includes('FROM public.payment')) {
          return { rows: [{ next_number: 166 }] };
        }
        return { rows: [] };
      })
    };

    expect(await nextTransactionNo(client)).toBe('TR000125');
    expect(await nextOfficialReceiptNo(client)).toBe('OR000166');
  });

  it('validates sale payload and rejects zero or negative quantities', () => {
    expect(() =>
      validateSalePayload({
        custno: 'C0001',
        empno: '00001',
        salesdate: '2026-10-15',
        lines: [{ prodcode: 'P-001', quantity: 0 }]
      })
    ).toThrow(/greater than zero/i);

    expect(() =>
      validateSalePayload({
        custno: 'C0001',
        empno: '00001',
        salesdate: '2026-10-15',
        lines: [{ prodcode: 'P-001', quantity: -3 }]
      })
    ).toThrow(/greater than zero/i);

    const valid = validateSalePayload({
      custno: 'C0001',
      empno: '00001',
      salesdate: '2026-10-15',
      lines: [{ prodcode: 'P-001', quantity: 4, unitprice: 13.75 }]
    });
    expect(valid.custno).toBe('C0001');
    expect(valid.lines).toHaveLength(1);
    expect(valid.lines[0].quantity).toBe(4);
  });
});
