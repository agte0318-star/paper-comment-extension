# v0.2 Product Spec

## Goal

Build a Chrome/Edge extension beta that shows a shared paper comment sidebar on arXiv pages and DOI-based SCI publisher, journal, preprint, DOI resolver, and indexing pages.

## Target User Flow

1. User installs the extension locally through `Load unpacked` or from the Chrome Web Store.
2. User opens an arXiv paper page or a supported SCI paper page.
3. Extension detects the arXiv ID, DOI, PubMed ID, or PMC ID and creates a `paperKey`.
4. User opens the comment sidebar.
5. User can rate the article as a whole.
6. User can post one overall comment about the paper.
7. User can sort comments by newest or popularity.
8. User can like comments written by other users.
9. User can generate a shareable PNG image from a comment.
10. In cloud mode, the comment, likes, and article rating are shared with other signed-in users reading the same paper.

## Supported Sites

The extension intentionally uses an allowlist of scholarly domains rather than all websites. It supports common SCI publishers, preprint servers, DOI resolvers, and indexing platforms. Detection is metadata-driven: the sidebar appears only when the page exposes a paper identifier such as DOI, arXiv ID, PubMed ID, or PMC ID.

- `https://arxiv.org/abs/*`
- `https://arxiv.org/pdf/*`
- PubMed and PMC
- bioRxiv and medRxiv
- Springer and Springer Nature
- Wiley Online Library, including journal subdomains such as Advanced Materials
- Science / AAAS
- ACS Publications
- Elsevier / ScienceDirect
- Cell Press
- Taylor & Francis
- Oxford Academic
- Cambridge Core
- Royal Society of Chemistry
- IOPscience
- AIP Publishing
- American Physical Society
- IEEE Xplore
- ACM Digital Library
- PNAS
- MDPI
- Frontiers
- PLOS
- eLife
- Royal Society Publishing
- SAGE Journals
- Annual Reviews
- PeerJ
- Hindawi
- Portland Press
- ASM Journals
- American Physiological Society journals
- American Meteorological Society journals
- University of Chicago Press journals
- De Gruyter
- DOI.org and Crossref
- Research Square, Preprints.org, SSRN, OSF, ChemRxiv, TechRxiv, EngrXiv
- BMJ, JAMA Network, NEJM, The Lancet, Karger, Thieme, Liebert, LWW, Wolters Kluwer
- J-STAGE, SciELO, JCI, Journal of Neuroscience, diabetes journals, endocrine journals, AACR, ASCO
- Copernicus, AGU, GeoScienceWorld, SPIE, Optica, World Scientific, Emerald, IOS Press, Brill
- SciOpen, Science China, Science Engine, CPS journals, and other China-based natural science journal platforms including Nano Research entry points

## Sidebar Areas

- Header: paper title, paper key, and close button.
- Collapsible article rating panel: community average score plus the user's own overall paper rating form.
- Comment toolbar: sort by newest or popularity.
- Auth panel: Supabase email/password sign-in for cloud comments.
- Comment list: shared overall comments for the current paper.
- Comment form: text area and post button.

## Article Rating Rules

The rating system is for the article as a whole, not for individual comments.

In cloud v0.2, the same signed-in user can submit one overall 1-10 rating per paper and can update that rating once per day. The rating panel displays the community average score from all Supabase ratings for the paper. If a comment author has rated the paper, their comments show that overall article score.

## Local Moderation Rules

- Comments have no fixed character limit in v0.2.
- Empty comments are blocked.
- A starter blocklist catches common abuse, spam, and academic fraud patterns.
- The blocklist is stored in `src/moderation/blocklist.js` and should be reviewed before public release.
- In cloud v0.2, the same signed-in user can post one comment per paper per day.

## Comment Interaction Rules

- Comments can be sorted by newest first or by popularity.
- Popularity uses the number of likes on each comment.
- A signed-in user can like comments written by other users.
- A signed-in user cannot like their own comments.
- Sharing a comment generates a PNG image locally in the browser.

## Out of Scope

- PDF upload.
- Full-text capture.
- Text selection annotations.
- Payments.
- Comment categories.
- OAuth sign-in.
- Full admin moderation workflow.

## Acceptance Criteria

- The extension can be loaded unpacked in Chrome/Edge.
- The sidebar appears on supported paper pages.
- The detected paper key looks like `arxiv:1706.03762`, `doi:10.xxxx/xxxxx`, `pubmed:123456`, or `pmc:PMC123456`.
- Supabase is used for shared cloud comments, ratings, and likes when configured.
- Local storage is available as a development fallback when Supabase is not configured.
- Comments are saved per paper key.
- Article ratings are saved separately from comments.
- A signed-in user has one rating per paper and can update it once per day.
- The rating panel displays the average rating and rating count.
- If a comment author has rated the paper, their comments show the overall article score.
- Users can sort comments by newest or popularity.
- Users can like comments written by other users.
- Users can generate a PNG image from a comment for sharing.
- Blocked words or spam patterns cannot be posted.
- A signed-in user cannot post more than once per paper per day.
