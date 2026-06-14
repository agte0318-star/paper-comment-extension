-- Harden profile status moderation.
-- Run after 007_reply_reports.sql.

drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
on public.profiles for select
using (status <> 'deleted' or public.is_moderator_or_admin());

create or replace function public.prevent_self_profile_privilege_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.is_admin() then
    new.role = old.role;
    new.status = old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_privilege_change on public.profiles;
create trigger profiles_prevent_self_privilege_change
before update on public.profiles
for each row execute function public.prevent_self_profile_privilege_change();
