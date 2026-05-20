import { analyzeConsistency } from '../../src/pipeline/rules.js';
import { normalizeOrder } from '../../src/pipeline/normalize.js';
import { SourceOrder, NormalizedOrder } from '../../src/domain.js';

const sourceOrder: SourceOrder = {
  orderId: 10248,
  customerId: 'VINET',
  customerCompanyName: 'Vins et alcools Chevalier',
  customerCountry: 'France',
  employeeId: 5,
  orderDate: '1996-07-04T10:00:00.000Z',
  requiredDate: null,
  shippedDate: null,
  shipVia: 3,
  freight: 32.38,
  shipName: 'Vins et alcools Chevalier',
  shipAddress: '59 rue de l\'Abbaye',
  shipCity: 'Reims',
  shipRegion: null,
  shipPostalCode: '51100',
  shipCountry: 'France',
  shipperCompanyName: 'Federal Shipping',
  lines: [
    {
      productId: 11,
      productName: 'Queso Cabrales',
      unitPrice: 14,
      quantity: 12,
      discount: 0,
      discontinued: '0'
    },
    {
      productId: 42,
      productName: 'Singaporean Hokkien Fried Mee',
      unitPrice: 9.8,
      quantity: 10,
      discount: 0.05,
      discontinued: '0'
    }
  ]
};

test('normalizes currency using the mock FX table', () => {
  const normalized = normalizeOrder(sourceOrder, { baseCurrency: 'USD', windowMinutes: 15 });

  expect(normalized.currency).toBe('EUR');
  expect(normalized.fxRateToUsd).toBe(1.08);
  expect(normalized.normalizedGrossMinor).toBeLessThan(normalized.sourceGrossMinor);
  expect(normalized.sourceCurrency).toBe('USD');
});

test('flags discount and tax mismatches after reconciliation', () => {
  const normalized: NormalizedOrder = {
    sourceOrderId: 1,
    sourceCustomerId: 'VINET',
    customerCompanyName: 'Vins et alcools Chevalier',
    customerCountry: 'France',
    shipCountry: 'France',
    shipCity: 'Reims',
    shipRegion: null,
    orderedAt: '1996-07-04T10:00:00.000Z',
    orderedAtEpoch: 836280000,
    currency: 'EUR',
    fxRateToUsd: 1.08,
    sourceCurrency: 'USD',
    sourceGrossMinor: 10000,
    sourceDiscountMinor: 1000,
    sourceNetMinor: 9000,
    sourceTaxMinor: 900,
    sourceFreightMinor: 500,
    sourceTotalMinor: 10400,
    normalizedGrossMinor: 9259,
    normalizedDiscountMinor: 926,
    normalizedNetMinor: 8333,
    normalizedTaxMinor: 833,
    normalizedFreightMinor: 463,
    normalizedTotalMinor: 9629,
    duplicateKey: 'dup',
    fingerprint: 'fp',
    lines: [
      {
        productId: 11,
        productName: 'Queso Cabrales',
        quantity: 12,
        discountRate: 0.1,
        sourceUnitPriceMinor: 1000,
        sourceGrossMinor: 12000,
        sourceDiscountMinor: 1200,
        sourceNetMinor: 10800,
        sourceTaxMinor: 1080,
        normalizedUnitPriceMinor: 926,
        normalizedGrossMinor: 11111,
        normalizedDiscountMinor: 1111,
        normalizedNetMinor: 10000,
        normalizedTaxMinor: 1000,
        lineFingerprint: 'line-1'
      },
      {
        productId: 42,
        productName: 'Singaporean Hokkien Fried Mee',
        quantity: 1,
        discountRate: 0,
        sourceUnitPriceMinor: 1000,
        sourceGrossMinor: 1000,
        sourceDiscountMinor: 0,
        sourceNetMinor: 1000,
        sourceTaxMinor: 100,
        normalizedUnitPriceMinor: 926,
        normalizedGrossMinor: 926,
        normalizedDiscountMinor: 0,
        normalizedNetMinor: 926,
        normalizedTaxMinor: 93,
        lineFingerprint: 'line-2'
      }
    ]
  };

  const issues = analyzeConsistency(normalized);
  expect(issues.map((issue) => issue.code)).toContain('discount_tax_mismatch');
});
