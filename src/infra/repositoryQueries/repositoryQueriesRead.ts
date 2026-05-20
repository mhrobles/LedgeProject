import { QuerySpec } from './repositoryTypes.js';

export function listOrdersQuery(limit: number): QuerySpec {
  return {
    text: `
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
    values: [limit]
  };
}

export function listExceptionsQuery(limit: number): QuerySpec {
  return { text: 'select * from ingest_exceptions order by created_at desc limit $1', values: [limit] };
}

export function listRunsQuery(limit: number): QuerySpec {
  return { text: 'select * from ingest_runs order by started_at desc limit $1', values: [limit] };
}
