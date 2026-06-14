-- Add reply counts to public paper summary.
-- Run after 003_replies_and_user_activity.sql.

create or replace view public.paper_summary as
with comment_summary as (
  select
    paper_id,
    count(*)::int as comment_count,
    coalesce(sum(like_count), 0)::int as total_comment_likes,
    max(created_at) as last_comment_at
  from public.comments
  where status = 'visible'
  group by paper_id
),
reply_summary as (
  select
    paper_id,
    count(*)::int as reply_count,
    max(created_at) as last_reply_at
  from public.comment_replies
  where status = 'visible'
  group by paper_id
),
rating_summary as (
  select
    paper_id,
    count(*)::int as rating_count,
    coalesce(round(avg(overall_score)::numeric, 2), null) as rating_average,
    max(updated_at) as last_rating_at
  from public.ratings
  group by paper_id
)
select
  p.id,
  p.paper_key,
  p.doi,
  p.arxiv_id,
  p.pubmed_id,
  p.pmc_id,
  p.url,
  p.title,
  p.journal,
  p.publisher,
  p.source,
  p.year,
  coalesce(cs.comment_count, 0)::int as comment_count,
  coalesce(rs.reply_count, 0)::int as reply_count,
  coalesce(ras.rating_count, 0)::int as rating_count,
  ras.rating_average,
  coalesce(cs.total_comment_likes, 0)::int as total_comment_likes,
  greatest(
    coalesce(cs.last_comment_at, p.created_at),
    coalesce(rs.last_reply_at, p.created_at),
    coalesce(ras.last_rating_at, p.created_at)
  ) as last_active_at
from public.papers p
left join comment_summary cs on cs.paper_id = p.id
left join reply_summary rs on rs.paper_id = p.id
left join rating_summary ras on ras.paper_id = p.id;
