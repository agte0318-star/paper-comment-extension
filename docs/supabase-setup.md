# Supabase Setup

This guide prepares the cloud backend for shared comments, ratings, likes, reports, the public trending page, and the admin dashboard.

## 1. Create a Supabase Project

1. Go to Supabase.
2. Create a new project.
3. Save the project URL and publishable public key from `Project Settings -> API`.

## 2. Run SQL Migrations

Open `SQL Editor` and run these files in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_summary_views.sql`

## 3. Enable Authentication

Recommended first provider:

- Email/password

Google OAuth can be added later after the first beta is stable.

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

Run this SQL to make yourself admin:

```sql
update public.profiles
set role = 'admin'
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
- `reports`

Summary views:

- `paper_summary`
- `hot_comments`

## 7. Current Status

The SQL backend is ready and the extension can use Supabase for email/password sign-in, shared comments, shared ratings, and comment likes. The next development step is to connect the public trending page and admin dashboard to the Supabase views and moderation tables.
