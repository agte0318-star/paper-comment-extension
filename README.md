# Paper Comment Extension

Chrome/Edge extension for shared article-level comments and ratings while reading academic papers.

## Public Links

- Website: `https://agte0318-star.github.io/paper-comment-extension/`
- Support: `https://agte0318-star.github.io/paper-comment-extension/support.html`
- Privacy Policy: `https://agte0318-star.github.io/paper-comment-extension/privacy-policy.html`
- GitHub Issues: `https://github.com/agte0318-star/paper-comment-extension/issues`

## Current Beta Scope

- Detect arXiv papers.
- Detect DOI-based papers on a broader set of SCI publisher, journal, preprint, DOI, and indexing sites, including Wiley journal subdomains and SciOpen/Science China platforms.
- Inject a right-side comment sidebar on supported scholarly article pages.
- Let users create an email/password account through Supabase Auth from the extension and profile page.
- Let users sign in with Google through Supabase Auth when OAuth is configured.
- Show clear email confirmation guidance when Supabase requires new users to confirm their email before signing in.
- Let users request a password reset email from the extension and profile page.
- Store shared comments, ratings, and likes in Supabase when cloud mode is configured.
- Fall back to `chrome.storage.local` when Supabase is not configured.
- Save one overall article rating per signed-in user and paper.
- Show the community average article rating and rating count.
- Show a comment author's overall article score beside their comment when they have rated that paper.
- Let signed-in users like comments written by other users.
- Let signed-in users reply to comments.
- Let signed-in users report comments and replies for moderator review.
- Sort comments by newest or by popularity.
- Add a popup entry point for profile, trending, privacy, and UI reset shortcuts.
- Add a popup entry point that opens the current article or PDF tab's web discussion page.
- Show a concise account card in the popup with sign-in state, account identity, and provider.
- Add a signed-in web profile page for a user's comments, received likes, received replies, and rating history.
- Keep public author labels based on display names, not real email addresses.
- Let signed-in users edit display name, institution, ORCID, and research field.
- Enforce account status in the extension and database so suspended or deleted users can read public discussion but cannot post, rate, like, reply, or report.
- Detect direct PDF URLs, arXiv PDF URLs, common publisher PDF/EPDF/PDFDirect URLs, and DOI-bearing PDF links when the browser allows content-script access.
- Fall back to a web discussion page for PDF tabs when Chrome's built-in PDF viewer blocks normal sidebar injection, including source URLs from the PDF viewer and ScienceDirect PII links.
- Generate a shareable PNG image from a comment.
- Allow one comment per signed-in user, paper, and day.
- Allow one rating update per signed-in user, paper, and day.
- Enforce backend spam limits for rapid comments, rapid replies, repeated reports, duplicate text, and link-heavy submissions.
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

- `web/trending.html`: public discovery page for most discussed papers, top rated papers, and hot comments, with search and paper sorting. It reads the Supabase `paper_summary` and `hot_comments` views.
- `web/paper.html`: public per-paper discussion page for sharing ratings, comments, visible replies, discussion metrics, and a copyable discussion link outside the extension.
- Public web pages show live comment and reply counts when migration `011_summary_reply_counts.sql` has been run.
- Paper discussion pages include copy-link and native share actions for inviting readers outside the extension.
- Public web pages include top navigation to the signed-in profile page.
- `web/profile.html`: signed-in user activity page for comments, replies, likes, and ratings.
- `web/admin.html`: admin-gated moderation page for comments, reported replies, the live reports queue, user status moderation, user detail panels, audit logs, and admin filters. Report status updates, comment/reply hide/restore/soft-delete actions, and user suspension/reactivation run through admin RPC functions and require `role = 'admin'` and `status = 'active'`.

## Next Milestones

- Capture final Chrome Web Store screenshots for sidebar, rating, sign-in, popup, public pages, and profile page.
- Test the packaged extension zip in Chrome, not only the unpacked project folder.
- Manually test direct PDFs from arXiv, Wiley, Springer, ACS, ScienceDirect, and several journal-hosted PDF pages.
- Monitor early user reports after publication and tighten moderation rules where needed.
- Consider optional public profiles and ORCID/institutional verification after privacy defaults and abuse controls remain stable.

## Project Guardrails

- `AGENTS.md`: development rules for future agent work.
- `docs/full-version-todo.md`: complete checklist for the polished extension.
- `docs/release-qa-checklist.md`: manual packaged-extension, auth, PDF, screenshot, and Chrome Web Store QA checklist.
- `docs/manual-test-guide-zh.md`: Chinese step-by-step guide for loading the packaged extension, testing, screenshots, and final upload checks.
- `docs/manual-test-results-template.md`: copyable result log for packaged-extension, auth, PDF, web, screenshot, and privacy checks.
- `docs/chrome-web-store-submission.md`: copy-ready Chrome Web Store package, permission, data-use, and reviewer notes.
- `npm.cmd run prepare:manual-test`: extract the latest release zip under `release/manual-test/` for Chrome's `Load unpacked`.
- `npm.cmd run prepare:store-assets`: prepare `release/store-assets/<version>/` for screenshots and store submission notes.
- `npm.cmd run check:release-ready`: final pre-upload gate after manual test results and screenshots are complete.
