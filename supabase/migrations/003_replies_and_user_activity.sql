-- Replies and user activity views.
-- Run after 001_initial_schema.sql and 002_summary_views.sql.

create table if not exists public.comment_replies (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  paper_id uuid not null references public.papers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists comment_replies_comment_created_idx
on public.comment_replies(comment_id, created_at asc);

create index if not exists comment_replies_user_created_idx
on public.comment_replies(user_id, created_at desc);

create index if not exists comment_replies_paper_created_idx
on public.comment_replies(paper_id, created_at desc);

drop trigger if exists comment_replies_set_updated_at on public.comment_replies;
create trigger comment_replies_set_updated_at
before update on public.comment_replies
for each row execute function public.set_updated_at();

alter table public.comment_replies enable row level security;

drop policy if exists "visible replies are publicly readable" on public.comment_replies;
create policy "visible replies are publicly readable"
on public.comment_replies for select
using (status = 'visible' or user_id = auth.uid() or public.is_moderator_or_admin());

drop policy if exists "active users can insert replies" on public.comment_replies;
create policy "active users can insert replies"
on public.comment_replies for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'active'
  )
  and exists (
    select 1 from public.comments
    where id = comment_id
      and paper_id = comment_replies.paper_id
      and status = 'visible'
  )
);

drop policy if exists "users can update own visible replies" on public.comment_replies;
create policy "users can update own visible replies"
on public.comment_replies for update
using (auth.uid() = user_id and status = 'visible')
with check (auth.uid() = user_id);

drop policy if exists "moderators can update replies" on public.comment_replies;
create policy "moderators can update replies"
on public.comment_replies for update
using (public.is_moderator_or_admin())
with check (public.is_moderator_or_admin());

create or replace view public.user_comment_activity as
select
  c.id,
  c.paper_id,
  c.user_id,
  c.content,
  c.like_count,
  c.status,
  c.created_at,
  p.paper_key,
  p.title as paper_title,
  p.url as paper_url,
  count(cr.id) filter (where cr.status = 'visible')::int as reply_count
from public.comments c
join public.papers p on p.id = c.paper_id
left join public.comment_replies cr on cr.comment_id = c.id
group by c.id, p.id;

create or replace view public.user_received_replies as
select
  cr.id,
  cr.comment_id,
  cr.paper_id,
  c.user_id as parent_user_id,
  cr.user_id,
  pr.display_name,
  cr.content,
  cr.status,
  cr.created_at,
  c.content as parent_content,
  p.paper_key,
  p.title as paper_title,
  p.url as paper_url
from public.comment_replies cr
join public.comments c on c.id = cr.comment_id
join public.papers p on p.id = cr.paper_id
join public.profiles pr on pr.id = cr.user_id
where cr.status = 'visible' and c.status = 'visible';
