-- Migration: Fix infinite recursion in RLS policies for relation 'profiles'
-- Uses SECURITY DEFINER helper functions to look up profile attributes safely.

-- 1. Helper functions with SECURITY DEFINER (bypasses RLS to avoid circular recursion)

create or replace function public.get_user_building_id(user_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select building_id
  from public.profiles
  where id = user_id;
$$;

create or replace function public.get_user_is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = user_id),
    false
  );
$$;

create or replace function public.get_user_is_operator(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select is_operator from public.profiles where id = user_id),
    false
  );
$$;

create or replace function public.is_admin_or_operator(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin = true or is_operator = true or role = 'admin'
     from public.profiles
     where id = user_id),
    false
  );
$$;

create or replace function public.is_admin_operator_or_committee(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin = true or is_operator = true or role = 'admin' or role = 'committee'
     from public.profiles
     where id = user_id),
    false
  );
$$;

-- Grant EXECUTE on functions to authenticated and anon
grant execute on function public.get_user_building_id(uuid) to authenticated, anon;
grant execute on function public.get_user_is_admin(uuid) to authenticated, anon;
grant execute on function public.get_user_is_operator(uuid) to authenticated, anon;
grant execute on function public.is_admin_or_operator(uuid) to authenticated, anon;
grant execute on function public.is_admin_operator_or_committee(uuid) to authenticated, anon;


-- 2. Drop existing recursive policies on profiles
drop policy if exists "residents_and_admin_view_profiles" on public.profiles;
drop policy if exists "admin_and_committee_update_profiles" on public.profiles;
drop policy if exists "users cannot change is_admin" on public.profiles;
drop policy if exists "users cannot change is_operator" on public.profiles;
drop policy if exists "users view own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;

-- 3. Re-create non-recursive RLS policies on profiles

-- SELECT policy: Users can read their own profile, or admins/committee/building residents can view
create policy "residents_and_admin_view_profiles"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_admin_operator_or_committee(auth.uid())
    or building_id = public.get_user_building_id(auth.uid())
  );

-- UPDATE policy: Users can update their own profile, or admins/committee can update
create policy "residents_and_admin_update_profiles"
  on public.profiles
  for update
  to authenticated
  using (
    id = auth.uid()
    or public.is_admin_operator_or_committee(auth.uid())
  )
  with check (
    -- Non-admin users cannot change their own is_admin or is_operator status
    public.is_admin_or_operator(auth.uid())
    or (
      is_admin is not distinct from public.get_user_is_admin(auth.uid())
      and is_operator is not distinct from public.get_user_is_operator(auth.uid())
    )
  );


-- 4. Re-create policies on dependent tables using SECURITY DEFINER functions for max safety & speed

-- Buildings
drop policy if exists "residents_and_admin_view_buildings" on public.buildings;
drop policy if exists "residents view own building" on public.buildings;

create policy "residents_and_admin_view_buildings"
  on public.buildings
  for select
  to authenticated
  using (
    id = public.get_user_building_id(auth.uid())
    or public.is_admin_or_operator(auth.uid())
  );

-- Flats
drop policy if exists "residents_and_admin_view_flats" on public.flats;
drop policy if exists "residents view flats in building" on public.flats;

create policy "residents_and_admin_view_flats"
  on public.flats
  for select
  to authenticated
  using (
    building_id = public.get_user_building_id(auth.uid())
    or public.is_admin_or_operator(auth.uid())
  );

-- Dues
drop policy if exists "residents_and_admin_view_dues" on public.dues;
drop policy if exists "residents view dues in building" on public.dues;

create policy "residents_and_admin_view_dues"
  on public.dues
  for select
  to authenticated
  using (
    building_id = public.get_user_building_id(auth.uid())
    or public.is_admin_or_operator(auth.uid())
  );

-- Vendor Bookings
drop policy if exists "residents_view_building_vendor_bookings" on public.vendor_bookings;
create policy "residents_view_building_vendor_bookings"
  on public.vendor_bookings
  for select
  to authenticated
  using (
    building_id = public.get_user_building_id(auth.uid())
    or public.is_admin_or_operator(auth.uid())
  );

drop policy if exists "residents_insert_vendor_bookings" on public.vendor_bookings;
create policy "residents_insert_vendor_bookings"
  on public.vendor_bookings
  for insert
  to authenticated
  with check (
    auth.uid() = resident_id
    and (
      building_id = public.get_user_building_id(auth.uid())
      or public.is_admin_or_operator(auth.uid())
    )
  );

drop policy if exists "residents_and_admin_update_vendor_bookings" on public.vendor_bookings;
create policy "residents_and_admin_update_vendor_bookings"
  on public.vendor_bookings
  for update
  to authenticated
  using (
    auth.uid() = resident_id
    or public.is_admin_operator_or_committee(auth.uid())
  );

-- Visitors
drop policy if exists "residents_insert_visitors" on public.visitors;
create policy "residents_insert_visitors"
  on public.visitors
  for insert
  to authenticated
  with check (
    building_id = public.get_user_building_id(auth.uid())
    or public.is_admin_or_operator(auth.uid())
  );

drop policy if exists "residents_view_building_visitors" on public.visitors;
create policy "residents_view_building_visitors"
  on public.visitors
  for select
  to authenticated
  using (
    building_id = public.get_user_building_id(auth.uid())
    or public.is_admin_or_operator(auth.uid())
  );
