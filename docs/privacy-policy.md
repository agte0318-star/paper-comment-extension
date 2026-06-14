# Privacy Policy

Effective date: June 3, 2026

Paper Comment Extension is a browser extension for rating and commenting on academic papers while reading them.

## Data Stored Locally

The extension stores the following data locally in the user's browser through `chrome.storage.local`:

- The Supabase sign-in session for the current user, including sessions created through Google sign-in.
- Draft interface state needed by the extension.
- A local anonymous browser identifier used only when the extension is running without Supabase cloud mode.
- Local fallback comments, ratings, likes, and replies when Supabase is not configured.

## Data Sent to Supabase

When a user signs in and uses cloud mode, the extension sends the following user-created or article-identifying data to Supabase:

- Email address for account sign-in.
- Google account identity information returned by Supabase Auth when Google sign-in is used, such as email address and display name.
- Optional profile information entered by the user, such as display name, institution, ORCID, and research field.
- Account moderation status, such as active, suspended, or deleted, so the service can enforce community safety rules.
- Paper identifiers such as DOI, arXiv ID, PubMed ID, PMC ID, title, source, and page URL.
- User-created comments.
- User-created replies to comments.
- User-created overall article ratings.
- Comment likes.
- Comment and reply reports when reporting is enabled.

This data is used to show shared comments, replies, ratings, and likes to other users reading the same paper, and to show signed-in users their own activity on the profile page.

## Data Not Collected

The extension does not collect, transmit, sell, or share:

- Browser history.
- Full article text.
- PDF files.
- Paywalled content.
- Figures, tables, screenshots, or article images.
- Cookies.
- Payment information.
- Supabase service role keys or other private server credentials.

## Website Access

The extension runs only on scholarly domains listed in the extension manifest. It reads page metadata such as DOI, arXiv ID, PubMed ID, PMC ID, title, and canonical URL to identify the paper and show the correct comment panel. When the user opens the extension popup and chooses to open the current paper discussion, the extension may read the active tab's title and URL to create the matching discussion link, especially for PDF tabs.

## Data Sharing

Comments, replies, ratings, and likes submitted in cloud mode are stored in Supabase and may be visible to other extension users. The extension does not sell user data or use user data for advertising.

## Data Retention and Deletion

Local data remains in the browser until the user removes the extension, clears extension storage, or signs out. Cloud comments, replies, ratings, likes, and paper metadata remain in Supabase until they are deleted, moderated, or removed by the project maintainer.

## Security

The extension uses Chrome extension storage APIs, Chrome's identity API for Google sign-in, Chrome's activeTab permission for user-initiated current-page discussion links, and the Supabase public client API. It does not request access to cookies, browsing history, ongoing tab monitoring, or web request data.

## Contact

For privacy questions, contact the project maintainer through the support contact listed on the Chrome Web Store listing or GitHub repository.
