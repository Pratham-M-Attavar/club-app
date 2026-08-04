-- Remove every old notice policy, including any broad policy created before
-- building_id was introduced. This prevents notices leaking between buildings.
do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notices'
  loop
    execute format('drop policy if exists %I on public.notices', policy_name);
  end loop;
end $$;

alter table public.notices enable row level security;

-- Residents and committee members can only read their own building's notices.
-- Platform admins/operators retain their intentional cross-building access;
-- the app always queries the currently selected building explicitly.
create policy "building_members_view_notices"
  on public.notices
  for select
  to authenticated
  using (
    building_id = public.get_user_building_id(auth.uid())
    or public.is_admin_or_operator(auth.uid())
  );

create policy "building_committee_insert_notices"
  on public.notices
  for insert
  to authenticated
  with check (
    (
      building_id = public.get_user_building_id(auth.uid())
      and public.is_admin_operator_or_committee(auth.uid())
    )
    or public.is_admin_or_operator(auth.uid())
  );

create policy "building_committee_update_notices"
  on public.notices
  for update
  to authenticated
  using (
    (
      building_id = public.get_user_building_id(auth.uid())
      and public.is_admin_operator_or_committee(auth.uid())
    )
    or public.is_admin_or_operator(auth.uid())
  )
  with check (
    (
      building_id = public.get_user_building_id(auth.uid())
      and public.is_admin_operator_or_committee(auth.uid())
    )
    or public.is_admin_or_operator(auth.uid())
  );

create policy "building_committee_delete_notices"
  on public.notices
  for delete
  to authenticated
  using (
    (
      building_id = public.get_user_building_id(auth.uid())
      and public.is_admin_operator_or_committee(auth.uid())
    )
    or public.is_admin_or_operator(auth.uid())
  );
