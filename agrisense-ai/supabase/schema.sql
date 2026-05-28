-- ============================================================
-- AgriSense AI — Supabase Database Schema
-- ============================================================
-- Run this in the Supabase SQL Editor to create all tables.

-- Enable the pg_cron extension if you want scheduled aggregations (optional)
-- create extension if not exists pg_cron;

-- ─── 1. sensor_logs ─────────────────────────────────────────
-- Primary table: stores every MQTT message from the ESP8266.
create table if not exists public.sensor_logs (
  id              bigserial primary key,
  temperature     numeric(5, 2)  not null check (temperature between -40 and 125),
  humidity        numeric(5, 2)  not null check (humidity between 0 and 100),
  soil_moisture   smallint       not null check (soil_moisture between 0 and 100),
  -- Raw ADC value from ESP8266 (0–1023), kept for recalibration
  soil_raw_adc    smallint       not null check (soil_raw_adc between 0 and 1023),
  pump_status     boolean        not null default false,
  -- Derived / enriched fields
  mqtt_topic      text           not null default 'iot/tanaman/data',
  created_at      timestamptz    not null default now()
);

-- Index for time-series queries (dashboards, charts)
create index if not exists idx_sensor_logs_created_at
  on public.sensor_logs (created_at desc);

-- Index for pump status queries
create index if not exists idx_sensor_logs_pump
  on public.sensor_logs (pump_status, created_at desc);

-- ─── 2. alert_logs ──────────────────────────────────────────
-- Stores alerts generated when sensor thresholds are breached.
create table if not exists public.alert_logs (
  id              bigserid primary key,
  severity        text        not null check (severity in ('low', 'medium', 'high')),
  alert_type      text        not null check (alert_type in ('warning', 'error', 'success', 'info')),
  title           text        not null,
  description     text        not null,
  resolved        boolean     not null default false,
  resolved_at     timestamptz,
  -- Link to the sensor reading that triggered the alert
  sensor_log_id   bigint      references public.sensor_logs (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_alert_logs_resolved
  on public.alert_logs (resolved, created_at desc);

-- ─── 3. pump_events ─────────────────────────────────────────
-- Stores pump state transitions for irrigation history.
create table if not exists public.pump_events (
  id              bigserial primary key,
  pump_on         boolean     not null,
  trigger_source  text        not null check (trigger_source in ('mqtt_auto', 'manual', 'threshold')),
  soil_moisture   smallint,   -- moisture at the time of activation
  duration_sec    integer,    -- filled in when pump turns off
  created_at      timestamptz not null default now()
);

-- ─── 4. daily_aggregates (materialized view) ─────────────────
-- Pre-aggregated daily stats for the Analytics page.
create materialized view if not exists public.daily_aggregates as
  select
    date_trunc('day', created_at at time zone 'Asia/Jakarta') as day,
    round(avg(temperature)::numeric,    2) as avg_temperature,
    round(avg(humidity)::numeric,       2) as avg_humidity,
    round(avg(soil_moisture)::numeric,  1) as avg_soil_moisture,
    min(soil_moisture)                     as min_soil_moisture,
    max(soil_moisture)                     as max_soil_moisture,
    count(*)                               as reading_count,
    count(*) filter (where pump_status)    as pump_active_count
  from public.sensor_logs
  group by 1
  order by 1 desc
with data;

create unique index if not exists idx_daily_aggregates_day
  on public.daily_aggregates (day);

-- Refresh daily (set this up as a Supabase scheduled function or pg_cron job)
-- select cron.schedule('refresh-daily-agg', '0 0 * * *', 'refresh materialized view concurrently public.daily_aggregates');

-- ─── Row-Level Security (RLS) ────────────────────────────────
-- Enable RLS on all tables
alter table public.sensor_logs   enable row level security;
alter table public.alert_logs    enable row level security;
alter table public.pump_events   enable row level security;

-- Allow service-role (backend) full access
create policy "service_role_sensor_logs"   on public.sensor_logs   for all using (true);
create policy "service_role_alert_logs"    on public.alert_logs    for all using (true);
create policy "service_role_pump_events"   on public.pump_events   for all using (true);

-- Allow anon read-only access for the dashboard (adjust as needed)
create policy "anon_read_sensor_logs" on public.sensor_logs for select using (true);
create policy "anon_read_alert_logs"  on public.alert_logs  for select using (true);
create policy "anon_read_pump_events" on public.pump_events for select using (true);
