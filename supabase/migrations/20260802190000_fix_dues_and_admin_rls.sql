-- Migration: Fix Row Level Security policies for dues, flats, notices, and tickets

-- ========================================================
-- 1. DUES POLICIES (INSERT, UPDATE, SELECT)
-- ========================================================
alter table public.dues enable row level security;

drop policy if exists "residents_and_admin_view_dues" on public.dues;
drop policy if exists "residents view dues in building" on public.dues;
drop policy if exists "admin_and_committee_insert_dues" on public.dues;
drop policy if exists "admin_and_committee_update_dues" on public.dues;

-- SELECT: Residents & Admins/Committee can view dues for their building
create policy "residents_and_admin_view_dues"
  on public.dues
  for select
  to authenticated
  using (
    building_id = public.get_user_building_id(auth.uid())
    or public.is_admin_operator_or_committee(auth.uid())
  );

-- INSERT: Admins, Committee members, and Operators can generate dues
create policy "admin_and_committee_insert_dues"
  on public.dues
  for insert
  to authenticated
  with check (
    public.is_admin_operator_or_committee(auth.uid())
    or building_id = public.get_user_building_id(auth.uid())
  );

-- UPDATE: Admins/Committee can update status (mark paid, generate), residents can update proof
create policy "admin_and_committee_update_dues"
  on public.dues
  for update
  to authenticated
  using (
    public.is_admin_operator_or_committee(auth.uid())
    or building_id = public.get_user_building_id(auth.uid())
  );


-- ========================================================
-- 2. FLATS UPDATE POLICY (For Maintenance Setup)
-- ========================================================
alter table public.flats enable row level security;

drop policy if exists "admin_and_committee_update_flats" on public.flats;

create policy "admin_and_committee_update_flats"
  on public.flats
  for update
  to authenticated
  using (
    public.is_admin_operator_or_committee(auth.uid())
    or building_id = public.get_user_building_id(auth.uid())
  );


-- ========================================================
-- 3. NOTICES POLICIES (INSERT, UPDATE, SELECT, DELETE)
-- ========================================================
alter table public.notices enable row level security;

drop policy if exists "residents_view_notices" on public.notices;
drop policy if exists "admin_manage_notices" on public.notices;
drop policy if exists "admin_insert_notices" on public.notices;
drop policy if exists "admin_update_notices" on public.notices;
drop policy if exists "admin_delete_notices" on public.notices;

create policy "residents_view_notices"
  on public.notices
  for select
  to authenticated
  using (
    building_id = public.get_user_building_id(auth.uid())
    or public.is_admin_operator_or_committee(auth.uid())
  );

create policy "admin_insert_notices"
  on public.notices
  for insert
  to authenticated
  with check (
    public.is_admin_operator_or_committee(auth.uid())
    or building_id = public.get_user_building_id(auth.uid())
  );

create policy "admin_update_notices"
  on public.notices
  for update
  to authenticated
  using (
    public.is_admin_operator_or_committee(auth.uid())
    or building_id = public.get_user_building_id(auth.uid())
  );

create policy "admin_delete_notices"
  on public.notices
  for delete
  to authenticated
  using (
    public.is_admin_operator_or_committee(auth.uid())
    or building_id = public.get_user_building_id(auth.uid())
  );


-- ========================================================
-- 4. TICKETS POLICIES (INSERT, UPDATE, SELECT)
-- ========================================================
alter table public.tickets enable row level security;

drop policy if exists "residents_view_tickets" on public.tickets;
drop policy if exists "residents_insert_tickets" on public.tickets;
drop policy if exists "admin_update_tickets" on public.tickets;

create policy "residents_view_tickets"
  on public.tickets
  for select
  to authenticated
  using (
    building_id = public.get_user_building_id(auth.uid())
    or public.is_admin_operator_or_committee(auth.uid())
  );

create policy "residents_insert_tickets"
  on public.tickets
  for insert
  to authenticated
  with check (
    building_id = public.get_user_building_id(auth.uid())
    or public.is_admin_or_operator(auth.uid())
  );

create policy "admin_update_tickets"
  on public.tickets
  for update
  to authenticated
  using (
    building_id = public.get_user_building_id(auth.uid())
    or public.is_admin_operator_or_committee(auth.uid())
  );
