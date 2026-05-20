import { normalizeOrder } from '../../src/pipeline/normalize.js';
import { SourceOrder } from '../../src/domain.js';

const sourceOrder: SourceOrder = {
  orderId: 20000,
  customerId: 'ALFKI',
  customerCompanyName: 'Alfreds Futterkiste',
  customerCountry: 'Germany',
  employeeId: 1,
  orderDate: '1996-07-04T10:00:00.000Z',
  requiredDate: null,
  shippedDate: null,
  shipVia: 1,
  freight: 10,
  shipName: 'Alfreds Futterkiste',
  shipAddress: 'Obere Str. 57',
  shipCity: 'Berlin',
  shipRegion: null,
  shipPostalCode: '12209',
  shipCountry: 'Germany',
  shipperCompanyName: 'Speedy Express',
  lines: [
    {
      productId: 1,
      productName: 'Chai',
      unitPrice: 18,
      quantity: 2,
      discount: 0,
      discontinued: '0'
    }
  ]
};

test('produces the same duplicate key inside the time window', () => {
  const first = normalizeOrder(sourceOrder, { baseCurrency: 'USD', windowMinutes: 15 });
  const second = normalizeOrder({ ...sourceOrder, orderId: 20001, orderDate: '1996-07-04T10:05:00.000Z' }, { baseCurrency: 'USD', windowMinutes: 15 });

  expect(first.duplicateKey).toBe(second.duplicateKey);
});

test('changes the duplicate key outside the time window', () => {
  const first = normalizeOrder(sourceOrder, { baseCurrency: 'USD', windowMinutes: 15 });
  const second = normalizeOrder({ ...sourceOrder, orderId: 20001, orderDate: '1996-07-04T10:25:00.000Z' }, { baseCurrency: 'USD', windowMinutes: 15 });

  expect(first.duplicateKey).not.toBe(second.duplicateKey);
});
