-- Prevent duplicate reports from the same user on the same comment.
-- Run after 005_account_status_enforcement.sql.

with ranked_reports as (
  select
    id,
    row_number() over (
      partition by comment_id, user_id
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.reports
)
delete from public.reports
where id in (
  select id
  from ranked_reports
  where duplicate_rank > 1
);

create unique index if not exists reports_comment_user_unique_idx
on public.reports(comment_id, user_id);
