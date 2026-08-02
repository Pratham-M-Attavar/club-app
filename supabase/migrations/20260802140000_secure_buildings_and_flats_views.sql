-- 1. Create public views exposing ONLY non-sensitive columns
create or replace view public.public_buildings_search as
  select id, name, city, has_blocks
  from public.buildings;

create or replace view public.public_flats_list as
  select id, flat_number, flat_type, building_id, block_id
  from public.flats;

-- 2. Grant SELECT privileges on both views to anon and authenticated roles
grant select on public.public_buildings_search to anon, authenticated;
grant select on public.public_flats_list to anon, authenticated;

-- 3. Drop existing wide-open RLS policies on base tables
drop policy if exists "anyone can view buildings" on public.buildings;
drop policy if exists "anyone can browse buildings" on public.buildings;
drop policy if exists "anyone can browse flats" on public.flats;

-- 5. Add scoped SELECT policy on buildings for authenticated residents
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'buildings'
      and policyname = 'residents view own building'
  ) then
    create policy "residents view own building"
      on public.buildings
      for select
      to authenticated
      using (
        exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.building_id = buildings.id
        )
      );
  end if;
end $$;
