-- Some deployed databases use this explicit name for the old global key.
-- Remove it even if the prior migration was already recorded as applied.
alter table public.dues
  drop constraint if exists dues_flat_month_unique;

drop index if exists public.dues_flat_month_unique;

alter table public.dues
  drop constraint if exists dues_building_flat_month_key;

alter table public.dues
  add constraint dues_building_flat_month_key
  unique (building_id, flat_number, month);
