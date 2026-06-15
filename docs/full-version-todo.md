# Full Version Todo

This todo list defines the path from the current beta extension to a polished public product.

## Phase 1 - Account System Foundation

- [ ] Keep email/password sign-up, sign-in, sign-out, and session refresh stable.
- [x] Add automated guardrails for sign-up, sign-in, sign-out, password reset, Google sign-in, session refresh, and contextual auth prompts.
- [x] Add password reset flow.
- [x] Add clearer email confirmation flow.
- [x] Add Google sign-in through Supabase Auth.
- [x] Add profile editing for display name, institution, ORCID, and research field.
- [x] Hide real email from public UI.
- [x] Add account status handling in the UI: active, suspended, deleted.
- [x] Add a concise account page from the extension popup.

## Phase 2 - User Home Page

- [x] Build `web/profile.html` as the signed-in user's home page.
- [x] Show my comments with paper title, date, like count, and reply count.
- [x] Show replies from other users to my comments.
- [x] Show my ratings history.
- [x] Show quick links back to each paper discussion page.
- [x] Add empty states for new users.
- [x] Add sign-out from the profile page.
- [x] Keep the page private by default.

## Phase 3 - Discussion Features

- [x] Add `comment_replies` table and RLS.
- [x] Add replies under comments in the sidebar.
- [x] Add replies on `web/paper.html`.
- [x] Add reply notifications on the profile page.
- [x] Add report button for comments.
- [x] Add report button for replies.
- [x] Add copy/share link for paper discussion pages.
- [x] Keep top-level comments article-level only.

## Phase 4 - Moderation And Safety

- [x] Add persistent admin actions for comment hide, restore, and soft-delete.
- [x] Add persistent admin actions for reply hide, restore, and soft-delete from the reports queue.
- [x] Add persistent admin actions for user suspension, reactivation, and deleted status.
- [x] Add persistent admin actions: hide comment, hide reply, restore, delete, suspend user.
- [x] Move admin mutations behind Supabase RPC or Edge Functions.
- [x] Add reports queue with status transitions: open, reviewing, resolved, dismissed.
- [x] Add backend-enforced limits for comments and replies.
- [x] Add basic spam signals: repeated text, too many links, rapid replies, repeated reports.
- [x] Add admin-only user detail view.
- [x] Prevent users from self-restoring role or account status after moderation.
- [x] Add audit trail for moderation actions.
- [x] Add admin filters for comments, reports, users, and audit history.
- [x] Add automated guardrails that keep admin mutations behind audited Supabase RPCs.
- [x] Add automated guardrails that keep cloud comments, replies, ratings, likes, and reports signed-in only.

## Phase 5 - PDF And Paper Detection

- [x] Improve direct PDF URL detection.
- [x] Detect arXiv PDFs reliably.
- [x] Detect DOI from publisher PDF URLs when present.
- [x] Add fallback `pdf:` paper key for PDFs without DOI/arXiv ID.
- [x] Add popup action: open discussion for current PDF.
- [x] Document Chrome built-in PDF viewer limitations.
- [x] Add static regression coverage for PubMed, PMC, preprints, publisher DOI metadata, DOI links, JSON-LD, PII, and PDF fallback detection.
- [x] Test direct PDFs from arXiv, Wiley, Springer, ACS, ScienceDirect, and journal-hosted PDFs.

## Phase 6 - Web Experience

- [x] Improve `web/trending.html` as public discovery page.
- [x] Improve `web/paper.html` as shareable paper discussion page.
- [x] Add live comment and reply counts.
- [x] Add profile navigation.
- [x] Add better loading and error states.
- [x] Add mobile layout checks.
- [x] Keep public pages readable without signing in.

## Phase 7 - Chrome Web Store Readiness

- [x] Keep permissions minimal and justified.
- [x] Add automated guardrails against broad browser permissions and article-content storage.
- [x] Add package guardrails that reject service role keys, secret keys, private keys, and hard-coded passwords.
- [x] Update privacy policy for comments, ratings, likes, replies, reports, and auth data.
- [x] Update store listing text.
- [x] Add release QA checklist for packaged-extension testing, auth checks, PDF checks, and store screenshots.
- [x] Add final release-readiness check command for completed manual results and screenshots.
- [x] Add automated screenshot file and dimension checks for Chrome Web Store assets.
- [x] Add readable release status summary for remaining manual QA and screenshot work.
- [x] Group release status by manual QA section for easier final testing.
- [x] Add one-command local release preparation workflow.
- [x] Show release zip and manual-test folder version freshness in release status.
- [x] Validate manual-test-results metadata against the current release version.
- [x] Generate versioned Chrome Web Store reviewer notes during release preparation.
- [x] Generate a versioned manual test links page during release preparation.
- [x] Generate a versioned screenshot capture guide during release preparation.
- [x] Add a local command to auto-capture the public web screenshots.
- [x] Add a local command to auto-capture signed-out extension screenshots on a real paper page.
- [x] Add an optional two-test-account path for capturing signed-in rating, comment, reply, and report screenshots.
- [x] Add final store screenshots.
- [x] Add screenshots for sidebar, rating, sign-in, popup, trending page, and profile page.
- [x] Add support contact and website links.
- [x] Test extension after packaging, not only unpacked development files.
- [x] Bump version for every submitted package.

## Phase 8 - Growth Without Losing Trust

- [x] Encourage rating with lightweight UI, not dark patterns.
- [x] Add shareable paper discussion links.
- [x] Add shareable comment image.
- [ ] Add optional public profile only after privacy defaults are solid.
- [ ] Consider ORCID or institutional verification later.
- [ ] Consider anonymous lightweight reactions only after backend anti-abuse controls exist.

## Do Not Do Yet

- [x] Do not add anonymous ratings before rate limiting and abuse controls.
- [x] Do not add paid features before moderation and auth are stable.
- [x] Do not request broad browser permissions just to make detection easier.
- [x] Do not store article PDFs, full text, figures, tables, or screenshots.
- [x] Do not make admin actions front-end only.
