-- One maintenance due date applies to every flat in a building.
alter table public.buildings
  add column if not exists maintenance_due_day integer;

alter table public.buildings
  drop constraint if exists buildings_maintenance_due_day_check;

alter table public.buildings
  add constraint buildings_maintenance_due_day_check
  check (maintenance_due_day is null or maintenance_due_day between 1 and 31);

drop policy if exists "committee_update_own_building" on public.buildings;
create policy "committee_update_own_building"
  on public.buildings
  for update
  to authenticated
  using ( 
    id = public.get_user_building_id(auth.uid())
    or public.is_admin_operator_or_committee(auth.uid())
  )
  with check (
    id = public.get_user_building_id(auth.uid())
    or public.is_admin_operator_or_committee(auth.uid())
  );
