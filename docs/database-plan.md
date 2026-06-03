# Database Plan

v0.1 uses only `chrome.storage.local`. Supabase is planned for v0.2.

## papers

| Field | Purpose |
| --- | --- |
| id | Internal database ID |
| paper_key | Stable identifier such as `arxiv:1706.03762` |
| doi | DOI when available |
| arxiv_id | arXiv ID when available |
| pubmed_id | PubMed ID when available |
| url | Source URL |
| title | Paper title |
| authors | Author metadata |
| source | arxiv, doi, pubmed, biorxiv, medrxiv, url |
| created_at | Creation time |
| updated_at | Last update time |

## profiles

| Field | Purpose |
| --- | --- |
| id | Same as Supabase auth user ID |
| display_name | Public display name |
| avatar_url | Optional avatar |
| orcid | Optional ORCID |
| institution | Optional institution |
| role | user, moderator, admin |
| created_at | Creation time |
| updated_at | Last update time |

## comments

All comments are overall comments about the paper.

| Field | Purpose |
| --- | --- |
| id | Comment ID |
| paper_id | Related paper |
| user_id | Author |
| parent_id | Parent comment for replies |
| content | User-created comment text |
| like_count | Denormalized count for sorting popular comments |
| status | visible, hidden, deleted |
| created_at | Creation time |
| updated_at | Last update time |
| deleted_at | Soft deletion time |

## comment_likes

Each user can like another user's comment once.

| Field | Purpose |
| --- | --- |
| id | Like ID |
| comment_id | Liked comment |
| user_id | Liking user |
| created_at | Creation time |

## ratings

Each user has one article-level rating per paper. The rating can be edited at most once per day.

| Field | Purpose |
| --- | --- |
| id | Rating ID |
| paper_id | Related paper |
| user_id | Rating user |
| overall_score | 1-10 overall article rating |
| last_updated_date | Date key used for daily edit limit |
| created_at | Creation time |
| updated_at | Last update time |

## reports

| Field | Purpose |
| --- | --- |
| id | Report ID |
| comment_id | Reported comment |
| user_id | Reporting user |
| reason | Copyright, harassment, spam, misleading, off-topic, other |
| details | Optional details |
| status | open, reviewing, resolved, dismissed |
| created_at | Creation time |
| resolved_at | Resolution time |
