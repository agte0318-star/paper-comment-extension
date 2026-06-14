# Agent Guide

This file is the project-level guardrail for future Codex/agent work on Paper Comment Extension. Follow it before making product, database, extension, or release changes.

## Product Direction

- Build a serious academic discussion layer, not a general social network.
- Keep the extension simple: paper detection, rating, comments, likes, replies, sign-in, and clear navigation to web pages.
- Put heavier workflows on web pages: profile, trending, paper detail, admin review, and future moderation queues.
- Respect copyright. Never upload PDFs, full article text, paywalled content, figures, screenshots, or tables unless the user explicitly changes the product policy and a legal review exists.
- Prefer scholarly trust signals over engagement tricks: clear identity, transparent moderation, and low-friction discussion.

## Current Architecture

- Extension source lives under `src/`.
- Content sidebar lives in `src/content/index.js` and `src/content/sidebar.css`.
- Paper detection lives in `src/content/detectPaper.js`.
- Supabase REST/Auth client lives in `src/cloud/supabaseClient.js`.
- Local fallback store lives in `src/storage/localComments.js`.
- Popup files live in `src/popup/`.
- Web pages live under `web/`.
- Supabase migrations live under `supabase/migrations/`.

## Security Rules

- Never place a Supabase `service_role` key, database password, or private OAuth secret in the extension, web pages, GitHub Pages, or tracked client-side files.
- Only use the Supabase publishable/anon key in client code.
- Any admin mutation such as hide, delete, suspend, resolve report, or role change must be enforced by Supabase RLS, RPC, or Edge Functions. Do not rely on hidden buttons or front-end role checks.
- Public web pages may read public views only. Private user pages must require a signed-in session and use RLS-protected data.
- Do not add broad Chrome permissions unless there is a clear user-facing need. Prefer `storage` and explicit host permissions over `tabs`, `webRequest`, or all-URLs access.
- If a feature needs broader permissions, update `docs/store-listing.md`, privacy policy text, and Chrome Web Store permission justifications.

## Authentication Rules

- Mature target flow: Google sign-in first, email/password second.
- Email/password must support sign-up, sign-in, sign-out, email confirmation messaging, and password reset before public promotion.
- Do not expose user email publicly. Public names should come from `profiles.display_name`.
- User profile pages should show only the signed-in user's private activity unless a deliberate public profile feature is planned.
- Keep login prompts contextual: if a user clicks Rate, Comment, Like, or Reply while signed out, open sign-in and return them to that action after sign-in.

## Database Rules

- Add schema changes as new numbered files in `supabase/migrations/`; never edit already-run migrations unless the user explicitly says the database will be reset.
- Keep top-level comments in `comments`.
- Keep replies in `comment_replies`; do not overload top-level comments with nested reply behavior.
- Preserve one top-level comment per user per paper per day.
- Preserve one rating per user per paper, with at most one update per day.
- Add RLS policies together with every new table.
- Add public read views only for data that is safe to show publicly.

## Moderation Rules

- The first real moderation release must include report creation, an admin queue, and persistent admin actions enforced by the backend.
- User states should remain `active`, `suspended`, or `deleted`.
- Suspended users must be blocked from comments, replies, ratings, likes, and reports by backend policies.
- Client-side blocklists are only a first-pass user experience; they are not the real moderation boundary.

## PDF Detection Rules

- Direct PDF URLs can be detected when the content script can run on the page.
- Chrome's built-in PDF viewer may prevent normal sidebar injection. Do not promise perfect in-PDF sidebar behavior.
- Stable fallback for PDFs: detect the source PDF URL, DOI, or arXiv ID when possible, then offer an extension popup or web discussion entry.
- Use DOI or arXiv ID as the canonical key when available. Use a normalized PDF URL key only as a fallback.

## Release Rules

- Every user-visible change must increment `manifest.json` and `package.json`.
- Run `npm.cmd run check` before finalizing changes.
- Run `npm.cmd run package` before preparing Chrome Web Store upload.
- Verify the generated zip under `release/`.
- Update docs when permissions, privacy, authentication, data collection, or moderation behavior changes.
- Do not submit a Chrome Web Store version until it has been loaded locally with `chrome://extensions` and tested on at least arXiv, Wiley/Springer-like DOI pages, and one direct PDF URL.

## Agent Operating Rules

- Treat this repository as a production extension project. Prefer small, reviewable changes over broad rewrites.
- Work only inside the project unless the user explicitly asks for a wider machine-level change.
- The C drive has limited free space. Put non-essential generated files, temporary extraction folders, screenshots, release artifacts, and larger working assets under this project on `E:` by default, or on the external `H:` drive for very large assets when the user approves. Avoid using system temp locations on `C:` unless a tool absolutely requires it.
- Do not run destructive commands such as `git reset --hard`, broad deletes, or checkout-based reverts unless the user clearly asks for that exact operation.
- Do not overwrite user changes. If the worktree is dirty, inspect affected files and work with the existing changes.
- If a command fails because of filesystem, network, or sandbox restrictions and the command is necessary, request explicit escalation with a short reason.
- Never add private keys, Supabase service-role keys, database passwords, OAuth client secrets, or Chrome Web Store credentials to tracked files.
- For schema work, add a new migration and document the manual Supabase SQL step. Do not silently edit already-applied migrations.
- For frontend or extension UI changes, run syntax checks and package the extension before calling the change ready.
- For any new permission, data collection behavior, login flow, or moderation behavior, update the store listing notes and privacy policy before release.

## Development Priorities

1. Protect trust, privacy, and copyright.
2. Keep the reader experience simple and fast.
3. Make auth and user identity reliable.
4. Make moderation real before scaling user growth.
5. Avoid adding features that increase permissions or review risk without clear product value.
