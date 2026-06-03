# Paper Comment Extension

Local v0.1 prototype for a browser extension that shows a paper-focused comment sidebar while reading academic articles.

## v0.1 Scope

- Detect arXiv papers.
- Detect DOI-based papers on major natural science publisher sites.
- Inject a right-side comment sidebar.
- Save comments locally with `chrome.storage.local`.
- Save one overall article rating per local user and paper.
- Show the average article rating and rating count in the rating panel.
- Show the user's overall article score on their comments.
- Let users like comments written by other users.
- Sort comments by newest or by popularity.
- Generate a shareable PNG image from a comment.
- Allow one local rating update per paper per day.
- Allow one local comment per paper per day.
- Block obvious abusive or spam-like comments with a starter blocklist.
- Do not upload PDFs, copy full text, or store article content.

## How to Load Locally

1. Open Chrome or Edge.
2. Go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `paper-comment-extension` project folder.
6. Open an arXiv paper page such as `https://arxiv.org/abs/1706.03762`, or a publisher DOI page such as Springer, Wiley, Science, ACS, Elsevier, RSC, PNAS, or PLOS.

## Next Milestones

- Add PubMed ID fallback when DOI is missing.
- Add more publisher-specific DOI fallbacks.
- Replace local storage with Supabase.
- Add login, reports, and moderation.
