-- Summary views for public trending pages and admin dashboards.

create or replace view public.paper_summary as
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
  count(distinct c.id) filter (where c.status = 'visible')::int as comment_count,
  count(distinct r.id)::int as rating_count,
  coalesce(round(avg(r.overall_score)::numeric, 2), null) as rating_average,
  coalesce(sum(c.like_count) filter (where c.status = 'visible'), 0)::int as total_comment_likes,
  greatest(
    coalesce(max(c.created_at), p.created_at),
    coalesce(max(r.updated_at), p.created_at)
  ) as last_active_at
from public.papers p
left join public.comments c on c.paper_id = p.id
left join public.ratings r on r.paper_id = p.id
group by p.id;

create or replace view public.hot_comments as
select
  c.id,
  c.paper_id,
  p.paper_key,
  p.title as paper_title,
  p.journal,
  c.user_id,
  pr.display_name,
  c.content,
  c.like_count,
  c.created_at,
  r.overall_score as author_rating
from public.comments c
join public.papers p on p.id = c.paper_id
join public.profiles pr on pr.id = c.user_id
left join public.ratings r on r.paper_id = c.paper_id and r.user_id = c.user_id
where c.status = 'visible';
