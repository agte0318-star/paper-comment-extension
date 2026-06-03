# Web Prototype

The `web/` directory contains static prototypes for the public paper summary page and the future moderation dashboard.

## Pages

- `web/trending.html`: public overview of most discussed papers, top rated papers, and hot comments.
- `web/admin.html`: moderation dashboard for comments and reports.

## Current Data Source

The pages use `web/mock-data.js`. No real user data is loaded yet.

## Future Supabase Integration

Replace `web/mock-data.js` with queries against:

- `papers`
- `comments`
- `ratings`
- `comment_likes`
- `reports`
- `profiles`

The current UI already reflects the expected information architecture:

- public paper rankings
- top comments
- comment moderation
- report queue
- admin metrics

## Extension Package

The Chrome extension package script does not include `web/`, so these pages do not affect the uploaded extension zip.
