-- Moderation audit log and admin RPC actions.
-- Run after 008_profile_status_admin_controls.sql.

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null check (action_type in ('update_content_status', 'update_report_status', 'update_user_status')),
  target_type text not null check (target_type in ('comment', 'reply', 'comment_report', 'reply_report', 'user')),
  target_id uuid not null,
  previous_status text,
  new_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists moderation_actions_created_idx
on public.moderation_actions(created_at desc);

create index if not exists moderation_actions_target_idx
on public.moderation_actions(target_type, target_id, created_at desc);

alter table public.moderation_actions enable row level security;

drop policy if exists "moderators can read moderation actions" on public.moderation_actions;
create policy "moderators can read moderation actions"
on public.moderation_actions for select
using (public.is_moderator_or_admin());

drop policy if exists "moderators can insert moderation actions" on public.moderation_actions;
create policy "moderators can insert moderation actions"
on public.moderation_actions for insert
with check (auth.uid() = actor_id and public.is_moderator_or_admin());

create or replace function public.admin_update_report_status(
  p_report_type text,
  p_report_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_previous_status text;
  v_target_type text;
begin
  if not public.is_moderator_or_admin() then
    raise exception 'admin access required';
  end if;

  if p_status not in ('open', 'reviewing', 'resolved', 'dismissed') then
    raise exception 'invalid report status';
  end if;

  if p_report_type = 'reply' then
    select status into v_previous_status
    from public.reply_reports
    where id = p_report_id
    for update;

    if v_previous_status is null then
      raise exception 'reply report not found';
    end if;

    update public.reply_reports
    set status = p_status,
        resolved_at = case when p_status in ('resolved', 'dismissed') then now() else null end,
        resolved_by = case when p_status in ('resolved', 'dismissed') then v_actor else null end
    where id = p_report_id;

    v_target_type := 'reply_report';
  elsif p_report_type = 'comment' then
    select status into v_previous_status
    from public.reports
    where id = p_report_id
    for update;

    if v_previous_status is null then
      raise exception 'comment report not found';
    end if;

    update public.reports
    set status = p_status,
        resolved_at = case when p_status in ('resolved', 'dismissed') then now() else null end,
        resolved_by = case when p_status in ('resolved', 'dismissed') then v_actor else null end
    where id = p_report_id;

    v_target_type := 'comment_report';
  else
    raise exception 'invalid report type';
  end if;

  insert into public.moderation_actions (
    actor_id,
    action_type,
    target_type,
    target_id,
    previous_status,
    new_status,
    metadata
  )
  values (
    v_actor,
    'update_report_status',
    v_target_type,
    p_report_id,
    v_previous_status,
    p_status,
    jsonb_build_object('report_type', p_report_type)
  );
end;
$$;

create or replace function public.admin_update_content_status(
  p_target_type text,
  p_target_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_previous_status text;
begin
  if not public.is_moderator_or_admin() then
    raise exception 'admin access required';
  end if;

  if p_status not in ('visible', 'hidden', 'deleted') then
    raise exception 'invalid content status';
  end if;

  if p_target_type = 'reply' then
    select status into v_previous_status
    from public.comment_replies
    where id = p_target_id
    for update;

    if v_previous_status is null then
      raise exception 'reply not found';
    end if;

    update public.comment_replies
    set status = p_status,
        deleted_at = case when p_status = 'deleted' then now() else null end
    where id = p_target_id;
  elsif p_target_type = 'comment' then
    select status into v_previous_status
    from public.comments
    where id = p_target_id
    for update;

    if v_previous_status is null then
      raise exception 'comment not found';
    end if;

    update public.comments
    set status = p_status,
        deleted_at = case when p_status = 'deleted' then now() else null end
    where id = p_target_id;
  else
    raise exception 'invalid target type';
  end if;

  insert into public.moderation_actions (
    actor_id,
    action_type,
    target_type,
    target_id,
    previous_status,
    new_status
  )
  values (
    v_actor,
    'update_content_status',
    p_target_type,
    p_target_id,
    v_previous_status,
    p_status
  );
end;
$$;

create or replace function public.admin_update_user_status(
  p_user_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_previous_status text;
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  if p_user_id = v_actor then
    raise exception 'cannot change your own admin account status here';
  end if;

  if p_status not in ('active', 'suspended', 'deleted') then
    raise exception 'invalid user status';
  end if;

  select status into v_previous_status
  from public.profiles
  where id = p_user_id
  for update;

  if v_previous_status is null then
    raise exception 'user profile not found';
  end if;

  update public.profiles
  set status = p_status
  where id = p_user_id;

  insert into public.moderation_actions (
    actor_id,
    action_type,
    target_type,
    target_id,
    previous_status,
    new_status
  )
  values (
    v_actor,
    'update_user_status',
    'user',
    p_user_id,
    v_previous_status,
    p_status
  );
end;
$$;

revoke execute on function public.admin_update_report_status(text, uuid, text) from public;
revoke execute on function public.admin_update_content_status(text, uuid, text) from public;
revoke execute on function public.admin_update_user_status(uuid, text) from public;

grant execute on function public.admin_update_report_status(text, uuid, text) to authenticated;
grant execute on function public.admin_update_content_status(text, uuid, text) to authenticated;
grant execute on function public.admin_update_user_status(uuid, text) to authenticated;
