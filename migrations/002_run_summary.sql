alter table ingest_runs
  add column if not exists source_reference_hash text;

alter table ingest_runs
  add column if not exists notes text;
