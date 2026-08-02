-- Free operator alerts: mark your profile so booking push notifications go to you.
--
-- 1) Find your profile id:
--      select id, full_name from profiles;
-- 2) Set yourself as the only operator:
--      update profiles set is_operator = false;
--      update profiles set is_operator = true where id = 'YOUR-PROFILE-UUID';
-- 3) Open the app on YOUR phone, allow notifications, then confirm:
--      select push_token from profiles where is_operator = true;

alter table profiles
  add column if not exists is_operator boolean not null default false;

create unique index if not exists profiles_single_operator_idx
  on profiles (is_operator)
  where is_operator = true;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'users cannot change is_operator'
  ) then
    create policy "users cannot change is_operator"
      on public.profiles
      for update
      using (auth.uid() = id)
      with check (
        is_operator is not distinct from (
          select p.is_operator from public.profiles p where p.id = auth.uid()
        )
      );
  end if;
end $$;
