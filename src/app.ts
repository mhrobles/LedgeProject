import Fastify, { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { AppConfig } from './config.js';
import { RunSummary } from './domain.js';
import { PostgresRepository } from './infra/repository.js';
import { runIngestion } from './pipeline/runIngestion.js';

export interface AppDependencies {
  config: AppConfig;
  repository: PostgresRepository;
  ingestRunner?: () => Promise<RunSummary>;
}

function mapOrderRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    sourceOrderId: row.source_order_id,
    customerId: row.source_customer_id,
    customerCompanyName: row.customer_company_name,
    customerCountry: row.customer_country,
    shipCountry: row.ship_country,
    shipCity: row.ship_city,
    shipRegion: row.ship_region,
    orderedAt: row.ordered_at,
    orderedAtEpoch: row.ordered_at_epoch,
    currency: row.currency,
    fxRateToUsd: row.fx_rate_to_usd,
    sourceGrossMinor: row.source_gross_minor,
    sourceDiscountMinor: row.source_discount_minor,
    sourceNetMinor: row.source_net_minor,
    sourceTaxMinor: row.source_tax_minor,
    sourceFreightMinor: row.source_freight_minor,
    sourceTotalMinor: row.source_total_minor,
    normalizedGrossMinor: row.normalized_gross_minor,
    normalizedDiscountMinor: row.normalized_discount_minor,
    normalizedNetMinor: row.normalized_net_minor,
    normalizedTaxMinor: row.normalized_tax_minor,
    normalizedFreightMinor: row.normalized_freight_minor,
    normalizedTotalMinor: row.normalized_total_minor,
    duplicateKey: row.duplicate_key,
    fingerprint: row.fingerprint,
    status: row.status,
    issueCount: row.issue_count,
    lineCount: row.line_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapExceptionRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    runId: row.run_id,
    sourceOrderId: row.source_order_id,
    orderId: row.order_id,
    stage: row.stage,
    code: row.code,
    severity: row.severity,
    reason: row.reason,
    details: row.details,
    createdAt: row.created_at
  };
}

function mapRunRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    correlationId: row.correlation_id,
    sourceReference: row.source_reference,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    totalOrders: row.total_orders,
    persistedOrders: row.persisted_orders,
    replayedOrders: row.replayed_orders,
    duplicateOrders: row.duplicate_orders,
    warningOrders: row.warning_orders,
    rejectedOrders: row.rejected_orders,
    exceptionCount: row.exception_count,
    summary: row.summary
  };
}

export async function createApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'LedgeProject Northwind Service',
        description: 'Northwind ingestion pipeline with canonical order storage and review APIs.',
        version: '1.0.0'
      },
      components: {
        securitySchemes: {
          apiKeyAuth: {
            type: 'apiKey',
            name: 'x-api-key',
            in: 'header'
          }
        }
      },
      security: [{ apiKeyAuth: [] }]
    }
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true
    }
  });

  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/health') || request.url.startsWith('/docs') || request.url.startsWith('/openapi.json')) {
      return;
    }

    const apiKey = request.headers['x-api-key'];
    if (typeof apiKey !== 'string' || apiKey !== dependencies.config.apiKey) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid API key.'
      });
    }
  });

  app.get('/health', async () => ({ ok: true }));

  app.post('/ingestions/run', {
    schema: {
      tags: ['ingestions'],
      summary: 'Run the Northwind ingestion pipeline',
      security: [{ apiKeyAuth: [] }]
    }
  }, async () => {
    const summary = await (dependencies.ingestRunner ?? (() => runIngestion({
      config: dependencies.config,
      repository: dependencies.repository,
      sourceDbPath: dependencies.config.runtimeDbPath
    })))();

    return summary;
  });

  app.get('/ingestions/runs', {
    schema: {
      tags: ['ingestions'],
      summary: 'List ingestion runs',
      security: [{ apiKeyAuth: [] }]
    }
  }, async (request) => {
    const query = request.query as { limit?: string };
    const limit = Number(query.limit ?? 50);
    const runs = await dependencies.repository.listRuns(limit);
    return { items: runs.map(mapRunRow) };
  });

  app.get('/orders', {
    schema: {
      tags: ['orders'],
      summary: 'List processed orders',
      security: [{ apiKeyAuth: [] }]
    }
  }, async (request) => {
    const query = request.query as { limit?: string };
    const limit = Number(query.limit ?? 100);
    const orders = await dependencies.repository.listOrders(limit);
    return { items: orders.map(mapOrderRow) };
  });

  app.get('/orders/:sourceOrderId', {
    schema: {
      tags: ['orders'],
      summary: 'Get a processed order by source id',
      security: [{ apiKeyAuth: [] }]
    }
  }, async (request, reply) => {
    const params = request.params as { sourceOrderId: string };
    const sourceOrderId = Number(params.sourceOrderId);
    const order = await dependencies.repository.findReplay(sourceOrderId);
    if (!order) {
      return reply.code(404).send({ error: 'Not found' });
    }

    return mapOrderRow(order as unknown as Record<string, unknown>);
  });

  app.get('/exceptions', {
    schema: {
      tags: ['exceptions'],
      summary: 'List ingestion exceptions',
      security: [{ apiKeyAuth: [] }]
    }
  }, async (request) => {
    const query = request.query as { limit?: string };
    const limit = Number(query.limit ?? 100);
    const exceptions = await dependencies.repository.listExceptions(limit);
    return { items: exceptions.map(mapExceptionRow) };
  });

  return app;
}
