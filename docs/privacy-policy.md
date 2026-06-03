# Privacy Policy

Effective date: June 2, 2026

Paper Comment Extension is a local prototype browser extension for rating and commenting on academic papers while reading them.

## Data Stored by the Extension

The extension stores the following data locally in the user's browser through `chrome.storage.local`:

- Paper identifiers such as arXiv IDs or DOIs.
- User-created comments.
- User-created article ratings.
- A local anonymous browser identifier used only to enforce local comment and rating limits.

## Data Not Collected

The extension does not collect, transmit, sell, or share:

- Personal identity information.
- Browser history.
- Full article text.
- PDF files.
- Paywalled content.
- Figures, tables, screenshots, or article images.
- Comments or ratings to any remote server in v0.1.

## Website Access

The extension runs only on supported academic paper websites listed in the extension manifest. It reads page metadata such as DOI, arXiv ID, title, and canonical URL to identify the paper and show the correct local comment panel.

## Data Sharing

In v0.1, no data is sent to external services. Comments and ratings are local to the user's browser.

## Data Retention and Deletion

Data remains in the browser until the user removes the extension or clears extension storage. A future version may add explicit export and deletion controls.

## Security

The extension uses Chrome extension storage APIs and does not request access to cookies, tabs, browsing history, web requests, or account data.

## Contact

For privacy questions, contact the project maintainer at the support email provided in the Chrome Web Store listing.
