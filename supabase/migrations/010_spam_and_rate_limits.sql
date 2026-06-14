-- Backend spam signals and rate limits.
-- Run after 009_moderation_audit_log.sql.

create or replace function public.normalized_moderation_text(p_text text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(coalesce(p_text, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.link_like_count(p_text text)
returns int
language sql
immutable
as $$
  select count(*)::int
  from regexp_matches(coalesce(p_text, ''), '(https?://|www\.)', 'gi');
$$;

create or replace function public.guard_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text text := public.normalized_moderation_text(new.content);
begin
  if public.is_moderator_or_admin() then
    return new;
  end if;

  if char_length(v_text) < 8 then
    raise exception 'comment is too short';
  end if;

  if public.link_like_count(new.content) > 3 then
    raise exception 'comment has too many links';
  end if;

  if (
    select count(*)
    from public.comments
    where user_id = new.user_id
      and created_at > now() - interval '1 hour'
  ) >= 4 then
    raise exception 'too many comments in a short time';
  end if;

  if (
    select count(*)
    from public.comments
    where user_id = new.user_id
      and created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'daily comment limit reached';
  end if;

  if exists (
    select 1
    from public.comments
    where user_id = new.user_id
      and created_at > now() - interval '7 days'
      and public.normalized_moderation_text(content) = v_text
  ) then
    raise exception 'duplicate comment detected';
  end if;

  return new;
end;
$$;

drop trigger if exists comments_spam_guard on public.comments;
create trigger comments_spam_guard
before insert on public.comments
for each row execute function public.guard_comment_insert();

create or replace function public.guard_reply_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text text := public.normalized_moderation_text(new.content);
begin
  if public.is_moderator_or_admin() then
    return new;
  end if;

  if char_length(v_text) < 3 then
    raise exception 'reply is too short';
  end if;

  if public.link_like_count(new.content) > 2 then
    raise exception 'reply has too many links';
  end if;

  if (
    select count(*)
    from public.comment_replies
    where user_id = new.user_id
      and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'too many replies in a short time';
  end if;

  if (
    select count(*)
    from public.comment_replies
    where user_id = new.user_id
      and created_at > now() - interval '1 day'
  ) >= 40 then
    raise exception 'daily reply limit reached';
  end if;

  if exists (
    select 1
    from public.comment_replies
    where user_id = new.user_id
      and created_at > now() - interval '1 day'
      and public.normalized_moderation_text(content) = v_text
  ) then
    raise exception 'duplicate reply detected';
  end if;

  return new;
end;
$$;

drop trigger if exists comment_replies_spam_guard on public.comment_replies;
create trigger comment_replies_spam_guard
before insert on public.comment_replies
for each row execute function public.guard_reply_insert();

create or replace function public.guard_report_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_hour int;
  v_recent_day int;
begin
  if public.is_moderator_or_admin() then
    return new;
  end if;

  if public.link_like_count(new.details) > 2 then
    raise exception 'report details have too many links';
  end if;

  select
    (
      select count(*)
      from public.reports
      where user_id = new.user_id
        and created_at > now() - interval '1 hour'
    ) + (
      select count(*)
      from public.reply_reports
      where user_id = new.user_id
        and created_at > now() - interval '1 hour'
    ),
    (
      select count(*)
      from public.reports
      where user_id = new.user_id
        and created_at > now() - interval '1 day'
    ) + (
      select count(*)
      from public.reply_reports
      where user_id = new.user_id
        and created_at > now() - interval '1 day'
    )
  into v_recent_hour, v_recent_day;

  if v_recent_hour >= 10 then
    raise exception 'too many reports in a short time';
  end if;

  if v_recent_day >= 30 then
    raise exception 'daily report limit reached';
  end if;

  return new;
end;
$$;

drop trigger if exists reports_spam_guard on public.reports;
create trigger reports_spam_guard
before insert on public.reports
for each row execute function public.guard_report_insert();

drop trigger if exists reply_reports_spam_guard on public.reply_reports;
create trigger reply_reports_spam_guard
before insert on public.reply_reports
for each row execute function public.guard_report_insert();
