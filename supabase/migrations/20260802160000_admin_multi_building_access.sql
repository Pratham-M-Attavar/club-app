-- Migration: Allow Admins & Operators multi-building access across all building tables

-- 1. Buildings RLS policy update for Admins
drop policy if exists "residents view own building" on public.buildings;
drop policy if exists "residents_and_admin_view_buildings" on public.buildings;

create policy "residents_and_admin_view_buildings"
  on public.buildings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (
          profiles.building_id = buildings.id
          or profiles.is_admin = true
          or profiles.is_operator = true
        )
    )
  );

-- 2. Flats RLS policy update for Admins
drop policy if exists "residents view flats in building" on public.flats;
drop policy if exists "residents_and_admin_view_flats" on public.flats;

create policy "residents_and_admin_view_flats"
  on public.flats
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (
          profiles.building_id = flats.building_id
          or profiles.is_admin = true
          or profiles.is_operator = true
        )
    )
  );

-- 3. Dues RLS policy update for Admins
drop policy if exists "residents view dues in building" on public.dues;
drop policy if exists "residents_and_admin_view_dues" on public.dues;

create policy "residents_and_admin_view_dues"
  on public.dues
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and (
          profiles.building_id = dues.building_id
          or profiles.is_admin = true
          or profiles.is_operator = true
        )
    )
  );

-- 4. Helper functions to prevent RLS recursion on profiles table
create or replace function public.get_user_building_id(user_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select building_id from public.profiles where id = user_id;
$$;

create or replace function public.is_admin_or_operator(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin = true or is_operator = true or role = 'admin' from public.profiles where id = user_id), false);
$$;

create or replace function public.is_admin_operator_or_committee(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin = true or is_operator = true or role = 'admin' or role = 'committee' from public.profiles where id = user_id), false);
$$;

-- 5. Profiles SELECT policy
drop policy if exists "residents_and_admin_view_profiles" on public.profiles;

create policy "residents_and_admin_view_profiles"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_admin_operator_or_committee(auth.uid())
    or building_id = public.get_user_building_id(auth.uid())
  );

-- 6. Profiles UPDATE policy
drop policy if exists "admin_and_committee_update_profiles" on public.profiles;

create policy "admin_and_committee_update_profiles"
  on public.profiles
  for update
  to authenticated
  using (
    id = auth.uid()
    or public.is_admin_operator_or_committee(auth.uid())
  );

