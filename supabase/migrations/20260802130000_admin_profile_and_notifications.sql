-- Migration: Admin profile flag, secure RLS policies, and set prathammattavar@gmail.com as Admin & Operator

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Policy to prevent users from altering their own is_admin status
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'users cannot change is_admin'
  ) then
    create policy "users cannot change is_admin"
      on public.profiles
      for update
      using (auth.uid() = id)
      with check (
        is_admin is not distinct from (
          select p.is_admin from public.profiles p where p.id = auth.uid()
        )
      );
  end if;
end $$;

-- Promote prathammattavar@gmail.com to Admin & Operator (without altering role column to avoid check constraint conflict)
update public.profiles
set 
  is_admin = true,
  is_operator = true
where id in (
  select id from auth.users where lower(email) = 'prathammattavar@gmail.com'
);
