import { createApp } from '../../src/app.js';
import { SourceOrder } from '../../src/domain.js';
import { buildTestConfig, createTestRepository } from '../helpers.js';
import { processSourceOrders } from '../../src/pipeline/runIngestion.js';

const order: SourceOrder = {
  orderId: 40000,
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

test('protects routes with an API key and exposes processed data', async () => {
  const { pool, repository } = await createTestRepository();

  try {
    await processSourceOrders({
      config: buildTestConfig(),
      repository,
      sourceDbPath: 'synthetic',
      sourceOrders: [order]
    });

    const app = await createApp({
      config: buildTestConfig(),
      repository,
      ingestRunner: async () => ({
        runId: 'run-1',
        correlationId: 'corr-1',
        status: 'completed',
        totalOrders: 1,
        persistedOrders: 1,
        replayedOrders: 0,
        duplicateOrders: 0,
        warningOrders: 0,
        rejectedOrders: 0,
        exceptionCount: 0
      })
    });

    const unauthorized = await app.inject({ method: 'GET', url: '/orders' });
    const orders = await app.inject({ method: 'GET', url: '/orders', headers: { 'x-api-key': 'test-key' } });
    const exceptions = await app.inject({ method: 'GET', url: '/exceptions', headers: { 'x-api-key': 'test-key' } });
    const run = await app.inject({ method: 'POST', url: '/ingestions/run', headers: { 'x-api-key': 'test-key' } });

    expect(unauthorized.statusCode).toBe(401);
    expect(orders.statusCode).toBe(200);
    expect(JSON.parse(orders.payload).items).toHaveLength(1);
    expect(JSON.parse(exceptions.payload).items.length).toBeGreaterThanOrEqual(0);
    expect(run.statusCode).toBe(200);

    await app.close();
  } finally {
    await pool.end();
  }
});
