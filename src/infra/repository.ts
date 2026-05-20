import { randomUUID } from 'node:crypto';
import { NormalizedLine, NormalizedOrder, RunSummary } from '../domain.js';
import { SqlPool } from './sql.js';

interface OrderRow {
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
}

interface ExceptionRow {
  id: string;
  run_id: string;
  source_order_id: number | null;
  order_id: string | null;
  stage: string;
  code: string;
  severity: string;
  reason: string;
  details_json: string;
  created_at: string;
}

function parseJson(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }

  return JSON.parse(value) as Record<string, unknown>;
}

export class PostgresRepository {
  constructor(private readonly pool: SqlPool) {}

  async startRun(runId: string, correlationId: string, sourceReference: string): Promise<void> {
    await this.pool.query(
      `
        insert into ingest_runs(id, correlation_id, source_reference, status, summary_json)
        values ($1, $2, $3, 'running', $4)
      `,
      [runId, correlationId, sourceReference, JSON.stringify({})]
    );
  }

  async finishRun(runId: string, summary: RunSummary, extra: Record<string, unknown>): Promise<void> {
    await this.pool.query(
      `
        update ingest_runs
        set status = $2,
            finished_at = now(),
            total_orders = $3,
            persisted_orders = $4,
            replayed_orders = $5,
            duplicate_orders = $6,
            warning_orders = $7,
            rejected_orders = $8,
            exception_count = $9,
            summary_json = $10
        where id = $1
      `,
      [
        runId,
        summary.status,
        summary.totalOrders,
        summary.persistedOrders,
        summary.replayedOrders,
        summary.duplicateOrders,
        summary.warningOrders,
        summary.rejectedOrders,
        summary.exceptionCount,
        JSON.stringify(extra)
      ]
    );
  }

  async findReplay(sourceOrderId: number): Promise<OrderRow | null> {
    const result = await this.pool.query<OrderRow>('select * from orders where source_order_id = $1 limit 1', [sourceOrderId]);
    return result.rows[0] ?? null;
  }

  async listPersistedSourceOrderIds(): Promise<Set<number>> {
    const result = await this.pool.query<{ source_order_id: number }>('select source_order_id from orders');
    return new Set(result.rows.map((row) => row.source_order_id));
  }

  async findPotentialDuplicate(input: {
    customerId: string;
    duplicateKey: string;
    orderedAtEpoch: number;
    windowMinutes: number;
    sourceOrderId: number;
  }): Promise<OrderRow | null> {
    const result = await this.pool.query<OrderRow>(
      `
        select *
        from orders
        where source_customer_id = $1
          and duplicate_key = $2
          and ordered_at_epoch between $3 - ($4 * 60) and $3 + ($4 * 60)
          and source_order_id <> $5
        limit 1
      `,
      [input.customerId, input.duplicateKey, input.orderedAtEpoch, input.windowMinutes, input.sourceOrderId]
    );

    return result.rows[0] ?? null;
  }

  async saveOrder(order: NormalizedOrder, status: 'confirmed' | 'warning' | 'rejected', issueCount: number): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
        insert into orders (
          id,
          source_order_id,
          source_customer_id,
          customer_company_name,
          customer_country,
          ship_country,
          ship_city,
          ship_region,
          ordered_at,
          ordered_at_epoch,
          currency,
          fx_rate_to_usd,
          source_gross_minor,
          source_discount_minor,
          source_net_minor,
          source_tax_minor,
          source_freight_minor,
          source_total_minor,
          normalized_gross_minor,
          normalized_discount_minor,
          normalized_net_minor,
          normalized_tax_minor,
          normalized_freight_minor,
          normalized_total_minor,
          duplicate_key,
          fingerprint,
          status,
          issue_count,
          updated_at
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,now()
        )
        on conflict (source_order_id) do update set
          customer_company_name = excluded.customer_company_name,
          customer_country = excluded.customer_country,
          ship_country = excluded.ship_country,
          ship_city = excluded.ship_city,
          ship_region = excluded.ship_region,
          ordered_at = excluded.ordered_at,
          ordered_at_epoch = excluded.ordered_at_epoch,
          currency = excluded.currency,
          fx_rate_to_usd = excluded.fx_rate_to_usd,
          source_gross_minor = excluded.source_gross_minor,
          source_discount_minor = excluded.source_discount_minor,
          source_net_minor = excluded.source_net_minor,
          source_tax_minor = excluded.source_tax_minor,
          source_freight_minor = excluded.source_freight_minor,
          source_total_minor = excluded.source_total_minor,
          normalized_gross_minor = excluded.normalized_gross_minor,
          normalized_discount_minor = excluded.normalized_discount_minor,
          normalized_net_minor = excluded.normalized_net_minor,
          normalized_tax_minor = excluded.normalized_tax_minor,
          normalized_freight_minor = excluded.normalized_freight_minor,
          normalized_total_minor = excluded.normalized_total_minor,
          duplicate_key = excluded.duplicate_key,
          fingerprint = excluded.fingerprint,
          status = excluded.status,
          issue_count = excluded.issue_count,
          updated_at = now()
        returning id
      `,
      [
        randomUUID(),
        order.sourceOrderId,
        order.sourceCustomerId,
        order.customerCompanyName,
        order.customerCountry,
        order.shipCountry,
        order.shipCity,
        order.shipRegion,
        order.orderedAt,
        order.orderedAtEpoch,
        order.currency,
        order.fxRateToUsd,
        order.sourceGrossMinor,
        order.sourceDiscountMinor,
        order.sourceNetMinor,
        order.sourceTaxMinor,
        order.sourceFreightMinor,
        order.sourceTotalMinor,
        order.normalizedGrossMinor,
        order.normalizedDiscountMinor,
        order.normalizedNetMinor,
        order.normalizedTaxMinor,
        order.normalizedFreightMinor,
        order.normalizedTotalMinor,
        order.duplicateKey,
        order.fingerprint,
        status,
        issueCount
      ]
    );

    return result.rows[0]!.id;
  }

  async saveLines(orderId: string, sourceOrderId: number, lines: NormalizedLine[]): Promise<void> {
    if (lines.length === 0) {
      return;
    }

    const values: unknown[] = [];
    const placeholders = lines.map((line, index) => {
      const offset = index * 18;
      values.push(
        randomUUID(),
        orderId,
        sourceOrderId,
        line.productId,
        line.productName,
        line.quantity,
        line.sourceUnitPriceMinor,
        line.discountRate,
        line.sourceGrossMinor,
        line.sourceDiscountMinor,
        line.sourceNetMinor,
        line.sourceTaxMinor,
        line.normalizedUnitPriceMinor,
        line.normalizedGrossMinor,
        line.normalizedDiscountMinor,
        line.normalizedNetMinor,
        line.normalizedTaxMinor,
        line.lineFingerprint
      );

      return `(${Array.from({ length: 18 }, (_, placeholderIndex) => `$${offset + placeholderIndex + 1}`).join(',')})`;
    });

    await this.pool.query(
      `
        insert into order_lines (
          id,
          order_id,
          source_order_id,
          product_id,
          product_name,
          quantity,
          source_unit_price_minor,
          source_discount_rate,
          source_gross_minor,
          source_discount_minor,
          source_net_minor,
          source_tax_minor,
          normalized_unit_price_minor,
          normalized_gross_minor,
          normalized_discount_minor,
          normalized_net_minor,
          normalized_tax_minor,
          line_fingerprint
        ) values ${placeholders.join(',')}
        on conflict (source_order_id, product_id) do update set
          product_name = excluded.product_name,
          quantity = excluded.quantity,
          source_unit_price_minor = excluded.source_unit_price_minor,
          source_discount_rate = excluded.source_discount_rate,
          source_gross_minor = excluded.source_gross_minor,
          source_discount_minor = excluded.source_discount_minor,
          source_net_minor = excluded.source_net_minor,
          source_tax_minor = excluded.source_tax_minor,
          normalized_unit_price_minor = excluded.normalized_unit_price_minor,
          normalized_gross_minor = excluded.normalized_gross_minor,
          normalized_discount_minor = excluded.normalized_discount_minor,
          normalized_net_minor = excluded.normalized_net_minor,
          normalized_tax_minor = excluded.normalized_tax_minor,
          line_fingerprint = excluded.line_fingerprint
      `,
      values
    );
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
    await this.pool.query(
      `
        insert into ingest_exceptions (
          id,
          run_id,
          source_order_id,
          order_id,
          stage,
          code,
          severity,
          reason,
          details_json
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        randomUUID(),
        input.runId,
        input.sourceOrderId,
        input.orderId,
        input.stage,
        input.code,
        input.severity,
        input.reason,
        JSON.stringify(input.details)
      ]
    );
  }

  async listOrders(limit: number) {
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
    }>(
      `
        select
          o.id,
          o.source_order_id,
          o.source_customer_id,
          o.customer_company_name,
          o.customer_country,
          o.ship_country,
          o.ship_city,
          o.ship_region,
          o.ordered_at,
          o.ordered_at_epoch,
          o.currency,
          o.fx_rate_to_usd,
          o.source_gross_minor,
          o.source_discount_minor,
          o.source_net_minor,
          o.source_tax_minor,
          o.source_freight_minor,
          o.source_total_minor,
          o.normalized_gross_minor,
          o.normalized_discount_minor,
          o.normalized_net_minor,
          o.normalized_tax_minor,
          o.normalized_freight_minor,
          o.normalized_total_minor,
          o.duplicate_key,
          o.fingerprint,
          o.status,
          o.issue_count,
          o.created_at,
          o.updated_at,
          coalesce(lines.line_count, 0) as line_count
        from orders o
        left join (
          select source_order_id, count(*) as line_count
          from order_lines
          group by source_order_id
        ) lines on lines.source_order_id = o.source_order_id
        order by o.ordered_at_epoch desc, o.source_order_id desc
        limit $1
      `,
      [limit]
    );

    return result.rows;
  }

  async listExceptions(limit: number) {
    const result = await this.pool.query<ExceptionRow>(
      `
        select *
        from ingest_exceptions
        order by created_at desc
        limit $1
      `,
      [limit]
    );

    return result.rows.map((row) => ({ ...row, details: parseJson(row.details_json) }));
  }

  async listRuns(limit: number) {
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
    }>('select * from ingest_runs order by started_at desc limit $1', [limit]);

    return result.rows.map((row) => ({ ...row, summary: parseJson(row.summary_json) }));
  }
}
