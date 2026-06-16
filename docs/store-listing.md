# Chrome Web Store Listing Draft

## Name

Paper Comment Extension

## Short Description

Rate and comment on academic papers while reading them.

## Detailed Description

Paper Comment Extension adds a lightweight sidebar to supported academic paper pages. It lets readers post shared overall comments, rate papers from 1 to 10, like, reply to, and report other users' comments and replies, sort discussion by time or popularity, and generate a shareable comment image.

This release is a cloud beta for public testing. Signed-in comments, replies, ratings, likes, and comment or reply reports are stored in Supabase so other users can see discussion for the same paper and the maintainer can review reported content.

Key features:

- Detects arXiv IDs, PubMed IDs, PMC IDs, and DOI-based paper pages across a broad SCI publisher and journal allowlist, including Wiley journal subdomains, SciOpen, Science China platforms, and other major natural science publishers.
- Adds a clean right-side paper comment panel.
- Supports Google sign-in and email/password sign-in through Supabase Auth.
- Supports email/password account creation from the extension and profile page.
- Shows clear email confirmation guidance when Supabase requires new users to confirm their email before signing in.
- Lets users resend the email confirmation message if the first confirmation email does not arrive.
- Supports password reset emails for email/password accounts.
- Adds a popup with profile, trending, privacy, and reset-position shortcuts.
- Adds a popup shortcut to open the discussion page for the current article or PDF tab when the sidebar cannot appear.
- Shows a concise popup account card with sign-in state and account provider.
- Saves one overall paper comment per signed-in user per paper per day.
- Lets signed-in users reply to comments.
- Lets signed-in users report comments and replies for moderator review, with duplicate reports from the same user blocked by the database.
- Saves one overall article rating per signed-in user and paper.
- Allows one rating update per signed-in user per paper per day.
- Shows the community average article rating in the rating panel.
- Encourages lightweight article scoring with a small, non-blocking prompt instead of popups or forced actions.
- Shows a comment author's overall article score when that author has rated the paper.
- Lets users like comments written by other users.
- Provides a signed-in profile page for a user's own comments, received likes, received replies, and rating history.
- Keeps public author labels based on display names instead of real email addresses.
- Shows visible comment replies on public paper discussion pages.
- Shows live comment and reply counts on public discovery and paper discussion pages.
- Lets readers search and sort public paper activity on the discovery page.
- Shows per-paper discussion metrics and a copyable public discussion URL on paper pages.
- Lets users copy or share public paper discussion links from the web paper page.
- Provides web navigation to the signed-in profile page.
- Lets signed-in users edit display name, institution, ORCID, and research field.
- Detects direct PDF URLs, arXiv PDF URLs, common publisher PDF/EPDF/PDFDirect URLs, and DOI-bearing PDF links when Chrome allows the content script to run.
- Falls back to a shareable discussion page for direct PDFs or Chrome PDF viewer tabs when normal sidebar injection is limited, including source URLs from the PDF viewer and ScienceDirect PII links.
- Sorts comments by newest or popularity.
- Generates a shareable PNG image from a comment.
- Uses a starter local blocklist to reduce abusive or spam-like comments.
- Does not upload PDFs, article text, paywalled content, figures, tables, or screenshots.

Current limitations:

- This is a beta release, so community scale, moderation workflow, and publisher coverage should be monitored closely after launch.
- Google OAuth requires Supabase and Google Cloud provider configuration before production release.
- Report status updates, comment/reply hide, restore, and soft-delete actions, and user suspension/reactivation are available for active admin accounts through backend RPC actions with moderation audit logs.
- Admin user detail panels show recent comments, replies, reports filed, and status moderation history.
- Admin filters help review comments, reports, users, and audit history by status, type, role, and search text.
- Backend spam guards limit rapid comments, rapid replies, repeated reports, duplicate text, and link-heavy submissions.
- Chrome's built-in PDF viewer can limit direct sidebar injection; direct PDF detection will fall back to discussion links where needed.

## Suggested Category

Productivity

## Suggested Visibility

Unlisted for the first beta.

## Store Links

- Website URL: `https://agte0318-star.github.io/paper-comment-extension/`
- Support URL: `https://agte0318-star.github.io/paper-comment-extension/support.html`
- Privacy Policy URL: `https://agte0318-star.github.io/paper-comment-extension/privacy-policy.html`
- Issue tracker: `https://github.com/agte0318-star/paper-comment-extension/issues`

## Permission Explanation

### storage

Used to store the user's Supabase sign-in session, extension UI state, popup state, and local fallback data when cloud mode is not configured.

### identity

Used only to open the Google sign-in flow and receive the Supabase OAuth redirect inside Chrome. The extension does not read browser history, cookies, or Google account data outside the sign-in flow.

### activeTab

Used only after the user opens the extension popup and clicks the current-paper action. It reads the active tab's title and URL to create or open the matching paper discussion page, especially for PDF tabs where the sidebar cannot always be injected. It is not used to read browsing history.

### Supabase project host

Used to send signed-in comments, replies, ratings, likes, comment reports, and paper identifiers to the project's Supabase API so discussion can be shared across users and reported content can be reviewed.

### Supported academic websites

Used to detect paper identifiers such as DOI, arXiv ID, PubMed ID, PMC ID, title, and canonical URL, then inject the paper comment sidebar on scholarly article pages.

## Privacy Summary

The extension stores signed-in comments, replies, article ratings, likes, comment reports, account moderation status, and paper identifiers in Supabase. It does not upload PDF files, full article text, paywalled content, figures, tables, screenshots, browsing history, cookies, or payment information.

## Screenshot Checklist

- Sidebar closed on a paper page.
- Sidebar open with article title and DOI/arXiv ID.
- Sign-in panel with Google and email options.
- Popup with profile and trending links.
- Profile page with user activity.
- Article rating panel expanded.
- Comment card showing `Rated x/10`.
- Comment card with replies.
- Comment report form.
- Comment list sorted by newest and popularity.
- Empty comment state.
