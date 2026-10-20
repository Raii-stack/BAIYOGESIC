import { expect, test } from 'vitest';
import productValidation from './product-validation.js';

test('normalizes product input without losing the catalog price', () => {
  expect(productValidation.validateProduct({ description: '  Desk lamp ', unit: ' EA ', unitprice: '19.99' }))
    .toEqual({ description: 'Desk lamp', unit: 'ea', unitprice: 19.99 });
});

test('rejects values that exceed database column limits', () => {
  expect(() => productValidation.validateProduct({ description: 'x'.repeat(31), unit: 'pc', unitprice: 10 })).toThrow(/30 characters/);
  expect(() => productValidation.validateProduct({ description: 'Desk lamp', unit: 'pc', unitprice: '10.999' })).toThrow(/two decimal places/);
  expect(() => productValidation.validateProduct({ description: 'Desk lamp', unit: 'box', unitprice: 10 })).toThrow(/Unit must/);
});
