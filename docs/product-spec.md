# v0.1 Product Spec

## Goal

Build a local Chrome/Edge extension prototype that shows a paper comment sidebar on arXiv pages and DOI-based SCI publisher, journal, preprint, DOI resolver, and indexing pages.

## Target User Flow

1. User installs the extension locally through `Load unpacked`.
2. User opens an arXiv paper page or a supported SCI paper page.
3. Extension detects the arXiv ID, DOI, PubMed ID, or PMC ID and creates a `paperKey`.
4. User opens the comment sidebar.
5. User can rate the article as a whole.
6. User can post one overall comment about the paper.
7. User can sort comments by newest or popularity.
8. User can like comments written by other users.
9. User can generate a shareable PNG image from a comment.
10. The comment, likes, and article rating remain visible after refreshing the same paper page.

## Supported Sites

The extension intentionally uses an allowlist of scholarly domains rather than all websites. It supports common SCI publishers, preprint servers, DOI resolvers, and indexing platforms. Detection is metadata-driven: the sidebar appears only when the page exposes a paper identifier such as DOI, arXiv ID, PubMed ID, or PMC ID.

- `https://arxiv.org/abs/*`
- `https://arxiv.org/pdf/*`
- PubMed and PMC
- bioRxiv and medRxiv
- Springer and Springer Nature
- Wiley Online Library
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

## Sidebar Areas

- Header: paper title, paper key, and close button.
- Collapsible article rating panel: community average score plus the user's own overall paper rating form.
- Comment toolbar: sort by newest or popularity.
- Comment list: local overall comments for the current paper.
- Comment form: text area and post button.

## Article Rating Rules

The rating system is for the article as a whole, not for individual comments.

In local v0.1, the same browser user can submit one overall 1-10 rating per paper and can update that rating once per day. The rating panel displays the average score from all locally stored ratings for the paper. If the user has rated the paper, their comments show that overall article score.

## Local Moderation Rules

- Comments have no fixed character limit in v0.1.
- Empty comments are blocked.
- A starter blocklist catches common abuse, spam, and academic fraud patterns.
- The blocklist is stored in `src/moderation/blocklist.js` and should be reviewed before public release.
- In local v0.1, the same browser user can post one comment per paper per day.

## Comment Interaction Rules

- Comments can be sorted by newest first or by popularity.
- Popularity uses the number of likes on each comment.
- A local user can like comments written by other users.
- A local user cannot like their own comments.
- Sharing a comment generates a PNG image locally in the browser.

## Out of Scope

- Supabase.
- Login.
- Public shared comments.
- Reports and moderation.
- PDF upload.
- Full-text capture.
- Text selection annotations.
- Payments.
- Comment categories.

## Acceptance Criteria

- The extension can be loaded unpacked in Chrome/Edge.
- The sidebar appears on supported paper pages.
- The detected paper key looks like `arxiv:1706.03762`, `doi:10.xxxx/xxxxx`, `pubmed:123456`, or `pmc:PMC123456`.
- Comments are saved per paper key.
- Article ratings are saved separately from comments.
- A local user has one rating per paper and can update it once per day.
- The rating panel displays the average rating and rating count.
- If a local user has rated the paper, their comments show the overall article score.
- Users can sort comments by newest or popularity.
- Users can like comments written by other users.
- Users can generate a PNG image from a comment for sharing.
- Blocked words or spam patterns cannot be posted.
- A local user cannot post more than once per paper per day.
