-- Row Level Security and storage policies.
-- Edge Functions write AI outputs with the service role (bypasses RLS);
-- clients get read access to their own rows plus the writes listed here.

-- Reference data: readable by everyone, writable only by the service role.
do $$
declare t text;
begin
  foreach t in array array['languages','states','crops','crop_translations','fertilizers','schemes','scheme_translations','market_prices']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s readable" on public.%I for select to anon, authenticated using (true)', t, t);
  end loop;
end $$;

-- Internal tables: no client access at all.
alter table public.api_cache enable row level security;
alter table public.usage_counters enable row level security;

-- Profiles
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Stop farmers promoting themselves to expert/admin.
create or replace function public.profiles_guard_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'role cannot be changed';
  end if;
  return new;
end;
$$;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.profiles_guard_role();

-- Tables the farmer fully manages.
do $$
declare t text;
begin
  foreach t in array array['fields','field_crop_history','chat_sessions','harvest_feedback']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own %s" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- Tables written by Edge Functions; farmer can read and delete.
do $$
declare t text;
begin
  foreach t in array array['soil_profiles','weather_snapshots','recommendations','crop_plans','crop_plan_tasks','chat_messages','disease_reports','alerts']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own %s read" on public.%I for select to authenticated using (user_id = auth.uid())', t, t);
    execute format('create policy "own %s delete" on public.%I for delete to authenticated using (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- Farmer-editable bits of function-written tables.
create policy "own soil insert" on public.soil_profiles for insert to authenticated
  with check (user_id = auth.uid() and source = 'manual'
              and exists (select 1 from public.fields f where f.id = field_id and f.user_id = auth.uid()));
create policy "own plan update" on public.crop_plans for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own task update" on public.crop_plan_tasks for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own alert update" on public.alerts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Experts can review disease reports.
create policy "experts read reports" on public.disease_reports for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('expert','admin')));
create policy "experts annotate reports" on public.disease_reports for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('expert','admin')));

-- ---------------------------------------------------------------------------
-- Storage: one private bucket, each user writes under "<uid>/..."
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', false, 10485760, array['image/jpeg','image/png','image/webp','audio/m4a','audio/mp4','audio/x-m4a','audio/aac','audio/wav'])
on conflict (id) do nothing;

create policy "own uploads read" on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own uploads insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own uploads delete" on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
