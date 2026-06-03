# Paper Comment Extension

Chrome/Edge extension for shared article-level comments and ratings while reading academic papers.

## v0.2 Scope

- Detect arXiv papers.
- Detect DOI-based papers on a broader set of SCI publisher, journal, preprint, DOI, and indexing sites, including Wiley journal subdomains and SciOpen/Science China platforms.
- Inject a right-side comment sidebar on supported scholarly article pages.
- Let users create an email/password account through Supabase Auth.
- Store shared comments, ratings, and likes in Supabase when cloud mode is configured.
- Fall back to `chrome.storage.local` when Supabase is not configured.
- Save one overall article rating per signed-in user and paper.
- Show the community average article rating and rating count.
- Show a comment author's overall article score beside their comment when they have rated that paper.
- Let signed-in users like comments written by other users.
- Sort comments by newest or by popularity.
- Generate a shareable PNG image from a comment.
- Allow one comment per signed-in user, paper, and day.
- Allow one rating update per signed-in user, paper, and day.
- Block obvious abusive or spam-like comments with a starter blocklist.
- Do not upload PDFs, full article text, paywalled content, figures, tables, or screenshots.

## How to Load Locally

1. Open Chrome or Edge.
2. Go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `paper-comment-extension` project folder.
6. Open an arXiv paper page such as `https://arxiv.org/abs/1706.03762`, or a DOI-based paper page from a supported SCI publisher, journal platform, preprint server, DOI resolver, or indexing site.

## Supabase

Cloud backend setup files are in:

- `supabase/migrations/`
- `docs/supabase-setup.md`

The extension uses `src/config/supabase.js` for the public client URL and publishable key. Do not add a Supabase `service_role` key to the extension.

## Web Pages

- `web/trending.html`: public page for most discussed papers, top rated papers, and hot comments. It reads the Supabase `paper_summary` and `hot_comments` views.
- `web/admin.html`: read-only moderation preview for visible comments. Persistent moderation actions require a future admin sign-in flow.

## Next Milestones

- Add a report button for comments.
- Add admin sign-in for persistent hide/delete/report actions.
- Add OAuth sign-in.
