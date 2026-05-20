import { randomUUID } from 'node:crypto';
import { NormalizedLine, NormalizedOrder, RunSummary } from '../../domain.js';
import { QuerySpec } from './repositoryTypes.js';
import { buildLineValuePlaceholders } from './repositoryQueryUtils.js';

export function startRunQuery(runId: string, correlationId: string, sourceReference: string): QuerySpec {
  return {
    text: `
      insert into ingest_runs(id, correlation_id, source_reference, status, summary_json)
      values ($1, $2, $3, 'running', $4)
    `,
    values: [runId, correlationId, sourceReference, JSON.stringify({})]
  };
}

export function finishRunQuery(runId: string, summary: RunSummary, extra: Record<string, unknown>): QuerySpec {
  const summaryJson = {
    ...extra,
    startedAt: summary.startedAt,
    finishedAt: summary.finishedAt,
    durationMs: summary.durationMs
  };

  return {
    text: `
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
    values: [
      runId,
      summary.status,
      summary.totalOrders,
      summary.persistedOrders,
      summary.replayedOrders,
      summary.duplicateOrders,
      summary.warningOrders,
      summary.rejectedOrders,
      summary.exceptionCount,
      JSON.stringify(summaryJson)
    ]
  };
}

export function findReplayQuery(sourceOrderId: number): QuerySpec {
  return { text: 'select * from orders where source_order_id = $1 limit 1', values: [sourceOrderId] };
}

export function listPersistedSourceOrderIdsQuery(): QuerySpec {
  return { text: 'select source_order_id from orders', values: [] };
}

export function findPotentialDuplicateQuery(input: {
  customerId: string;
  duplicateKey: string;
  orderedAtEpoch: number;
  windowMinutes: number;
  sourceOrderId: number;
}): QuerySpec {
  return {
    text: `
      select *
      from orders
      where source_customer_id = $1
        and duplicate_key = $2
        and ordered_at_epoch between $3 - ($4 * 60) and $3 + ($4 * 60)
        and source_order_id <> $5
      limit 1
    `,
    values: [input.customerId, input.duplicateKey, input.orderedAtEpoch, input.windowMinutes, input.sourceOrderId]
  };
}

export function saveOrderQuery(order: NormalizedOrder, status: 'confirmed' | 'warning' | 'rejected', issueCount: number): QuerySpec {
  return {
    text: `
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
    values: [
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
  };
}

export function saveLinesQuery(orderId: string, sourceOrderId: number, lines: NormalizedLine[]): QuerySpec | null {
  if (lines.length === 0) {
    return null;
  }

  const valueCount = 18;
  const values: unknown[] = [];
  const placeholders = buildLineValuePlaceholders(lines.length, valueCount);

  for (const line of lines) {
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
  }

  return {
    text: `
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
  };
}

export function recordExceptionQuery(input: {
  runId: string;
  sourceOrderId: number | null;
  orderId: string | null;
  stage: string;
  code: string;
  severity: string;
  reason: string;
  details: Record<string, unknown>;
}): QuerySpec {
  return {
    text: `
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
    values: [
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
  };
}
