-- Account status enforcement for user interactions.
-- Run after 004_profile_fields.sql.

create or replace function public.is_active_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'active'
  );
$$;

drop policy if exists "active users can insert comments" on public.comments;
create policy "active users can insert comments"
on public.comments for insert
with check (
  auth.uid() = user_id
  and public.is_active_user()
);

drop policy if exists "users can update own visible comments" on public.comments;
create policy "users can update own visible comments"
on public.comments for update
using (auth.uid() = user_id and status = 'visible' and public.is_active_user())
with check (auth.uid() = user_id and public.is_active_user());

drop policy if exists "active users can insert ratings" on public.ratings;
create policy "active users can insert ratings"
on public.ratings for insert
with check (
  auth.uid() = user_id
  and public.is_active_user()
);

drop policy if exists "users can update own ratings" on public.ratings;
create policy "users can update own ratings"
on public.ratings for update
using (auth.uid() = user_id and public.is_active_user())
with check (auth.uid() = user_id and public.is_active_user());

drop policy if exists "active users can like comments" on public.comment_likes;
create policy "active users can like comments"
on public.comment_likes for insert
with check (
  auth.uid() = user_id
  and public.is_active_user()
);

drop policy if exists "users can insert reports" on public.reports;
create policy "users can insert reports"
on public.reports for insert
with check (
  auth.uid() = user_id
  and public.is_active_user()
);

drop policy if exists "active users can insert replies" on public.comment_replies;
create policy "active users can insert replies"
on public.comment_replies for insert
with check (
  auth.uid() = user_id
  and public.is_active_user()
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
using (auth.uid() = user_id and status = 'visible' and public.is_active_user())
with check (auth.uid() = user_id and public.is_active_user());
