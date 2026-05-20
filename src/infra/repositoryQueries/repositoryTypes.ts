export interface OrderRow {
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

export interface ExceptionRow {
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

export interface RunRow {
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
}

export interface QuerySpec {
  text: string;
  values: readonly unknown[];
}

export function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }

  return JSON.parse(value) as Record<string, unknown>;
}