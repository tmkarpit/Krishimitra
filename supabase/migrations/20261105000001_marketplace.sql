-- Marketplace: AI crop valuation, direct produce sales to buyers, and a seed/input shop.

-- Who the user is in the marketplace. Unlike `role`, users pick this themselves.
alter table public.profiles
  add column account_type text not null default 'farmer'
  check (account_type in ('farmer', 'buyer', 'seller'));

-- ---------------------------------------------------------------------------
-- AI crop valuation: photos of the field/crop -> land type, stage, yield and ₹ value
-- ---------------------------------------------------------------------------
create table public.crop_valuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  field_id uuid references public.fields(id) on delete set null,
  crop_slug text,
  image_paths text[] not null,
  area_sq_m numeric not null,
  land_type text,
  growth_stage text,
  health text,
  expected_yield_q numeric,
  value_low_inr numeric,
  value_high_inr numeric,
  price_inr_q numeric,
  price_source text,
  result jsonb not null,
  language_code text not null,
  created_at timestamptz not null default now()
);
create index crop_valuations_user_idx on public.crop_valuations(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Produce listings: farmers sell directly; buyers contact them
-- ---------------------------------------------------------------------------
create table public.produce_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  field_id uuid references public.fields(id) on delete set null,
  valuation_id uuid references public.crop_valuations(id) on delete set null,
  crop_slug text not null,
  crop_name text not null,            -- as the farmer wants it shown (any language)
  variety text,
  quantity_q numeric not null check (quantity_q > 0),
  price_inr_q numeric not null check (price_inr_q > 0),
  negotiable boolean not null default true,
  quality_note text,
  available_from date not null default current_date,
  description text,
  photo_urls text[] not null default '{}',
  state_code text references public.states(code),
  district text,
  village text,
  lat double precision,
  lng double precision,
  -- Shown to every signed-in user: the farmer enters them knowingly when listing.
  contact_name text not null,
  contact_phone text not null check (contact_phone ~ '^\+?[0-9]{10,13}$'),
  whatsapp boolean not null default true,
  status text not null default 'active' check (status in ('active', 'sold', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index produce_listings_active_idx on public.produce_listings(status, crop_slug, created_at desc);
create index produce_listings_user_idx on public.produce_listings(user_id);
create trigger produce_listings_updated_at before update on public.produce_listings
  for each row execute function public.set_updated_at();

create table public.listing_enquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.produce_listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  buyer_name text not null,
  buyer_phone text not null check (buyer_phone ~ '^\+?[0-9]{10,13}$'),
  offered_price_inr_q numeric check (offered_price_inr_q > 0),
  quantity_q numeric check (quantity_q > 0),
  message text,
  status text not null default 'new' check (status in ('new', 'seen', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);
create index listing_enquiries_listing_idx on public.listing_enquiries(listing_id, created_at desc);
create index listing_enquiries_buyer_idx on public.listing_enquiries(buyer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Seed / input shop
-- ---------------------------------------------------------------------------
create table public.input_products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.profiles(id) on delete cascade,  -- null = sample catalogue item
  seller_name text not null,
  seller_phone text,
  category text not null default 'seed' check (category in ('seed', 'fertilizer', 'biofertilizer', 'pesticide', 'tool')),
  crop_slug text,
  name text not null,
  variety text,
  pack_size text not null,             -- e.g. "40 kg bag", "450 g packet"
  price_inr numeric not null check (price_inr > 0),
  mrp_inr numeric,
  stock int not null default 0 check (stock >= 0),
  certified boolean not null default false,
  description text,
  image_url text,
  delivery_states text[],              -- null = all India
  is_sample boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index input_products_lookup_idx on public.input_products(is_active, category, crop_slug);
create trigger input_products_updated_at before update on public.input_products
  for each row execute function public.set_updated_at();

create table public.input_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.input_products(id) on delete restrict,
  seller_id uuid references public.profiles(id) on delete set null,
  product_name text not null,
  quantity int not null check (quantity between 1 and 1000),
  unit_price_inr numeric not null,
  total_inr numeric not null,
  delivery_name text not null,
  delivery_phone text not null check (delivery_phone ~ '^\+?[0-9]{10,13}$'),
  delivery_address text not null,
  payment_method text not null default 'cod' check (payment_method in ('cod')),
  status text not null default 'placed' check (status in ('placed', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index input_orders_buyer_idx on public.input_orders(buyer_id, created_at desc);
create index input_orders_seller_idx on public.input_orders(seller_id, created_at desc);
create trigger input_orders_updated_at before update on public.input_orders
  for each row execute function public.set_updated_at();

-- Price, seller and totals come from the product, never from the client; stock is reserved.
create or replace function public.input_orders_before_insert()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  p public.input_products;
begin
  select * into p from public.input_products where id = new.product_id and is_active for update;
  if not found then raise exception 'product unavailable'; end if;
  if p.stock < new.quantity then raise exception 'not enough stock'; end if;
  new.seller_id := p.seller_id;
  new.product_name := p.name || ' (' || p.pack_size || ')';
  new.unit_price_inr := p.price_inr;
  new.total_inr := p.price_inr * new.quantity;
  new.status := 'placed';
  new.payment_method := 'cod';
  update public.input_products set stock = stock - new.quantity where id = p.id;
  return new;
end;
$$;
create trigger input_orders_before_insert before insert on public.input_orders
  for each row execute function public.input_orders_before_insert();

-- Buyers may only cancel; sellers move orders forward. Cancelling returns the stock.
create or replace function public.input_orders_before_update()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.buyer_id <> old.buyer_id or new.product_id <> old.product_id or new.quantity <> old.quantity
     or new.unit_price_inr <> old.unit_price_inr or new.total_inr <> old.total_inr
     or new.seller_id is distinct from old.seller_id then
    raise exception 'order details cannot be changed';
  end if;
  if old.status in ('delivered', 'cancelled') and new.status <> old.status then
    raise exception 'order is closed';
  end if;
  if auth.uid() = old.buyer_id and auth.uid() is distinct from old.seller_id
     and new.status <> old.status and new.status <> 'cancelled' then
    raise exception 'buyers can only cancel';
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.input_products set stock = stock + old.quantity where id = old.product_id;
  end if;
  return new;
end;
$$;
create trigger input_orders_before_update before update on public.input_orders
  for each row execute function public.input_orders_before_update();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.crop_valuations enable row level security;
create policy "own valuations read" on public.crop_valuations for select to authenticated using (user_id = auth.uid());
create policy "own valuations delete" on public.crop_valuations for delete to authenticated using (user_id = auth.uid());

alter table public.produce_listings enable row level security;
create policy "active listings readable" on public.produce_listings for select to authenticated
  using (status = 'active' or user_id = auth.uid());
create policy "own listings insert" on public.produce_listings for insert to authenticated
  with check (user_id = auth.uid());
create policy "own listings update" on public.produce_listings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own listings delete" on public.produce_listings for delete to authenticated
  using (user_id = auth.uid());

alter table public.listing_enquiries enable row level security;
create policy "enquiry insert by buyer" on public.listing_enquiries for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and exists (select 1 from public.produce_listings l where l.id = listing_id and l.status = 'active' and l.user_id <> auth.uid())
  );
create policy "enquiry read by buyer or seller" on public.listing_enquiries for select to authenticated
  using (buyer_id = auth.uid()
         or exists (select 1 from public.produce_listings l where l.id = listing_id and l.user_id = auth.uid()));
create policy "enquiry status by seller" on public.listing_enquiries for update to authenticated
  using (exists (select 1 from public.produce_listings l where l.id = listing_id and l.user_id = auth.uid()));

alter table public.input_products enable row level security;
create policy "active products readable" on public.input_products for select to authenticated
  using (is_active or seller_id = auth.uid());
create policy "sellers add products" on public.input_products for insert to authenticated
  with check (
    seller_id = auth.uid() and not is_sample
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_type = 'seller')
  );
create policy "sellers edit own products" on public.input_products for update to authenticated
  using (seller_id = auth.uid()) with check (seller_id = auth.uid() and not is_sample);
create policy "sellers delete own products" on public.input_products for delete to authenticated
  using (seller_id = auth.uid());

alter table public.input_orders enable row level security;
create policy "buyers place orders" on public.input_orders for insert to authenticated
  with check (buyer_id = auth.uid());
create policy "orders visible to buyer and seller" on public.input_orders for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "orders updatable by buyer and seller" on public.input_orders for update to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Public bucket for listing/product photos (buyers must see them); writes stay per-user.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-photos', 'public-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "own public photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own public photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'public-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Sample catalogue so the shop is not empty in demos. Marked is_sample; the app
-- labels these and explains that real sellers fulfil real orders.
-- Prices are indicative retail prices for certified seed (₹).
-- ---------------------------------------------------------------------------
insert into public.input_products (seller_name, category, crop_slug, name, variety, pack_size, price_inr, mrp_inr, stock, certified, description, is_sample) values
  ('KrishiMitra sample catalogue','seed','wheat','Wheat certified seed','HD-2967','40 kg bag',1800,1950,500,true,'High-yielding timely-sown wheat for irrigated plains of North India. Seed rate about 40 kg per acre.',true),
  ('KrishiMitra sample catalogue','seed','wheat','Wheat certified seed','HD-3086','40 kg bag',1900,2050,500,true,'Rust-tolerant variety for timely sowing in irrigated conditions.',true),
  ('KrishiMitra sample catalogue','seed','rice','Paddy certified seed','Pusa Basmati 1121','10 kg bag',950,1050,500,true,'Long-grain basmati for Punjab, Haryana, western UP. Transplanted; seed rate 6–8 kg per acre.',true),
  ('KrishiMitra sample catalogue','seed','chickpea','Chickpea (gram) certified seed','JG-11','30 kg bag',2700,2900,500,true,'Wilt-tolerant desi gram suited to central and south India rabi; seed rate about 30 kg per acre.',true),
  ('KrishiMitra sample catalogue','seed','mustard','Mustard certified seed','Pusa Bold','2 kg packet',420,480,500,true,'Bold-seeded mustard for rabi; seed rate 1.5–2 kg per acre.',true),
  ('KrishiMitra sample catalogue','seed','soybean','Soybean certified seed','JS-335','30 kg bag',2400,2600,500,true,'Popular kharif soybean for Madhya Pradesh and Maharashtra; seed rate about 30 kg per acre.',true),
  ('KrishiMitra sample catalogue','seed','cotton','Bt cotton hybrid seed','BG-II hybrid','475 g packet',864,864,500,true,'Bollgard-II hybrid cotton; two packets per acre. Price as per government-notified MRP.',true),
  ('KrishiMitra sample catalogue','seed','maize','Maize hybrid seed','Single-cross hybrid','4 kg packet',1250,1400,500,true,'Medium-duration hybrid maize for kharif and rabi; seed rate about 8 kg per acre.',true),
  ('KrishiMitra sample catalogue','seed','groundnut','Groundnut certified seed','TG-37A','30 kg bag',3300,3500,500,true,'Early bunch groundnut for kharif and summer.',true),
  ('KrishiMitra sample catalogue','seed','tomato','Tomato hybrid seed','Determinate hybrid','10 g packet',450,520,500,false,'Hybrid tomato for nursery raising; 10 g raises seedlings for about half an acre.',true),
  ('KrishiMitra sample catalogue','seed','onion','Onion seed','Agrifound Dark Red','500 g packet',950,1100,500,true,'Kharif onion variety; 3–4 kg seed per acre for nursery.',true),
  ('KrishiMitra sample catalogue','biofertilizer',null,'Vermicompost','Organic','25 kg bag',350,400,500,false,'Well-decomposed vermicompost to improve soil organic carbon.',true),
  ('KrishiMitra sample catalogue','biofertilizer','chickpea','Rhizobium culture (seed treatment)','Liquid','500 ml bottle',180,200,500,false,'Seed treatment for pulses to improve nitrogen fixation.',true),
  ('KrishiMitra sample catalogue','pesticide',null,'Neem oil 1500 ppm','Azadirachtin','1 litre',450,520,500,false,'Botanical pest repellent for sucking pests; 3–5 ml per litre of water.',true);
