-- Each generated due stores the actual calendar date it is payable. The day is
-- configured on its building and is capped to the final day of short months.
alter table public.dues
  add column if not exists due_date date;

update public.dues as due
set due_date = (
  date_trunc('month', due.month::date)::date
  + (
    least(
      coalesce(
        building.maintenance_due_day,
        extract(day from (date_trunc('month', due.month::date) + interval '1 month - 1 day'))::integer
      ),
      extract(day from (date_trunc('month', due.month::date) + interval '1 month - 1 day'))::integer
    ) - 1
  )
)
from public.buildings as building
where building.id = due.building_id
  and due.due_date is null;

-- A flat number is only unique within its building. The old global key caused
-- generation for another building with the same flat number to be skipped.
alter table public.dues
  drop constraint if exists dues_flat_month_unique;

drop index if exists public.dues_flat_month_unique;

do $$
declare
  old_constraint text;
begin
  for old_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.dues'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (flat_number, month)'
  loop
    execute format('alter table public.dues drop constraint %I', old_constraint);
  end loop;
end $$;

alter table public.dues
  drop constraint if exists dues_building_flat_month_key;

alter table public.dues
  add constraint dues_building_flat_month_key
  unique (building_id, flat_number, month);
