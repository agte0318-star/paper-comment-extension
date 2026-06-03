# Chrome Web Store Listing Draft

## Name

Paper Comment Extension

## Short Description

Rate and comment on academic papers while reading them.

## Detailed Description

Paper Comment Extension adds a lightweight sidebar to supported academic paper pages. It lets readers save an overall comment and a structured article-level rating while reading papers on arXiv and major publisher websites.

This v0.1 release is designed for early testing. Comments and ratings are stored locally in your browser and are not shared with other users yet.

Key features:

- Detects arXiv IDs and DOI-based paper pages.
- Adds a clean right-side paper comment panel.
- Saves one overall paper comment per local user per day.
- Saves one overall article rating per local user and paper.
- Shows the average article rating in the rating panel.
- Shows your overall article score on your comments.
- Lets users like comments written by other users.
- Sorts comments by newest or popularity.
- Generates a shareable PNG image from a comment.
- Uses local browser storage only.
- Does not upload PDFs, article text, figures, tables, or screenshots.

Current limitations:

- Comments are local only in v0.1.
- There is no login yet.
- Shared public comments will require a future cloud backend.
- Moderation is limited to a starter local blocklist.

## Suggested Category

Productivity

## Suggested Visibility

Unlisted for the first beta.

## Permission Explanation

### storage

Used to save local comments, article ratings, and a local anonymous browser identifier.

### Supported academic websites

Used to detect paper identifiers such as DOI or arXiv ID and inject the paper comment sidebar.

## Privacy Summary

The extension stores comments and ratings locally in the browser. It does not upload user comments, ratings, PDF files, full article text, browsing history, or personal identity information in v0.1.

## Screenshot Checklist

- Sidebar closed on a paper page.
- Sidebar open with article title and DOI/arXiv ID.
- Article rating panel expanded.
- Comment card showing `Rated x/10`.
- Empty comment state.
