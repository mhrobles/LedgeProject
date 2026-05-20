import { randomUUID } from 'node:crypto';
import { AppConfig } from '../config.js';
import { NormalizedOrder, RunSummary, SourceOrder } from '../domain.js';
import { createLogger } from '../logger.js';
import { loadNorthwindOrders } from '../infra/sourceDb.js';
import { validateSourceOrders } from './validate.js';
import { normalizeOrder } from './normalize.js';
import { analyzeConsistency } from './rules.js';
import { PostgresRepository } from '../infra/repository.js';

function formatDurationSeconds(durationMs: number): string {
  return (durationMs / 1000).toFixed(3);
}

export interface RunIngestionDependencies {
  config: AppConfig;
  repository: PostgresRepository;
  sourceDbPath: string;
}

export async function runIngestion(dependencies: RunIngestionDependencies): Promise<RunSummary> {
  const sourceOrders = validateSourceOrders(await loadNorthwindOrders(dependencies.sourceDbPath));
  return processSourceOrders({
    config: dependencies.config,
    repository: dependencies.repository,
    sourceDbPath: dependencies.sourceDbPath,
    sourceOrders
  });
}

export async function processSourceOrders(dependencies: RunIngestionDependencies & { sourceOrders: SourceOrder[] }): Promise<RunSummary> {
  const logger = createLogger();
  const runId = randomUUID();
  const correlationId = randomUUID();
  const runLogger = logger.child({ runId, correlationId, pipeline: 'northwind-ingest' });
  const startedAt = new Date();

  await dependencies.repository.startRun(runId, correlationId, dependencies.sourceDbPath);

  const summary: RunSummary = {
    runId,
    correlationId,
    status: 'running',
    startedAt: startedAt.toISOString(),
    finishedAt: null,
    durationMs: 0,
    totalOrders: 0,
    persistedOrders: 0,
    replayedOrders: 0,
    duplicateOrders: 0,
    warningOrders: 0,
    rejectedOrders: 0,
    exceptionCount: 0
  };

  try {
    runLogger.info({ stage: 'ingest', sourceDbPath: dependencies.sourceDbPath }, 'Loading Northwind snapshot');
    const sourceOrders = dependencies.sourceOrders;
    const persistedSourceOrderIds = await dependencies.repository.listPersistedSourceOrderIds();

    for (const sourceOrder of sourceOrders) {
      summary.totalOrders += 1;
      const orderLogger = runLogger.child({ stage: 'order', sourceOrderId: sourceOrder.orderId, customerId: sourceOrder.customerId });

      try {
        const normalizedOrder = normalizeOrder(sourceOrder, {
          baseCurrency: dependencies.config.fxBaseCurrency,
          windowMinutes: dependencies.config.ingestionWindowMinutes
        });

        if (persistedSourceOrderIds.has(normalizedOrder.sourceOrderId)) {
          summary.replayedOrders += 1;
          orderLogger.info({ action: 'replayed' }, 'Skipping already imported source order');
          continue;
        }

        const duplicate = await dependencies.repository.findPotentialDuplicate({
          customerId: normalizedOrder.sourceCustomerId,
          duplicateKey: normalizedOrder.duplicateKey,
          orderedAtEpoch: normalizedOrder.orderedAtEpoch,
          windowMinutes: dependencies.config.ingestionWindowMinutes,
          sourceOrderId: normalizedOrder.sourceOrderId
        });

        if (duplicate) {
          summary.duplicateOrders += 1;
          summary.exceptionCount += 1;
          await dependencies.repository.recordException({
            runId,
            sourceOrderId: normalizedOrder.sourceOrderId,
            orderId: null,
            stage: 'dedupe',
            code: 'duplicate_window_hash',
            severity: 'warning',
            reason: 'Duplicate order detected by customer/time-window/hash rule.',
            details: {
              duplicateOrderId: duplicate.id,
              duplicateKey: normalizedOrder.duplicateKey,
              windowMinutes: dependencies.config.ingestionWindowMinutes
            }
          });
          orderLogger.warn({ action: 'duplicate', duplicateOrderId: duplicate.id }, 'Duplicate order skipped');
          continue;
        }

        const issues = analyzeConsistency(normalizedOrder);
        const status = issues.some((issue) => issue.severity === 'error') ? 'rejected' : issues.length > 0 ? 'warning' : 'confirmed';

        const orderId = await dependencies.repository.saveOrder(normalizedOrder, status, issues.length);
        await dependencies.repository.saveLines(orderId, normalizedOrder.sourceOrderId, normalizedOrder.lines);

        for (const issue of issues) {
          summary.exceptionCount += 1;
          await dependencies.repository.recordException({
            runId,
            sourceOrderId: normalizedOrder.sourceOrderId,
            orderId,
            stage: issue.stage,
            code: issue.code,
            severity: issue.severity,
            reason: issue.message,
            details: issue.details
          });
        }

        if (status === 'warning') {
          summary.warningOrders += 1;
        } else if (status === 'rejected') {
          summary.rejectedOrders += 1;
        }

        summary.persistedOrders += 1;
        orderLogger.info({ action: 'persisted', status, issueCount: issues.length }, 'Order stored');
      } catch (error) {
        summary.rejectedOrders += 1;
        summary.exceptionCount += 1;
        await dependencies.repository.recordException({
          runId,
          sourceOrderId: sourceOrder.orderId,
          orderId: null,
          stage: 'validate',
          code: 'validation_error',
          severity: 'error',
          reason: error instanceof Error ? error.message : 'Unexpected pipeline error',
          details: {
            error: error instanceof Error ? error.stack : String(error)
          }
        });
        orderLogger.error({ err: error }, 'Order failed');
      }
    }

    summary.status = 'completed';
    const finishedAt = new Date();
    summary.finishedAt = finishedAt.toISOString();
    summary.durationMs = finishedAt.getTime() - startedAt.getTime();
    const durationSeconds = formatDurationSeconds(summary.durationMs);
    await dependencies.repository.finishRun(runId, summary, {
      correlationId,
      sourceDbPath: dependencies.sourceDbPath,
      startedAt: summary.startedAt,
      finishedAt: summary.finishedAt,
      durationMs: summary.durationMs,
      durationSeconds,
      persistedOrders: summary.persistedOrders,
      duplicateOrders: summary.duplicateOrders
    });
    runLogger.info({ summary, durationSeconds: Number(durationSeconds) }, `Ingestion finished in ${durationSeconds}s`);
    return summary;
  } catch (error) {
    summary.status = 'failed';
    const finishedAt = new Date();
    summary.finishedAt = finishedAt.toISOString();
    summary.durationMs = finishedAt.getTime() - startedAt.getTime();
    const durationSeconds = formatDurationSeconds(summary.durationMs);
    await dependencies.repository.finishRun(runId, summary, {
      correlationId,
      startedAt: summary.startedAt,
      finishedAt: summary.finishedAt,
      durationMs: summary.durationMs,
      durationSeconds,
      error: error instanceof Error ? error.message : String(error)
    });
    runLogger.error({ err: error, durationSeconds: Number(durationSeconds), summary }, `Ingestion aborted after ${durationSeconds}s`);
    throw error;
  }
}
