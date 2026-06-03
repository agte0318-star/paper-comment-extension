# Release Checklist

## Before Upload

- Run `npm.cmd run icons`.
- Run `npm.cmd run check`.
- Run `npm.cmd run package`.
- Test the unpacked extension on at least one arXiv page.
- Test the unpacked extension on at least one DOI publisher page.
- Review `docs/privacy-policy.md`.
- Review `docs/store-listing.md`.

## Chrome Web Store

- Register a Chrome Web Store developer account.
- Upload the generated zip from `release/`.
- Add icon and screenshots.
- Add the privacy policy URL.
- Complete data privacy disclosures.
- Choose `Unlisted` for the first beta release.
- Submit for review.

## First Beta

- Share the unlisted link with a small tester group.
- Ask testers to report unsupported paper sites.
- Ask testers to report confusing UI copy.
- Watch for moderation and abuse edge cases.
