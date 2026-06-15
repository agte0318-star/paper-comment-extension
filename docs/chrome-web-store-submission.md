# Chrome Web Store Submission Notes

Use this file when filling Chrome Web Store fields for version `0.5.5`. Keep submission screenshots and notes under `release/store-assets/0.5.5/`.

## Package

- Upload package: `release/paper-comment-extension-0.5.5.zip`
- Manual-test folder: `release/manual-test/paper-comment-extension-0.5.5`
- Website URL: `https://agte0318-star.github.io/paper-comment-extension/`
- Support URL: `https://agte0318-star.github.io/paper-comment-extension/support.html`
- Privacy Policy URL: `https://agte0318-star.github.io/paper-comment-extension/privacy-policy.html`
- Issue tracker: `https://github.com/agte0318-star/paper-comment-extension/issues`

## Single Purpose

Paper Comment Extension lets readers rate and discuss academic papers while reading them. It detects scholarly paper identifiers, opens a sidebar on supported article pages, and syncs signed-in comments, replies, ratings, likes, and reports through Supabase.

## Permission Justifications

### storage

Used to store the user's Supabase sign-in session, extension UI state, popup state, and local fallback data when cloud mode is not configured. This lets the extension keep the user signed in and remember sidebar settings.

### identity

Used only to open the Google sign-in flow and receive the Supabase OAuth redirect inside Chrome. The extension does not read browser history, cookies, or Google account data outside the sign-in flow.

### activeTab

Used only after the user opens the extension popup and clicks the current-paper action. It reads the active tab's title and URL to create or open the matching paper discussion page, especially for PDF tabs where the sidebar cannot always be injected. It is not used to read browsing history.

### Host permission: Supabase project

`https://cckjactvkvgttknhxnot.supabase.co/*`

Used to send signed-in comments, replies, ratings, likes, reports, account session requests, and paper identifiers to the project's Supabase API so discussion can be shared across users and reported content can be reviewed.

### Academic website matches

The extension runs only on scholarly article, preprint, DOI, and publisher domains listed in the manifest. It reads page metadata such as DOI, arXiv ID, PubMed ID, PMC ID, title, and canonical URL to identify the current paper and show the correct discussion panel.

## Data Use Declaration

The extension collects or stores:

- Account email for Supabase sign-in.
- Google account identity information returned by Supabase Auth when Google sign-in is used.
- Optional profile fields entered by the user, such as display name, institution, ORCID, and research field.
- Paper identifiers such as DOI, arXiv ID, PubMed ID, PMC ID, PII, title, source, and page URL.
- User-created comments and replies.
- User-created overall article ratings.
- Comment likes.
- Comment and reply reports.
- Account moderation status.

The extension does not collect, transmit, sell, or share:

- Browser history.
- Cookies.
- Full article text.
- PDF files.
- Paywalled content.
- Figures, tables, screenshots, or article images.
- Payment information.
- Supabase service-role keys, database passwords, or OAuth client secrets.

## Reviewer Notes

This extension is a cloud beta for scholarly discussion. It does not store article PDFs, full paper text, figures, tables, screenshots, or paywalled content. It stores only user-generated discussion data and paper identifiers needed to attach comments and ratings to the correct article.

The `activeTab` permission is only used when the user explicitly opens the popup and clicks the current-paper discussion action. The extension does not monitor all tabs or read browsing history.

The `identity` permission is only used for Supabase Google OAuth sign-in. Email/password sign-in is also available through Supabase Auth.

Moderation actions are enforced by Supabase RLS and RPC functions. Admin-only actions are not protected only by hidden front-end UI.

## Required Final Commands

Run the current release-preparation pipeline first. It runs local checks, source-secret scanning, Google OAuth diagnostics, the account QA finalizer self-check, packaging, package validation, manual-test folder preparation, store-asset preparation, and release status:

```powershell
npm.cmd run release:prepare
```

Then load `release/manual-test/paper-comment-extension-0.5.5` in `chrome://extensions` and complete `docs/release-qa-checklist.md`. For step-by-step Chinese instructions, use `docs/manual-test-guide-zh.md`.

Refresh screenshots and public-page checks:

```powershell
npm.cmd run capture:web-screenshots
npm.cmd run capture:extension-screenshots
npm.cmd run capture:demo-screenshots
npm.cmd run check:public-urls
npm.cmd run check:public-web-render
npm.cmd run check:web-auth-admin-state
npm.cmd run check:extension-auth-gates
npm.cmd run check:extension-demo-interactions
npm.cmd run check:popup-current-paper
npm.cmd run check:popup-account-state
npm.cmd run check:source-secrets
```

Complete the remaining real-account QA. Do not paste real passwords, private email inbox contents, Supabase service-role keys, OAuth client secrets, or Chrome Web Store credentials into any repo file:

```powershell
npm.cmd run qa:account
npm.cmd run finalize:account-qa
```

After manual testing and screenshots are complete, run the final gate:

```powershell
npm.cmd run release:status
npm.cmd run check:release-ready
```

Only upload `release/paper-comment-extension-0.5.5.zip` if `check:release-ready` passes.

## Chrome Web Store Fields To Fill

- Package: `release/paper-comment-extension-0.5.5.zip`
- Store listing text: copy from `docs/store-listing.md`.
- Website URL: `https://agte0318-star.github.io/paper-comment-extension/`
- Support URL: `https://agte0318-star.github.io/paper-comment-extension/support.html`
- Privacy Policy URL: `https://agte0318-star.github.io/paper-comment-extension/privacy-policy.html`
- Reviewer notes: copy from `release/store-assets/0.5.5/reviewer-notes.md`.
- Screenshots folder: `release/store-assets/0.5.5/screenshots/`
- Manual QA record for your archive: `release/store-assets/0.5.5/manual-test-results.md`

Recommended first visibility: `Unlisted`, then switch broader only after the store-installed extension is tested.

## Do Not Upload Until

- The packaged extension has been loaded through `chrome://extensions`.
- Email/password sign-up, sign-in, sign-out, session refresh, and password reset have been tested.
- Google sign-in has been tested if OAuth is enabled.
- arXiv, Wiley or Springer, ACS or ScienceDirect, and direct PDF fallback behavior have been tested.
- Final screenshots have been saved under `release/store-assets/0.5.5/screenshots/`.
- Manual test results have been recorded in `release/store-assets/0.5.5/manual-test-results.md`.
- `npm.cmd run check:release-ready` passes.
- No screenshot exposes private email, passwords, Supabase dashboard secrets, Chrome Web Store credentials, paywalled article text, figures, or tables.
