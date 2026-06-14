# Manual Test Results Template

Copy this file into `release/store-assets/<version>/manual-test-results.md` before a Chrome Web Store submission. Do not write passwords, private Supabase keys, Chrome Web Store credentials, or private email inbox contents into the copied file.

## Test Metadata

- Version:
- Date:
- Tester:
- Browser:
- Operating system:
- Packaged extension folder:
- Release zip:
- Supabase project:
- Test account email alias or label:
- Google OAuth tested: Yes / No / Not configured

## Build And Package

| Item | Result | Notes |
| --- | --- | --- |
| `npm.cmd run check` passed | Pending | |
| `npm.cmd run package` passed | Pending | |
| `npm.cmd run check:package` passed | Pending | |
| Release zip path matches manifest version | Pending | |
| Zip contains only extension files | Pending | |
| `npm.cmd run prepare:manual-test` passed | Pending | |
| Chrome loaded the packaged folder, not source folder | Pending | |

## Account Flow

| Item | Result | Notes |
| --- | --- | --- |
| Signed-out `Rate` opens sign-in modal | Pending | |
| Signed-out comment action opens sign-in modal | Pending | |
| Signed-out like/reply/report actions open sign-in modal | Pending | |
| Email/password account creation works | Pending | |
| Email confirmation flow is understandable | Pending | |
| Email/password sign-in works | Pending | |
| Sign-out from popup works | Pending | |
| Password reset email can be requested | Pending | |
| Google sign-in works if configured | Pending | |
| Popup shows signed-in account state | Pending | |
| Profile page shows only signed-in user's activity | Pending | |

## Paper Page Flow

| Item | Result | Notes |
| --- | --- | --- |
| arXiv abstract page detected | Pending | |
| Wiley or Springer DOI page detected | Pending | |
| ACS or ScienceDirect article page detected | Pending | |
| Sidebar opens and closes correctly | Pending | |
| Paper title and identifier are correct | Pending | |
| Rating can be submitted | Pending | |
| Community average rating updates | Pending | |
| Comment can be posted | Pending | |
| Second same-day comment is blocked | Pending | |
| Comment sorting works by newest and popularity | Pending | |
| Like works on another user's comment | Pending | |
| Reply works | Pending | |
| Report comment and report reply work | Pending | |
| Share image generation works | Pending | |

## PDF Detection

| Item | Result | Notes |
| --- | --- | --- |
| arXiv PDF URL detected | Pending | |
| Wiley PDF or PDFDirect URL detected | Pending | |
| Springer content PDF URL detected | Pending | |
| ACS PDF URL detected | Pending | |
| ScienceDirect PDF or PII PDF URL detected | Pending | |
| Journal-hosted PDF without DOI has fallback key | Pending | |
| Popup current-paper action opens fallback discussion page | Pending | |
| DOI/arXiv/PII is preferred over `pdf:` fallback when available | Pending | |

## Public Web Pages

| Item | Result | Notes |
| --- | --- | --- |
| GitHub Pages homepage opens | Pending | |
| Trending page opens and renders public data or empty state | Pending | |
| Trending search and sorting work | Pending | |
| Paper discussion page opens from shared URL | Pending | |
| Paper discussion page copy/share works | Pending | |
| Profile page shows signed-out auth panel | Pending | |
| Profile page loads signed-in private activity | Pending | |
| Admin page denies non-admin account | Pending | |
| Admin page allows active admin account | Pending | |

## Store Screenshots

| Screenshot | Result | File |
| --- | --- | --- |
| Sidebar closed | Pending | |
| Sidebar open with paper identifier | Pending | |
| Sign-in dialog | Pending | |
| Rating panel | Pending | |
| Comment with rating badge | Pending | |
| Comment replies and actions | Pending | |
| Report form | Pending | |
| Popup actions | Pending | |
| Trending page | Pending | |
| Paper discussion page | Pending | |
| Profile page | Pending | |

## Privacy And Review Safety

| Item | Result | Notes |
| --- | --- | --- |
| No screenshots show private emails or passwords | Pending | |
| No screenshots show Supabase secrets or dashboards | Pending | |
| No screenshots focus on paywalled article text, figures, or tables | Pending | |
| Store links match GitHub Pages URLs | Pending | |
| Permission explanations match `docs/chrome-web-store-submission.md` | Pending | |
| Privacy policy URL is reachable | Pending | |

## Issues Found

| Severity | Area | Description | Follow-up |
| --- | --- | --- | --- |
|  |  |  |  |

## Submission Decision

- Ready to upload: Yes / No
- If No, blocking issues:
- Submitted version:
- Submission date:
- Chrome Web Store status:
