# Release QA Checklist

Use this checklist before submitting a Chrome Web Store package. Keep screenshots, release notes, and temporary files under this project on `E:`. Use `H:` only for very large assets. Avoid saving generated assets on `C:`.

For a step-by-step Chinese guide, use `docs/manual-test-guide-zh.md`. For the production upload tracker, use `docs/launch-readiness.md`.

## 1. Build And Package

- Run `npm.cmd run release:prepare` to run local checks, rebuild the zip, prepare the manual-test folder, prepare store assets, and print release status in one pass.
- Run `npm.cmd run check`.
- Run `npm.cmd run package`.
- Confirm the package path is `release/paper-comment-extension-<version>.zip`.
- Run `npm.cmd run check:package`.
- Confirm the package contains only `manifest.json`, `src/`, and `public/icons/`.
- Confirm package checks reject service role keys, secret keys, private keys, and hard-coded passwords.
- Confirm `manifest.json` and `package.json` use the same version.
- Copy `docs/manual-test-results-template.md` to `release/store-assets/<version>/manual-test-results.md` and record results as you test.
- Run `npm.cmd run release:status` whenever you want a readable summary of remaining manual-test and screenshot work, grouped by QA section.
- Confirm `release:status` shows matching versions for `manifest.json`, `package.json`, the release zip, and the manual-test folder.
- Confirm `release:status` shows `manual-test-results.md` metadata for the current version, release zip, and packaged manual-test folder.
- Run `npm.cmd run check:public-urls` after pushing to GitHub to confirm the homepage, web app pages, privacy policy, and support page are publicly reachable.
- Run `npm.cmd run check:public-web-render` after GitHub Pages deploys to confirm public pages render in a real browser and core public interactions work.
- Run `npm.cmd run check:web-auth-admin-state` after GitHub Pages deploys to confirm mocked signed-in profile activity, non-admin admin denial, and active-admin dashboard rendering in a real browser.
- Run `npm.cmd run check:extension-auth-gates` to confirm signed-out extension actions open the correct sign-in modal and comment sorting works in a real browser with privacy-safe demo data.
- Run `npm.cmd run check:extension-demo-interactions` to confirm signed-in rating, comment, one-comment-per-day, like, reply, report, and share-image flows work in a real browser with privacy-safe demo data.
- Run `npm.cmd run check:popup-current-paper` to confirm the popup current-paper action builds correct fallback discussion URLs for PDF and PDF-viewer tabs.
- Run `npm.cmd run check:popup-account-state` to confirm the popup displays a signed-in account state and local sign-out clears the saved session.
- When real test accounts are ready, run `npm.cmd run check:live-account-flow` with credentials set only in the current terminal to verify reader sign-in, password reset, optional sign-up, and optional admin role.
- Confirm `release/store-assets/<version>/reviewer-notes.md` exists for Chrome Web Store reviewer notes.
- Open `release/store-assets/<version>/manual-test-links.html` as the central link page for manual QA.

## 2. Load The Packaged Extension

- Run `npm.cmd run prepare:manual-test`.
- Copy the output folder path. It should be under `release/manual-test/`.
- Open `chrome://extensions`.
- Enable Developer mode.
- Remove any older unpacked copy of this extension.
- Click `Load unpacked`.
- Select the output folder from `npm.cmd run prepare:manual-test`, not the source project folder.
- Confirm Chrome shows the expected extension version.
- Pin the extension to the toolbar.

## 3. Account Flow Test

- Open a supported paper page.
- Click the comments button.
- Run `npm.cmd run check:extension-auth-gates` for an automated signed-out auth-gate and comment sorting check.
- Click `Rate`, `Post comment`, `Like`, `Reply`, and `Report` while signed out.
- Confirm each action opens the sign-in dialog with a relevant message.
- Create a test email/password account.
- If email confirmation is enabled, confirm the email and then sign in.
- Sign out from the popup.
- Sign in again with the same email/password.
- Request a password reset email.
- Run `npm.cmd run check:popup-account-state` to verify popup signed-in display and local sign-out UI behavior without exposing real credentials.
- Run `npm.cmd run check:live-account-flow` after setting `PCE_TEST_EMAIL` and `PCE_TEST_PASSWORD`; optionally set `PCE_TEST_NEW_EMAIL`, `PCE_TEST_NEW_PASSWORD`, `PCE_TEST_ADMIN_EMAIL`, and `PCE_TEST_ADMIN_PASSWORD`.
- Test Google sign-in if Supabase and Google OAuth are configured.
- Confirm the popup shows the signed-in account and provider.
- Confirm the profile page opens and shows only the signed-in user's activity.

## 4. Paper Page Test

- Test an arXiv abstract page.
- Test a DOI-based publisher page from Wiley or Springer.
- Test one ACS or ScienceDirect article page.
- Confirm the sidebar appears where supported.
- Confirm the paper title and identifier are correct.
- Run `npm.cmd run check:extension-demo-interactions` for an automated signed-in interaction check with demo data.
- Submit one rating.
- Confirm the community average rating updates.
- Submit one comment.
- Confirm a second comment on the same paper is blocked for the same day.
- Like another user's comment if a second test account is available.
- Reply to a comment.
- Report a comment and a reply.
- Confirm comments can be sorted by newest and popularity.
- Generate a share image from a comment.

## 5. PDF Detection Test

- Test an arXiv PDF URL.
- Test a Wiley PDF or PDFDirect URL.
- Test a Springer content PDF URL.
- Test an ACS PDF URL.
- Test a ScienceDirect PDF or PII PDF URL.
- Test one journal-hosted PDF without a DOI in the URL.
- Run `npm.cmd run check:popup-current-paper` to verify the popup fallback discussion action for arXiv, DOI, PII, and generic PDF tabs.
- When Chrome blocks sidebar injection, open the extension popup and click the current-paper discussion action.
- Confirm the fallback discussion page uses DOI or arXiv ID when available.
- Confirm the fallback uses a `pdf:` key only when no DOI, arXiv ID, PubMed ID, PMC ID, or PII can be found.

## 6. Public Web Pages

- Run `npm.cmd run check:public-urls` and confirm all GitHub Pages URLs return `OK`.
- Run `npm.cmd run check:public-web-render` and confirm trending search/sort, paper copy/share, and signed-out profile rendering pass.
- Open `web/trending.html` through GitHub Pages.
- Confirm trending papers, top-rated papers, and hot comments render.
- Search for a paper.
- Sort by activity and rating.
- Open a public paper discussion page.
- Copy and share the discussion URL.
- Open `web/profile.html`.
- Confirm signed-out users see the auth panel.
- Run `npm.cmd run check:web-auth-admin-state` to verify signed-in profile rendering and admin permission branches with privacy-safe mocked Supabase responses.
- Sign in and confirm comments, replies, likes, ratings, and profile details load.
- Open `web/admin.html` with a non-admin account and confirm access is denied.
- Open `web/admin.html` with an active admin account and confirm moderation actions are visible.

## 7. Chrome Web Store Screenshots

- Run `npm.cmd run prepare:store-assets`.
- Save screenshots under `release/store-assets/<version>/screenshots/`.
- Use the generated `screenshot-checklist.md`, `screenshot-capture-guide.md`, and `store-links.txt` files in `release/store-assets/<version>/`.
- Run `npm.cmd run capture:web-screenshots` to auto-capture the public web screenshots for trending, paper discussion, and profile pages when Microsoft Edge is installed.
- Run `npm.cmd run capture:extension-screenshots` to auto-capture signed-out extension screenshots on a real arXiv page.
- Run `npm.cmd run capture:demo-screenshots` to auto-capture the signed-in rating, rated comment, replies, and report-form screenshots with privacy-safe demo data from a temporary extension copy under `release/`.
- To capture the signed-in interaction screenshots, temporarily set `PCE_TEST_AUTHOR_EMAIL`, `PCE_TEST_AUTHOR_PASSWORD`, `PCE_TEST_EMAIL`, and `PCE_TEST_PASSWORD` in the current terminal only, then rerun `npm.cmd run capture:extension-screenshots`. Never write test passwords into repo files.
- Save screenshots as full-bleed PNG files at `1280x800` or `640x400`; prefer `1280x800`.

- Sidebar closed on a paper page.
- Sidebar open with article title and DOI or arXiv ID.
- Sign-in dialog with Google and email options.
- Rating panel expanded with the overall score selector.
- Comment card showing `Rated x/10`.
- Comment card with replies and action buttons.
- Report form.
- Popup with profile, trending, privacy, and current-paper actions.
- Trending page.
- Paper discussion page.
- Profile page.

## 8. Store Listing Review

- Open `docs/chrome-web-store-submission.md`.
- Open `release/store-assets/<version>/reviewer-notes.md` for reviewer notes generated for this version.
- Copy the short description from `docs/store-listing.md`.
- Copy the detailed description from `docs/store-listing.md`.
- Copy permission explanations and reviewer notes from `docs/chrome-web-store-submission.md`.
- Confirm the Website URL is `https://agte0318-star.github.io/paper-comment-extension/`.
- Confirm the Support URL is `https://agte0318-star.github.io/paper-comment-extension/support.html`.
- Confirm the Privacy Policy URL is `https://agte0318-star.github.io/paper-comment-extension/privacy-policy.html`.
- Run `npm.cmd run check:release-ready` after all manual results and screenshots are complete.
- If `check:release-ready` fails, run `npm.cmd run release:status` to see the remaining items grouped by category.
- Upload the latest release zip only after all required manual checks above pass.

## 9. After Submission

- Record the submitted version and date in the release notes or issue tracker.
- Update `release/store-assets/<version>/manual-test-results.md` with the submitted version, submission date, and Chrome Web Store status.
- Keep the submitted zip under `release/`.
- Watch Chrome Web Store review status.
- If rejected, fix only the specific issue, bump the version, rebuild, and submit a new zip.
- After approval, publish to the intended visibility level and monitor early user feedback.
