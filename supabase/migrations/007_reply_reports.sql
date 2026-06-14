-- Reports for comment replies.
-- Run after 006_report_deduplication.sql.

create table if not exists public.reply_reports (
  id uuid primary key default gen_random_uuid(),
  reply_id uuid not null references public.comment_replies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('copyright', 'harassment', 'spam', 'misleading', 'off-topic', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

create index if not exists reply_reports_status_idx
on public.reply_reports(status, created_at desc);

create index if not exists reply_reports_reply_idx
on public.reply_reports(reply_id, created_at desc);

create unique index if not exists reply_reports_reply_user_unique_idx
on public.reply_reports(reply_id, user_id);

alter table public.reply_reports enable row level security;

drop policy if exists "active users can insert reply reports" on public.reply_reports;
create policy "active users can insert reply reports"
on public.reply_reports for insert
with check (
  auth.uid() = user_id
  and public.is_active_user()
  and exists (
    select 1 from public.comment_replies
    where id = reply_id
      and status = 'visible'
      and user_id <> auth.uid()
  )
);

drop policy if exists "users can read own reply reports" on public.reply_reports;
create policy "users can read own reply reports"
on public.reply_reports for select
using (auth.uid() = user_id or public.is_moderator_or_admin());

drop policy if exists "moderators can update reply reports" on public.reply_reports;
create policy "moderators can update reply reports"
on public.reply_reports for update
using (public.is_moderator_or_admin())
with check (public.is_moderator_or_admin());
