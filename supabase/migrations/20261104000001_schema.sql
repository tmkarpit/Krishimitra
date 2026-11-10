-- KrishiMitra core schema
-- Reference data (crops, schemes, languages) is world-readable; everything a farmer
-- creates carries a user_id so RLS can be a simple `user_id = auth.uid()` check.

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.farmer_type as enum ('marginal', 'small', 'semi_medium', 'medium', 'large');
create type public.land_unit as enum ('acre', 'hectare', 'bigha', 'guntha', 'kanal');
create type public.irrigation_type as enum ('rainfed', 'canal', 'borewell', 'well', 'drip', 'sprinkler', 'pond');
create type public.season as enum ('kharif', 'rabi', 'zaid', 'perennial');
create type public.plan_status as enum ('planned', 'active', 'harvested', 'abandoned');
create type public.task_status as enum ('pending', 'done', 'skipped');
create type public.alert_severity as enum ('info', 'warning', 'severe');
create type public.message_role as enum ('user', 'assistant');
create type public.user_role as enum ('farmer', 'expert', 'admin');
create type public.soil_source as enum ('soilgrids', 'regional', 'soil_health_card', 'manual', 'lab');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
create table public.languages (
  code text primary key,               -- ISO 639-1: en, hi, mr ...
  bcp47 text not null,                 -- en-IN, hi-IN ... used for STT/TTS
  name_english text not null,
  name_native text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.states (
  code text primary key,               -- ISO 3166-2:IN suffix, e.g. MH
  name text not null unique,
  -- Dominant soil of the state (NBSS&LUP major soil groups). Used when SoilGrids has
  -- no coverage for a point, which is common in India.
  soil_texture text,
  soil_ph numeric,
  soil_group text
);

create table public.crops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,           -- matches ML model labels where applicable
  scientific_name text,
  family text not null,                -- poaceae, fabaceae ... used for rotation rules
  category text not null check (category in ('cereal','millet','pulse','oilseed','vegetable','fruit','cash','spice','fibre','plantation')),
  seasons public.season[] not null,
  duration_days_min int not null,
  duration_days_max int not null,
  temp_min numeric not null,           -- °C, optimal growing range
  temp_max numeric not null,
  rainfall_min_mm numeric not null,    -- water need over the crop season
  rainfall_max_mm numeric not null,
  humidity_min numeric not null default 30,
  humidity_max numeric not null default 90,
  ph_min numeric not null,
  ph_max numeric not null,
  water_requirement text not null check (water_requirement in ('low','medium','high')),
  soil_textures text[] not null,       -- sandy, loamy, clayey, silty, sandy_loam, clay_loam
  n_req_kg_ha numeric not null,        -- recommended N
  p_req_kg_ha numeric not null,        -- recommended P2O5
  k_req_kg_ha numeric not null,        -- recommended K2O
  avg_yield_q_ha numeric not null,
  cost_per_ha_inr numeric not null,
  default_price_inr_q numeric not null,  -- fallback when no mandi data
  msp_inr_q numeric,
  agmarknet_commodity text,            -- commodity name used by data.gov.in Agmarknet
  emoji text not null default '🌱',
  is_active boolean not null default true
);

create table public.crop_translations (
  crop_id uuid not null references public.crops(id) on delete cascade,
  language_code text not null references public.languages(code),
  name text not null,
  description text,
  primary key (crop_id, language_code)
);

create table public.fertilizers (
  slug text primary key,
  name text not null,
  n_pct numeric not null,
  p_pct numeric not null,
  k_pct numeric not null,
  price_per_kg_inr numeric not null
);

create table public.schemes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  level text not null check (level in ('central','state')),
  state_code text references public.states(code),
  official_url text not null,
  eligible_farmer_types public.farmer_type[],  -- null = all
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.scheme_translations (
  scheme_id uuid not null references public.schemes(id) on delete cascade,
  language_code text not null references public.languages(code),
  title text not null,
  summary text not null,
  benefits text,
  eligibility text,
  how_to_apply text,
  primary key (scheme_id, language_code)
);

-- ---------------------------------------------------------------------------
-- Users & farms
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role public.user_role not null default 'farmer',
  language_code text not null default 'en' references public.languages(code),
  state_code text references public.states(code),
  district text,
  village text,
  farmer_type public.farmer_type,
  land_unit public.land_unit not null default 'acre',
  voice_autoplay boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  -- client sends lat/lng + boundary_coords; the trigger derives the geography columns
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  boundary_coords jsonb,               -- [{"latitude":..,"longitude":..}, ...]
  boundary extensions.geography(Polygon, 4326),
  centroid extensions.geography(Point, 4326),
  area_sq_m numeric,
  state_code text references public.states(code),
  district text,
  village text,
  irrigation public.irrigation_type not null default 'rainfed',
  previous_crop_slug text,
  elevation_m numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fields_user_idx on public.fields(user_id);
create index fields_centroid_idx on public.fields using gist(centroid);

create or replace function public.fields_derive_geo()
returns trigger language plpgsql
set search_path = public, extensions
as $$
declare
  ring text;
  pts jsonb;
begin
  new.centroid := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  pts := new.boundary_coords;
  if pts is not null and jsonb_typeof(pts) = 'array' and jsonb_array_length(pts) >= 3 then
    select string_agg((p->>'longitude') || ' ' || (p->>'latitude'), ',' order by ord)
      into ring
      from jsonb_array_elements(pts) with ordinality as t(p, ord);
    -- close the ring
    ring := ring || ',' || (pts->0->>'longitude') || ' ' || (pts->0->>'latitude');
    new.boundary := st_geogfromtext('SRID=4326;POLYGON((' || ring || '))');
    new.area_sq_m := round(st_area(new.boundary)::numeric, 1);
  else
    new.boundary := null;
    -- keep a client-provided area for pin-only fields
  end if;
  return new;
end;
$$;
create trigger fields_derive_geo before insert or update of lat, lng, boundary_coords, area_sq_m on public.fields
  for each row execute function public.fields_derive_geo();
create trigger fields_updated_at before update on public.fields
  for each row execute function public.set_updated_at();

create table public.field_crop_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  crop_slug text not null,
  season public.season not null,
  year int not null,
  yield_q numeric,
  created_at timestamptz not null default now()
);

create table public.soil_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  source public.soil_source not null,
  n_kg_ha numeric,          -- available N
  p_kg_ha numeric,          -- available P
  k_kg_ha numeric,          -- available K
  ph numeric,
  organic_carbon_pct numeric,
  ec numeric,
  sand_pct numeric,
  silt_pct numeric,
  clay_pct numeric,
  cec numeric,
  texture text,
  micronutrients jsonb,
  card_image_path text,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index soil_profiles_field_idx on public.soil_profiles(field_id, created_at desc);

create table public.weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  current jsonb not null,
  daily jsonb not null,           -- 7-day forecast
  climate jsonb not null,         -- monthly aggregates over the past year
  fetched_at timestamptz not null default now()
);
create index weather_field_idx on public.weather_snapshots(field_id, fetched_at desc);

-- ---------------------------------------------------------------------------
-- AI outputs
-- ---------------------------------------------------------------------------
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  season public.season not null,
  year int not null,
  input_features jsonb not null,
  results jsonb not null,         -- ranked crops with scores, economics and explanations
  summary text,
  language_code text not null,
  model_version text not null,
  created_at timestamptz not null default now()
);
create index recommendations_field_idx on public.recommendations(field_id, created_at desc);

create table public.crop_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  crop_id uuid not null references public.crops(id),
  recommendation_id uuid references public.recommendations(id) on delete set null,
  season public.season not null,
  sowing_date date not null,
  expected_harvest_date date,
  status public.plan_status not null default 'active',
  fertilizer_plan jsonb not null,
  guidance jsonb not null,
  language_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crop_plans_user_idx on public.crop_plans(user_id, status);
create trigger crop_plans_updated_at before update on public.crop_plans
  for each row execute function public.set_updated_at();

create table public.crop_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.crop_plans(id) on delete cascade,
  stage text not null,
  title text not null,
  description text,
  due_date date not null,
  status public.task_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index crop_plan_tasks_plan_idx on public.crop_plan_tasks(plan_id, due_date);
create index crop_plan_tasks_user_due_idx on public.crop_plan_tasks(user_id, due_date) where status = 'pending';

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  field_id uuid references public.fields(id) on delete set null,
  title text,
  language_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger chat_sessions_updated_at before update on public.chat_sessions
  for each row execute function public.set_updated_at();

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role public.message_role not null,
  content text not null,
  image_path text,
  tokens_in int,
  tokens_out int,
  created_at timestamptz not null default now()
);
create index chat_messages_session_idx on public.chat_messages(session_id, created_at);

create table public.disease_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  field_id uuid references public.fields(id) on delete set null,
  image_path text not null,
  crop_name text,
  disease_name text,
  is_healthy boolean,
  confidence numeric,
  severity text,
  result jsonb not null,
  language_code text not null,
  expert_reviewed boolean not null default false,
  expert_notes text,
  created_at timestamptz not null default now()
);
create index disease_reports_user_idx on public.disease_reports(user_id, created_at desc);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  field_id uuid references public.fields(id) on delete cascade,
  type text not null check (type in ('heavy_rain','rain','heat','cold','frost','wind','task','price')),
  severity public.alert_severity not null,
  -- values for client-side i18n templates (e.g. {"mm": 64, "date": "2026-11-06"})
  data jsonb not null default '{}',
  valid_on date not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  unique (field_id, type, valid_on)
);
create index alerts_user_idx on public.alerts(user_id, created_at desc);

create table public.market_prices (
  id bigint generated always as identity primary key,
  state text not null,
  district text not null,
  market text not null,
  commodity text not null,
  variety text not null default '',
  arrival_date date not null,
  min_price numeric,
  max_price numeric,
  modal_price numeric,
  unique (market, commodity, variety, arrival_date)
);
create index market_prices_lookup_idx on public.market_prices(commodity, state, arrival_date desc);

create table public.harvest_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.crop_plans(id) on delete cascade,
  actual_yield_q numeric,
  sale_price_inr_q numeric,
  rating int check (rating between 1 and 5),
  comments text,
  created_at timestamptz not null default now()
);

create table public.usage_counters (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null default current_date,
  kind text not null,
  count int not null default 0,
  primary key (user_id, day, kind)
);

create table public.api_cache (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Auth hook: create a profile for every new user (phone or anonymous)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  lang text := coalesce(new.raw_user_meta_data->>'language', 'en');
begin
  if not exists (select 1 from public.languages where code = lang) then
    lang := 'en';
  end if;
  insert into public.profiles (id, phone, language_code)
  values (new.id, new.phone, lang)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
-- Atomically bump a per-user daily counter; returns false once the limit is hit.
create or replace function public.increment_usage(p_user uuid, p_kind text, p_limit int)
returns boolean language plpgsql security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into public.usage_counters (user_id, day, kind, count)
  values (p_user, current_date, p_kind, 1)
  on conflict (user_id, day, kind) do update set count = usage_counters.count + 1
  returning count into new_count;
  return new_count <= p_limit;
end;
$$;
revoke execute on function public.increment_usage(uuid, text, int) from public, anon, authenticated;

-- Latest modal price per market for a commodity, newest first.
create or replace function public.latest_prices(p_commodity text, p_state text default null, p_limit int default 30)
returns setof public.market_prices language sql stable
as $$
  select distinct on (market) *
  from public.market_prices
  where commodity = p_commodity
    and (p_state is null or state = p_state)
  order by market, arrival_date desc
  limit p_limit;
$$;
