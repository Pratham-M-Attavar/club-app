-- Migration: Fix Row Level Security policies for service_requests table

-- Enable RLS on service_requests
alter table public.service_requests enable row level security;

-- Drop legacy / conflicting policies
drop policy if exists "anyone can insert service_requests" on public.service_requests;
drop policy if exists "residents insert service_requests" on public.service_requests;
drop policy if exists "residents_insert_service_requests" on public.service_requests;
drop policy if exists "residents view service_requests" on public.service_requests;
drop policy if exists "residents_view_service_requests" on public.service_requests;
drop policy if exists "residents_and_admin_update_service_requests" on public.service_requests;

-- 1. INSERT Policy: Authenticated residents can insert service requests for their own building
create policy "residents_insert_service_requests"
  on public.service_requests
  for insert
  to authenticated
  with check (
    requested_by = auth.uid()
    and (
      building_id = public.get_user_building_id(auth.uid())
      or public.is_admin_or_operator(auth.uid())
    )
  );

-- 2. SELECT Policy: Residents can view their own requests, admins/operators/committee can view building requests
create policy "residents_view_service_requests"
  on public.service_requests
  for select
  to authenticated
  using (
    requested_by = auth.uid()
    or building_id = public.get_user_building_id(auth.uid())
    or public.is_admin_operator_or_committee(auth.uid())
  );

-- 3. UPDATE Policy: Residents can update their own requests, or Admins/Operators/Committee can manage them
create policy "residents_and_admin_update_service_requests"
  on public.service_requests
  for update
  to authenticated
  using (
    requested_by = auth.uid()
    or public.is_admin_operator_or_committee(auth.uid())
  );
