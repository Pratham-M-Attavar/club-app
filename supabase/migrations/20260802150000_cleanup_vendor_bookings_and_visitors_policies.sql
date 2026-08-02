-- Migration: Clean up overlapping vendor_bookings policies and add visitor INSERT/SELECT policies for residents

-- ========================================================
-- 1. CLEANUP VENDOR_BOOKINGS POLICIES
-- ========================================================

-- Drop legacy/overlapping policies on vendor_bookings
drop policy if exists "anyone can view vendor bookings" on public.vendor_bookings;
drop policy if exists "residents view building bookings" on public.vendor_bookings;
drop policy if exists "residents view own vendor bookings" on public.vendor_bookings;
drop policy if exists "residents insert vendor bookings" on public.vendor_bookings;
drop policy if exists "residents create vendor bookings" on public.vendor_bookings;
drop policy if exists "residents update own vendor bookings" on public.vendor_bookings;
drop policy if exists "committee manage vendor bookings" on public.vendor_bookings;
drop policy if exists "residents view vendor_bookings" on public.vendor_bookings;
drop policy if exists "residents insert vendor_bookings" on public.vendor_bookings;
drop policy if exists "residents update vendor_bookings" on public.vendor_bookings;
drop policy if exists "residents_view_building_vendor_bookings" on public.vendor_bookings;
drop policy if exists "residents_insert_vendor_bookings" on public.vendor_bookings;
drop policy if exists "residents_and_admin_update_vendor_bookings" on public.vendor_bookings;

-- Consolidated SELECT policy: Authenticated residents can view vendor bookings in their building
create policy "residents_view_building_vendor_bookings"
  on public.vendor_bookings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.building_id = vendor_bookings.building_id
    )
  );

-- Consolidated INSERT policy: Authenticated residents can book vendors for their flat & building
create policy "residents_insert_vendor_bookings"
  on public.vendor_bookings
  for insert
  to authenticated
  with check (
    auth.uid() = resident_id
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.building_id = vendor_bookings.building_id
    )
  );

-- Consolidated UPDATE policy: Residents can update their own bookings, or Admins/Committee can update building bookings
create policy "residents_and_admin_update_vendor_bookings"
  on public.vendor_bookings
  for update
  to authenticated
  using (
    auth.uid() = resident_id
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.building_id = vendor_bookings.building_id
        and (profiles.role = 'committee' or profiles.is_admin = true or profiles.is_operator = true)
    )
  );


-- ========================================================
-- 2. VISITORS INSERT & SELECT POLICIES
-- ========================================================

-- Enable RLS on visitors table if not already enabled
alter table public.visitors enable row level security;

-- Drop legacy visitor policies if any
drop policy if exists "residents insert visitors" on public.visitors;
drop policy if exists "residents view visitors" on public.visitors;
drop policy if exists "residents_insert_visitors" on public.visitors;
drop policy if exists "residents_view_building_visitors" on public.visitors;

-- INSERT policy: Authenticated residents can log visitors for their building
create policy "residents_insert_visitors"
  on public.visitors
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.building_id = visitors.building_id
    )
  );

-- SELECT policy: Authenticated residents can view visitors in their building
create policy "residents_view_building_visitors"
  on public.visitors
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.building_id = visitors.building_id
    )
  );
