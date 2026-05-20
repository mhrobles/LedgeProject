import { NormalizedLine, NormalizedOrder, RunSummary } from '../domain.js';
import { SqlPool } from './sql.js';
import {
  finishRunQuery,
  findPotentialDuplicateQuery,
  findReplayQuery,
  listExceptionsQuery,
  listOrdersQuery,
  listPersistedSourceOrderIdsQuery,
  listRunsQuery,
  recordExceptionQuery,
  saveLinesQuery,
  saveOrderQuery,
  startRunQuery
} from './repositoryQueries/index.js';
import { ExceptionRow, OrderRow, parseJsonObject } from './repositoryQueries/repositoryTypes.js';

export class PostgresRepository {
  constructor(private readonly pool: SqlPool) {}

  async startRun(runId: string, correlationId: string, sourceReference: string): Promise<void> {
    const query = startRunQuery(runId, correlationId, sourceReference);
    await this.pool.query(query.text, query.values);
  }

  async finishRun(runId: string, summary: RunSummary, extra: Record<string, unknown>): Promise<void> {
    const query = finishRunQuery(runId, summary, extra);
    await this.pool.query(query.text, query.values);
  }

  async findReplay(sourceOrderId: number): Promise<OrderRow | null> {
    const query = findReplayQuery(sourceOrderId);
    const result = await this.pool.query<OrderRow>(query.text, query.values);
    return result.rows[0] ?? null;
  }

  async listPersistedSourceOrderIds(): Promise<Set<number>> {
    const query = listPersistedSourceOrderIdsQuery();
    const result = await this.pool.query<{ source_order_id: number }>(query.text, query.values);
    return new Set(result.rows.map((row) => row.source_order_id));
  }

  async findPotentialDuplicate(input: {
    customerId: string;
    duplicateKey: string;
    orderedAtEpoch: number;
    windowMinutes: number;
    sourceOrderId: number;
  }): Promise<OrderRow | null> {
    const query = findPotentialDuplicateQuery(input);
    const result = await this.pool.query<OrderRow>(query.text, query.values);

    return result.rows[0] ?? null;
  }

  async saveOrder(order: NormalizedOrder, status: 'confirmed' | 'warning' | 'rejected', issueCount: number): Promise<string> {
    const query = saveOrderQuery(order, status, issueCount);
    const result = await this.pool.query<{ id: string }>(query.text, query.values);

    return result.rows[0]!.id;
  }

  async saveLines(orderId: string, sourceOrderId: number, lines: NormalizedLine[]): Promise<void> {
    const query = saveLinesQuery(orderId, sourceOrderId, lines);
    if (!query) {
      return;
    }

    await this.pool.query(query.text, query.values);
  }

  async recordException(input: {
    runId: string;
    sourceOrderId: number | null;
    orderId: string | null;
    stage: string;
    code: string;
    severity: string;
    reason: string;
    details: Record<string, unknown>;
  }): Promise<void> {
    const query = recordExceptionQuery(input);
    await this.pool.query(query.text, query.values);
  }

  async listOrders(limit: number) {
    const query = listOrdersQuery(limit);
    const result = await this.pool.query<{
      id: string;
      source_order_id: number;
      source_customer_id: string;
      customer_company_name: string | null;
      customer_country: string | null;
      ship_country: string;
      ship_city: string | null;
      ship_region: string | null;
      ordered_at: string;
      ordered_at_epoch: number;
      currency: string;
      fx_rate_to_usd: string;
      source_gross_minor: number;
      source_discount_minor: number;
      source_net_minor: number;
      source_tax_minor: number;
      source_freight_minor: number;
      source_total_minor: number;
      normalized_gross_minor: number;
      normalized_discount_minor: number;
      normalized_net_minor: number;
      normalized_tax_minor: number;
      normalized_freight_minor: number;
      normalized_total_minor: number;
      duplicate_key: string;
      fingerprint: string;
      status: string;
      issue_count: number;
      created_at: string;
      updated_at: string;
      line_count: number;
    }>(query.text, query.values);

    return result.rows;
  }

  async listExceptions(limit: number) {
    const query = listExceptionsQuery(limit);
    const result = await this.pool.query<ExceptionRow>(query.text, query.values);

    return result.rows.map((row) => ({ ...row, details: parseJsonObject(row.details_json) }));
  }

  async listRuns(limit: number) {
    const query = listRunsQuery(limit);
    const result = await this.pool.query<{
      id: string;
      correlation_id: string;
      source_reference: string;
      status: string;
      started_at: string;
      finished_at: string | null;
      total_orders: number;
      persisted_orders: number;
      replayed_orders: number;
      duplicate_orders: number;
      warning_orders: number;
      rejected_orders: number;
      exception_count: number;
      summary_json: string;
    }>(query.text, query.values);

    return result.rows.map((row) => ({ ...row, summary: parseJsonObject(row.summary_json) }));
  }
}
