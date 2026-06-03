# Web Pages

The `web/` directory contains the public paper activity page and a read-only moderation preview.

## Pages

- `web/trending.html`: public overview of most discussed papers, top rated papers, and hot comments.
- `web/admin.html`: read-only moderation preview for visible comments and future admin workflows.

## Current Data Source

The pages try to load live Supabase data first:

- `paper_summary`
- `hot_comments`
- visible rows from `comments`
- public rows from `profiles`

If Supabase cannot be reached, the pages fall back to `web/mock-data.js` so the layout remains inspectable during development.

## Admin Boundary

The public GitHub Pages admin preview requires Supabase email/password sign-in and checks that the signed-in profile has `role = 'admin'` and `status = 'active'`.

The current admin page still does not perform persistent moderation actions. Hiding, deleting, resolving reports, and reading restricted report queues should require future authenticated admin operations enforced by Supabase RLS or Edge Functions.

## Extension Package

The Chrome extension package script does not include `web/`, so these pages do not affect the uploaded extension zip.
