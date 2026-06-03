# Supabase Setup

This guide prepares the cloud backend for shared comments, ratings, likes, reports, the public trending page, and the admin dashboard.

## 1. Create a Supabase Project

1. Go to Supabase.
2. Create a new project.
3. Save the project URL and anon public key from `Project Settings -> API`.

## 2. Run SQL Migrations

Open `SQL Editor` and run these files in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_summary_views.sql`

## 3. Enable Authentication

Recommended first providers:

- Email magic link
- Google OAuth

For Google OAuth, configure the redirect URLs that will be used by the extension and web dashboard.

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
  anonKey: "YOUR_SUPABASE_ANON_KEY"
};
```

Do not commit service role keys.

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

The SQL backend is ready, but the extension still uses local storage. The next development step is to replace local comment, rating, like, and report operations with Supabase queries.
