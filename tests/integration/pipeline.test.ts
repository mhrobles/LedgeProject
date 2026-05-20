import { processSourceOrders } from '../../src/pipeline/runIngestion.js';
import { SourceOrder } from '../../src/domain.js';
import { buildTestConfig, createTestRepository } from '../helpers.js';

const baseOrder: SourceOrder = {
  orderId: 30000,
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

test('skips a duplicate order detected by the window/hash rule', async () => {
  const { pool, repository } = await createTestRepository();

  try {
    const summary = await processSourceOrders({
      config: buildTestConfig(),
      repository,
      sourceDbPath: 'synthetic',
      sourceOrders: [
        baseOrder,
        { ...baseOrder, orderId: 30001, orderDate: '1996-07-04T10:05:00.000Z' }
      ]
    });

    const orders = await repository.listOrders(10);
    const exceptions = await repository.listExceptions(10);

    expect(summary.totalOrders).toBe(2);
    expect(summary.persistedOrders).toBe(1);
    expect(summary.duplicateOrders).toBe(1);
    expect(orders).toHaveLength(1);
    expect(exceptions.some((item) => item.code === 'duplicate_window_hash')).toBe(true);
  } finally {
    await pool.end();
  }
});

test('re-running the same source order is idempotent', async () => {
  const { pool, repository } = await createTestRepository();

  try {
    const config = buildTestConfig();
    await processSourceOrders({
      config,
      repository,
      sourceDbPath: 'synthetic',
      sourceOrders: [baseOrder]
    });

    const replaySummary = await processSourceOrders({
      config,
      repository,
      sourceDbPath: 'synthetic',
      sourceOrders: [baseOrder]
    });

    const orders = await repository.listOrders(10);

    expect(replaySummary.replayedOrders).toBe(1);
    expect(orders).toHaveLength(1);
  } finally {
    await pool.end();
  }
});
