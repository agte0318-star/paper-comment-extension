# Chrome Web Store Listing Draft

## Name

Paper Comment Extension

## Short Description

Rate and comment on academic papers while reading them.

## Detailed Description

Paper Comment Extension adds a lightweight sidebar to supported academic paper pages. It lets readers post shared overall comments, rate papers from 1 to 10, like other users' comments, sort discussion by time or popularity, and generate a shareable comment image.

This v0.2 release is an early cloud beta. Signed-in comments, ratings, and likes are stored in Supabase so other users can see discussion for the same paper.

Key features:

- Detects arXiv IDs, PubMed IDs, PMC IDs, and DOI-based paper pages across a broad SCI publisher and journal allowlist, including Wiley journal subdomains, SciOpen, Science China platforms, and other major natural science publishers.
- Adds a clean right-side paper comment panel.
- Supports email/password sign-in through Supabase Auth.
- Saves one overall paper comment per signed-in user per paper per day.
- Saves one overall article rating per signed-in user and paper.
- Allows one rating update per signed-in user per paper per day.
- Shows the community average article rating in the rating panel.
- Shows a comment author's overall article score when that author has rated the paper.
- Lets users like comments written by other users.
- Sorts comments by newest or popularity.
- Generates a shareable PNG image from a comment.
- Uses a starter local blocklist to reduce abusive or spam-like comments.
- Does not upload PDFs, article text, paywalled content, figures, tables, or screenshots.

Current limitations:

- This is an early beta, so moderation tools are still being expanded.
- OAuth login is not enabled yet.
- Admin moderation actions are not persistent yet and will require a future admin sign-in flow.

## Suggested Category

Productivity

## Suggested Visibility

Unlisted for the first beta.

## Permission Explanation

### storage

Used to store the user's Supabase sign-in session, extension UI state, and local fallback data when cloud mode is not configured.

### Supabase project host

Used to send signed-in comments, ratings, likes, and paper identifiers to the project's Supabase API so discussion can be shared across users.

### Supported academic websites

Used to detect paper identifiers such as DOI, arXiv ID, PubMed ID, PMC ID, title, and canonical URL, then inject the paper comment sidebar on scholarly article pages.

## Privacy Summary

The extension stores signed-in comments, article ratings, likes, and paper identifiers in Supabase. It does not upload PDF files, full article text, paywalled content, figures, tables, screenshots, browsing history, cookies, or payment information.

## Screenshot Checklist

- Sidebar closed on a paper page.
- Sidebar open with article title and DOI/arXiv ID.
- Sign-in panel.
- Article rating panel expanded.
- Comment card showing `Rated x/10`.
- Comment list sorted by newest and popularity.
- Empty comment state.
