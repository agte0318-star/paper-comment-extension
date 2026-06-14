# Supabase Setup

This guide prepares the cloud backend for shared comments, replies, ratings, likes, reports, the public trending page, profile page, and the admin dashboard.

## 1. Create a Supabase Project

1. Go to Supabase.
2. Create a new project.
3. Save the project URL and publishable public key from `Project Settings -> API`.

## 2. Run SQL Migrations

Open `SQL Editor` and run these files in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_summary_views.sql`
3. `supabase/migrations/003_replies_and_user_activity.sql`
4. `supabase/migrations/004_profile_fields.sql`
5. `supabase/migrations/005_account_status_enforcement.sql`
6. `supabase/migrations/006_report_deduplication.sql`
7. `supabase/migrations/007_reply_reports.sql`
8. `supabase/migrations/008_profile_status_admin_controls.sql`
9. `supabase/migrations/009_moderation_audit_log.sql`
10. `supabase/migrations/010_spam_and_rate_limits.sql`
11. `supabase/migrations/011_summary_reply_counts.sql`

## 3. Enable Authentication

Recommended first provider:

- Google
- Email/password
- Password recovery email templates should be enabled for email/password users.

For Google OAuth:

1. In Google Cloud Console, create an OAuth client for a Chrome extension and/or web application as needed.
2. In Supabase, enable `Authentication -> Providers -> Google`.
3. Add the Google Client ID and Client Secret.
4. Add the Supabase callback URL shown in the Google provider settings to Google Cloud.
5. Add the extension redirect URL to Supabase redirect URLs:

```text
https://YOUR_EXTENSION_ID.chromiumapp.org/supabase
```

For local unpacked testing, the extension ID can change if the extension is reloaded from a different folder or key. Use the ID shown on `chrome://extensions`.

Also add the web profile URL to Supabase redirect URLs:

```text
https://agte0318-star.github.io/paper-comment-extension/web/profile.html
```

## 4. Configure the Client

Copy:

```text
src/config/supabase.example.js
```

to:

```text
src/config/supabase.js
```

Then fill:

```js
window.PCE_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_ID.supabase.co",
  anonKey: "YOUR_SUPABASE_PUBLISHABLE_KEY"
};
```

The publishable key is safe to ship in the extension package. Do not commit or ship a Supabase `service_role` key.

## 5. First Admin User

After you sign in once, Supabase will create a row in `profiles`.

Run this SQL to make yourself admin. The web admin page only opens for users whose profile has `role = 'admin'` and `status = 'active'`:

```sql
update public.profiles
set role = 'admin',
    status = 'active'
where id = 'YOUR_AUTH_USER_ID';
```

You can find your user ID in `Authentication -> Users`.

## 6. Data Model

Core tables:

- `profiles`
- `papers`
- `comments`
- `ratings`
- `comment_likes`
- `comment_replies`
- `reports`

Summary views:

- `paper_summary`
- `hot_comments`
- `user_comment_activity`
- `user_received_replies`

## 7. Current Status

After all migrations run, the SQL backend can support email/password sign-in, Google sign-in, editable profile fields, shared comments, shared replies, shared ratings, comment likes, one report per user per comment or reply, the public trending page, and the signed-in profile page. `paper_summary` includes comment counts, reply counts, ratings, likes, and last activity for public discovery pages. Account status is enforced by database policies: suspended or deleted users can read public discussions but cannot create or update comments, replies, ratings, likes, or reports. Users cannot self-restore role or account status through profile edits. The admin page can read the live reports queue, update report status, hide, restore, or soft-delete comments and reported replies, suspend, reactivate, or mark users deleted through Supabase admin RPC functions, and inspect user-level detail panels. Each admin action is written to `moderation_actions` for audit review. Backend spam guards limit rapid comments, replies, reports, duplicate text, and link-heavy submissions.
