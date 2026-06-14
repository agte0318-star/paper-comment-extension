# Launch Readiness Checklist

This checklist tracks the remaining work required before uploading a production-ready Chrome Web Store package.

Current candidate version: `0.5.5`

## Current Status

- Release package: `release/paper-comment-extension-0.5.5.zip`
- Packaged manual-test folder: `release/manual-test/paper-comment-extension-0.5.5`
- Store assets folder: `release/store-assets/0.5.5`
- Screenshots: `7/11` valid
- Manual QA: pending
- Upload gate: `npm.cmd run check:release-ready`
- Current upload status: not ready

## Must Finish Before Upload

1. Test accounts
   - Create two ordinary test accounts: author and reader.
   - Confirm the test emails if Supabase requires email confirmation.
   - Confirm one active admin account for admin-page testing.
   - Keep test passwords out of repo files, screenshots, and notes.

2. Packaged extension test
   - Load `release/manual-test/paper-comment-extension-0.5.5` through `chrome://extensions`.
   - Confirm Chrome shows version `0.5.5`.
   - Pin the extension.
   - Confirm this is the packaged folder, not the source folder.

3. Account flow
   - Signed-out rating, comment, like, reply, and report actions open the sign-in dialog.
   - Email/password sign-up works.
   - Email confirmation flow is understandable.
   - Email/password sign-in works.
   - Popup sign-out works.
   - Password reset can be requested.
   - Google sign-in works if configured.
   - Profile page shows only the signed-in user's activity.

4. Paper interaction flow
   - arXiv abstract page detected.
   - Wiley or Springer article detected.
   - ACS or ScienceDirect article detected.
   - Overall rating can be submitted.
   - Community average rating updates.
   - Comment can be posted.
   - Same user cannot post a second comment on the same paper on the same day.
   - Like, reply, report, sorting, and share image generation work.

5. PDF detection flow
   - arXiv PDF detected.
   - Wiley PDF or PDFDirect detected.
   - Springer content PDF detected.
   - ACS PDF detected.
   - ScienceDirect PDF or PII PDF detected.
   - Journal-hosted PDF without DOI falls back safely.
   - DOI, arXiv ID, PubMed ID, PMC ID, or PII is preferred over `pdf:` when available.

6. Public web pages
   - Homepage opens.
   - Trending page opens and renders data or empty state.
   - Search and sorting work.
   - Paper discussion page opens from a shared URL.
   - Profile page signed-out and signed-in states work.
   - Admin page denies non-admin accounts and allows an active admin account.

7. Supabase safety
   - RLS stays enabled.
   - Ordinary users cannot change other users' comments, ratings, or profiles.
   - Ordinary users cannot access admin actions.
   - Admin actions are audited through RPC-backed moderation actions.
   - Service-role keys and secrets are not shipped in the extension.
   - PDFs, full text, figures, tables, screenshots, and paywalled article content are not stored.
   - Cloud comments, ratings, likes, replies, and reports remain signed-in only.

8. Screenshots
   - Already generated: `01`, `02`, `03`, `08`, `09`, `10`, `11`.
   - Still missing:
     - `04-rating-panel.png`
     - `05-comment-rated.png`
     - `06-comment-replies-actions.png`
     - `07-report-form.png`
   - Use PNG only.
   - Use `1280x800` or `640x400`.

9. Screenshot privacy review
   - No private real email addresses.
   - No passwords.
   - No Supabase secrets or service-role keys.
   - No Chrome Web Store credentials.
   - No paywalled article text, figures, or tables as the screenshot focus.

10. Manual test results
    - Complete `release/store-assets/0.5.5/manual-test-results.md`.
    - No `Pending` table items.
    - No `Fail` table items.
    - Set `Ready to upload: Yes`.
    - Set `Chrome Web Store status: Ready to submit`.

11. Final commands

```powershell
npm.cmd run release:prepare
npm.cmd run capture:web-screenshots
npm.cmd run capture:extension-screenshots
npm.cmd run check:source-secrets
npm.cmd run release:status
npm.cmd run check:release-ready
```

Only upload the zip after `npm.cmd run check:release-ready` passes.

## Optional Signed-In Screenshot Automation

To attempt the remaining signed-in screenshots, set these only in the current terminal:

```powershell
$env:PCE_TEST_AUTHOR_EMAIL="author-test@example.com"
$env:PCE_TEST_AUTHOR_PASSWORD="your-author-test-password"
$env:PCE_TEST_EMAIL="reader-test@example.com"
$env:PCE_TEST_PASSWORD="your-reader-test-password"
npm.cmd run capture:extension-screenshots
```

Never commit, paste, or screenshot the real passwords.

## After Upload

- Record submitted version `0.5.5`.
- Record the submission date.
- Keep the submitted zip and screenshots under `release/`.
- Watch Chrome Web Store review status.
- If rejected, fix only the specific issue, bump the version, rebuild, and submit a new zip.
- After approval, publish to the intended visibility level and test the store-installed extension.
