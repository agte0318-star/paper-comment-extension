-- Additional editable profile fields for signed-in users.
-- Run after 003_replies_and_user_activity.sql.

alter table public.profiles
add column if not exists research_field text;

comment on column public.profiles.research_field is 'Optional user-supplied research area shown on the signed-in profile page.';
