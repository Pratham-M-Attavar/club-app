-- Vendor requests are private to the resident's flat (shared by that flat's
-- owner/tenant), rather than visible to the entire building.
create or replace function public.get_user_flat_number(user_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select flat_number::text from public.profiles where id = user_id
$$;

grant execute on function public.get_user_flat_number(uuid) to authenticated;

drop policy if exists "residents_view_building_vendor_bookings" on public.vendor_bookings;
drop policy if exists "residents view building bookings" on public.vendor_bookings;
drop policy if exists "anyone can view vendor bookings" on public.vendor_bookings;

create policy "residents_view_own_flat_vendor_bookings"
  on public.vendor_bookings
  for select
  to authenticated
  using (
    building_id = public.get_user_building_id(auth.uid())
    and flat_number = public.get_user_flat_number(auth.uid())
  );
