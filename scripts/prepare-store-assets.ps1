$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$version = (Get-Content (Join-Path $root "manifest.json") | ConvertFrom-Json).version
$assetRoot = Join-Path $root "release\store-assets\$version"
$screenshotsDir = Join-Path $assetRoot "screenshots"
$checklistPath = Join-Path $assetRoot "screenshot-checklist.md"
$linksPath = Join-Path $assetRoot "store-links.txt"
$reviewerNotesPath = Join-Path $assetRoot "reviewer-notes.md"
$manualLinksPath = Join-Path $assetRoot "manual-test-links.html"
$screenshotGuidePath = Join-Path $assetRoot "screenshot-capture-guide.md"
$manualResultsTemplate = Join-Path $root "docs\manual-test-results-template.md"
$manualResultsPath = Join-Path $assetRoot "manual-test-results.md"

New-Item -ItemType Directory -Force -Path $screenshotsDir | Out-Null

$checklist = @"
# Chrome Web Store Screenshot Checklist

Version: $version

Save final screenshots in this folder:

$screenshotsDir

Recommended filenames:

- 01-sidebar-closed.png
- 02-sidebar-open-paper-id.png
- 03-sign-in-dialog.png
- 04-rating-panel.png
- 05-comment-rated.png
- 06-comment-replies-actions.png
- 07-report-form.png
- 08-popup-actions.png
- 09-trending-page.png
- 10-paper-discussion-page.png
- 11-profile-page.png

Capture notes:

- Use the packaged extension from release/manual-test/paper-comment-extension-$version.
- Chrome Web Store screenshots must be full-bleed PNG files at 1280x800 or 640x400. Prefer 1280x800.
- Avoid showing private emails, private test passwords, Supabase dashboard secrets, or Chrome Web Store credentials.
- Do not capture PDF article text, figures, tables, or paywalled content as the focus of a screenshot.
- Crop only browser chrome if needed; keep the extension UI and page context clear.
- Use English UI in all screenshots.
"@

$screenshotGuide = @"
# Screenshot Capture Guide

Version: $version

Save every final image in:

$screenshotsDir

Use PNG at 1280x800 whenever possible. 640x400 is accepted, but 1280x800 gives the Chrome Web Store page more breathing room.

## Capture Queue

| File | What to open | What to show | Avoid |
| --- | --- | --- | --- |
| 01-sidebar-closed.png | A supported paper page after loading the packaged extension | The small movable Comments 0 button on a real scholarly page | Long article text, paywalled figures, private browser data |
| 02-sidebar-open-paper-id.png | The same paper page | Sidebar open with title, DOI/arXiv/PubMed/PII identifier, average rating, and comment area | Private email, passwords, Supabase dashboard |
| 03-sign-in-dialog.png | Click Rate, Sign in, or a signed-out comment action | Sign-in dialog with email/password and Google option visible | Real personal email if you do not want it public |
| 04-rating-panel.png | Open the rating panel | Overall score selector, community average, and the focused rating number | Any unrelated article body text |
| 05-comment-rated.png | A paper with one test comment and rating | Comment card showing the comment plus Rated x/10 | Private email or unmoderated offensive test text |
| 06-comment-replies-actions.png | A comment with a reply | Like, Reply, Share, Report actions and at least one reply | Personal information in the reply |
| 07-report-form.png | Click Report on another user's comment or reply | Report reason selector and details field | Submitting an abusive-looking screenshot to the store |
| 08-popup-actions.png | Extension toolbar popup | Account state, current-paper action, profile, trending, privacy/support actions | Chrome profile email if visible outside the extension UI |
| 09-trending-page.png | https://agte0318-star.github.io/paper-comment-extension/web/trending.html | Trending list, search/sort controls, top comments or empty state | Browser bookmarks bar with private items |
| 10-paper-discussion-page.png | A shareable web/paper.html discussion URL | Paper title, metrics, comments, and share/copy controls | Paywalled article content |
| 11-profile-page.png | web/profile.html while signed in or signed out | Profile activity or signed-out auth panel | Private email unless it is a disposable test account |

## Suggested Screenshot Order

1. Run npm.cmd run capture:extension-screenshots to capture 01, 02, 03, and 08 from the packaged extension.
2. Run npm.cmd run capture:web-screenshots to capture 09, 10, and 11 from the local web pages.
3. Load the packaged extension from $root\release\manual-test\paper-comment-extension-$version.
4. Sign in with a disposable test account.
5. Add one rating, one comment, one reply, and one report on test content.
6. Capture the remaining signed-in interaction states: 04, 05, 06, and 07.
7. Optional: set PCE_TEST_AUTHOR_EMAIL, PCE_TEST_AUTHOR_PASSWORD, PCE_TEST_EMAIL, and PCE_TEST_PASSWORD only in your current terminal, then rerun npm.cmd run capture:extension-screenshots to let the script prepare test data and attempt 04, 05, 06, and 07.
8. Run npm.cmd run release:status to see which screenshots are still missing.
9. Run npm.cmd run check:release-ready only after every manual result is no longer Pending.

## Privacy Review Before Upload

- Do not show passwords, auth tokens, Supabase keys, Chrome Web Store credentials, or private inboxes.
- Do not make paywalled article text, figures, tables, or PDFs the focus of a screenshot.
- Use clear English UI.
- Prefer neutral test comments such as Helpful discussion point for testing. instead of real unpublished research notes.
"@

$links = @"
Chrome Web Store Submission Links

Website URL:
https://agte0318-star.github.io/paper-comment-extension/

Support URL:
https://agte0318-star.github.io/paper-comment-extension/support.html

Privacy Policy URL:
https://agte0318-star.github.io/paper-comment-extension/privacy-policy.html

Issue tracker:
https://github.com/agte0318-star/paper-comment-extension/issues

Latest release package:
release/paper-comment-extension-$version.zip

Packaged manual-test folder:
release/manual-test/paper-comment-extension-$version
"@

$reviewerNotes = @"
# Chrome Web Store Reviewer Notes

Version: $version

## Single purpose

Paper Comment Extension lets readers rate and discuss academic papers while reading them. It detects scholarly paper identifiers, opens a sidebar on supported article pages, and syncs signed-in comments, replies, ratings, likes, and reports through Supabase.

## Permission explanations

storage:
Used to store the user's Supabase sign-in session, extension UI state, popup state, and local fallback data when cloud mode is not configured.

identity:
Used only for Supabase Google OAuth sign-in. The extension does not read browser history, cookies, or Google account data outside the sign-in flow.

activeTab:
Used only after the user opens the extension popup and clicks the current-paper discussion action. It reads the active tab title and URL to create or open the matching paper discussion page, especially for PDF tabs where the sidebar cannot always be injected.

Host permission:
https://cckjactvkvgttknhxnot.supabase.co/*

This host permission is used for Supabase API requests: comments, replies, ratings, likes, reports, auth session requests, profiles, and moderation workflows.

Academic website matches:
The extension runs only on scholarly article, preprint, DOI, and publisher domains listed in the manifest. It reads page metadata such as DOI, arXiv ID, PubMed ID, PMC ID, PII, title, source, and canonical URL to identify the current paper.

## Data use

The extension stores user-generated discussion data and paper identifiers needed to attach comments and ratings to the correct article. It may store account email through Supabase Auth, optional profile fields entered by the user, comments, replies, ratings, likes, reports, and moderation status.

The extension does not collect, transmit, sell, or share browser history, cookies, full article text, PDF files, paywalled content, figures, tables, screenshots, payment information, Supabase service-role keys, database passwords, or OAuth client secrets.

## Moderation and admin safety

Moderation actions are enforced by Supabase RLS and audited RPC functions. Admin-only actions are not protected only by hidden front-end UI. The package checks also reject service role keys, secret keys, private keys, hard-coded passwords, broad host permissions, and article-content storage fields.

## Manual QA status

Before upload, complete:

- Packaged extension test through chrome://extensions using release/manual-test/paper-comment-extension-$version.
- Account flow test.
- Paper page test.
- PDF detection test.
- Public web page test.
- Final Chrome Web Store screenshots.
- Privacy screenshot review.

Run npm.cmd run check:release-ready before uploading. Upload only if it passes.
"@

$manualLinks = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Paper Comment Extension Manual Test Links $version</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.5;
      margin: 32px;
      color: #1f2a2a;
      background: #f8faf8;
    }
    main {
      max-width: 920px;
      margin: 0 auto;
    }
    h1, h2 {
      color: #0f766e;
    }
    section {
      margin: 24px 0;
      padding: 20px;
      background: #ffffff;
      border: 1px solid #d8e5e1;
      border-radius: 8px;
    }
    code {
      background: #edf7f4;
      padding: 2px 5px;
      border-radius: 4px;
    }
    a {
      color: #0f766e;
      font-weight: 700;
    }
    li {
      margin: 8px 0;
    }
  </style>
</head>
<body>
  <main>
    <h1>Paper Comment Extension Manual Test Links</h1>
    <p>Version: <strong>$version</strong></p>
    <p>Use this page after running <code>npm.cmd run release:prepare</code>. Keep screenshots and notes under <code>release/store-assets/$version</code>.</p>

    <section>
      <h2>1. Load Packaged Extension</h2>
      <ol>
        <li>Open <a href="chrome://extensions">chrome://extensions</a>.</li>
        <li>Enable Developer mode.</li>
        <li>Click <strong>Load unpacked</strong>.</li>
        <li>Select this folder:<br><code>$root\release\manual-test\paper-comment-extension-$version</code></li>
      </ol>
    </section>

    <section>
      <h2>2. Paper And PDF Test Pages</h2>
      <ul>
        <li><a href="https://arxiv.org/abs/1706.03762">arXiv abstract example</a></li>
        <li><a href="https://arxiv.org/pdf/1706.03762.pdf">arXiv PDF example</a></li>
        <li><a href="https://doi.org/">DOI resolver homepage</a></li>
        <li>Also test one real Wiley or Springer page, one ACS or ScienceDirect page, and one journal-hosted PDF without DOI in the URL.</li>
      </ul>
    </section>

    <section>
      <h2>3. Public Web Pages</h2>
      <ul>
        <li><a href="https://agte0318-star.github.io/paper-comment-extension/">Homepage</a></li>
        <li><a href="https://agte0318-star.github.io/paper-comment-extension/web/trending.html">Trending page</a></li>
        <li><a href="https://agte0318-star.github.io/paper-comment-extension/web/profile.html">Profile page</a></li>
        <li><a href="https://agte0318-star.github.io/paper-comment-extension/web/admin.html">Admin page</a></li>
        <li><a href="https://agte0318-star.github.io/paper-comment-extension/support.html">Support page</a></li>
        <li><a href="https://agte0318-star.github.io/paper-comment-extension/privacy-policy.html">Privacy policy</a></li>
      </ul>
    </section>

    <section>
      <h2>4. Local Release Files</h2>
      <ul>
        <li>Manual results: <code>$assetRoot\manual-test-results.md</code></li>
        <li>Screenshots folder: <code>$screenshotsDir</code></li>
        <li>Reviewer notes: <code>$reviewerNotesPath</code></li>
        <li>Release package: <code>$root\release\paper-comment-extension-$version.zip</code></li>
      </ul>
    </section>
  </main>
</body>
</html>
"@

Set-Content -LiteralPath $checklistPath -Value $checklist -Encoding UTF8
Set-Content -LiteralPath $linksPath -Value $links -Encoding UTF8
Set-Content -LiteralPath $reviewerNotesPath -Value $reviewerNotes -Encoding UTF8
Set-Content -LiteralPath $manualLinksPath -Value $manualLinks -Encoding UTF8
Set-Content -LiteralPath $screenshotGuidePath -Value $screenshotGuide -Encoding UTF8
if (-not (Test-Path $manualResultsPath)) {
  Copy-Item -LiteralPath $manualResultsTemplate -Destination $manualResultsPath
}

Write-Host "Prepared Chrome Web Store asset folder:"
Write-Host $assetRoot
Write-Host "Save screenshots in:"
Write-Host $screenshotsDir
Write-Host "Reviewer notes:"
Write-Host $reviewerNotesPath
Write-Host "Manual test links:"
Write-Host $manualLinksPath
Write-Host "Screenshot capture guide:"
Write-Host $screenshotGuidePath
