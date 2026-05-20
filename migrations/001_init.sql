create table if not exists ingest_runs (
  id text primary key,
  correlation_id text not null,
  source_reference text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_orders integer not null default 0,
  persisted_orders integer not null default 0,
  replayed_orders integer not null default 0,
  duplicate_orders integer not null default 0,
  warning_orders integer not null default 0,
  rejected_orders integer not null default 0,
  exception_count integer not null default 0,
  summary_json text not null default '{}'
);

create table if not exists orders (
  id text primary key,
  source_order_id integer not null unique,
  source_customer_id text not null,
  customer_company_name text,
  customer_country text,
  ship_country text not null,
  ship_city text,
  ship_region text,
  ordered_at timestamptz not null,
  ordered_at_epoch integer not null,
  currency text not null,
  fx_rate_to_usd numeric not null,
  source_gross_minor bigint not null,
  source_discount_minor bigint not null,
  source_net_minor bigint not null,
  source_tax_minor bigint not null,
  source_freight_minor bigint not null,
  source_total_minor bigint not null,
  normalized_gross_minor bigint not null,
  normalized_discount_minor bigint not null,
  normalized_net_minor bigint not null,
  normalized_tax_minor bigint not null,
  normalized_freight_minor bigint not null,
  normalized_total_minor bigint not null,
  duplicate_key text not null,
  fingerprint text not null unique,
  status text not null,
  issue_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_duplicate_key_idx on orders (source_customer_id, duplicate_key, ordered_at_epoch);
create index if not exists orders_status_idx on orders (status);
create index if not exists orders_created_idx on orders (created_at desc);

create table if not exists order_lines (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  source_order_id integer not null,
  product_id integer not null,
  product_name text not null,
  quantity integer not null,
  source_unit_price_minor bigint not null,
  source_discount_rate numeric not null,
  source_gross_minor bigint not null,
  source_discount_minor bigint not null,
  source_net_minor bigint not null,
  source_tax_minor bigint not null,
  normalized_unit_price_minor bigint not null,
  normalized_gross_minor bigint not null,
  normalized_discount_minor bigint not null,
  normalized_net_minor bigint not null,
  normalized_tax_minor bigint not null,
  line_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique(source_order_id, product_id)
);

create index if not exists order_lines_order_idx on order_lines (order_id);

create table if not exists ingest_exceptions (
  id text primary key,
  run_id text not null references ingest_runs(id) on delete cascade,
  source_order_id integer,
  order_id text references orders(id) on delete set null,
  stage text not null,
  code text not null,
  severity text not null,
  reason text not null,
  details_json text not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ingest_exceptions_run_idx on ingest_exceptions (run_id, created_at desc);
create index if not exists ingest_exceptions_code_idx on ingest_exceptions (code);
