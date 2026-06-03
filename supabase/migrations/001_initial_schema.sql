-- Paper Comment Extension cloud schema
-- Run this in the Supabase SQL Editor after creating a project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  orcid text,
  institution text,
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.papers (
  id uuid primary key default gen_random_uuid(),
  paper_key text not null unique,
  doi text,
  arxiv_id text,
  pubmed_id text,
  pmc_id text,
  url text not null,
  title text not null,
  journal text,
  publisher text,
  source text,
  year int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  like_count int not null default 0 check (like_count >= 0),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  local_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (paper_id, user_id, local_date)
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  overall_score int not null check (overall_score between 1 and 10),
  last_updated_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paper_id, user_id)
);

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('copyright', 'harassment', 'spam', 'misleading', 'off-topic', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

create index if not exists papers_paper_key_idx on public.papers(paper_key);
create index if not exists papers_doi_idx on public.papers(doi);
create index if not exists comments_paper_created_idx on public.comments(paper_id, created_at desc);
create index if not exists comments_popular_idx on public.comments(paper_id, like_count desc, created_at desc);
create index if not exists ratings_paper_idx on public.ratings(paper_id);
create index if not exists reports_status_idx on public.reports(status, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger papers_set_updated_at
before update on public.papers
for each row execute function public.set_updated_at();

create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

create trigger ratings_set_updated_at
before update on public.ratings
for each row execute function public.set_updated_at();

create or replace function public.is_moderator_or_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('moderator', 'admin')
      and status = 'active'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Reader'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.prevent_rating_second_update_same_day()
returns trigger
language plpgsql
as $$
begin
  if old.last_updated_date = current_date then
    raise exception 'ratings can be updated at most once per day';
  end if;
  new.last_updated_date = current_date;
  return new;
end;
$$;

create trigger ratings_daily_update_guard
before update on public.ratings
for each row execute function public.prevent_rating_second_update_same_day();

create or replace function public.prevent_self_like()
returns trigger
language plpgsql
as $$
declare
  comment_author uuid;
begin
  select user_id into comment_author
  from public.comments
  where id = new.comment_id;

  if comment_author = new.user_id then
    raise exception 'users cannot like their own comments';
  end if;

  return new;
end;
$$;

create trigger comment_likes_prevent_self_like
before insert on public.comment_likes
for each row execute function public.prevent_self_like();

create or replace function public.update_comment_like_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments
    set like_count = like_count + 1
    where id = new.comment_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.comments
    set like_count = greatest(like_count - 1, 0)
    where id = old.comment_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger comment_likes_after_insert
after insert on public.comment_likes
for each row execute function public.update_comment_like_count();

create trigger comment_likes_after_delete
after delete on public.comment_likes
for each row execute function public.update_comment_like_count();

alter table public.profiles enable row level security;
alter table public.papers enable row level security;
alter table public.comments enable row level security;
alter table public.ratings enable row level security;
alter table public.comment_likes enable row level security;
alter table public.reports enable row level security;

create policy "profiles are publicly readable"
on public.profiles for select
using (status <> 'deleted');

create policy "users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

create policy "admins can update profiles"
on public.profiles for update
using (public.is_admin())
with check (public.is_admin());

create policy "papers are publicly readable"
on public.papers for select
using (true);

create policy "authenticated users can insert papers"
on public.papers for insert
with check (auth.uid() is not null);

create policy "moderators can update papers"
on public.papers for update
using (public.is_moderator_or_admin())
with check (public.is_moderator_or_admin());

create policy "visible comments are publicly readable"
on public.comments for select
using (status = 'visible' or user_id = auth.uid() or public.is_moderator_or_admin());

create policy "active users can insert comments"
on public.comments for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'active'
  )
);

create policy "users can update own visible comments"
on public.comments for update
using (auth.uid() = user_id and status = 'visible')
with check (auth.uid() = user_id);

create policy "moderators can update comments"
on public.comments for update
using (public.is_moderator_or_admin())
with check (public.is_moderator_or_admin());

create policy "ratings are publicly readable"
on public.ratings for select
using (true);

create policy "active users can insert ratings"
on public.ratings for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'active'
  )
);

create policy "users can update own ratings"
on public.ratings for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "likes are publicly readable"
on public.comment_likes for select
using (true);

create policy "active users can like comments"
on public.comment_likes for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'active'
  )
);

create policy "users can remove own likes"
on public.comment_likes for delete
using (auth.uid() = user_id);

create policy "users can insert reports"
on public.reports for insert
with check (auth.uid() = user_id);

create policy "users can read own reports"
on public.reports for select
using (auth.uid() = user_id or public.is_moderator_or_admin());

create policy "moderators can update reports"
on public.reports for update
using (public.is_moderator_or_admin())
with check (public.is_moderator_or_admin());
