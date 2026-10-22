-- Grants the admin role to an EXISTING Supabase Auth user.
--
-- 1. Create the user first: Dashboard → Authentication → Users → Add user →
--    "Create new user" (enter email + strong password, tick "Auto Confirm User").
-- 2. Replace the email below and run this in Dashboard → SQL Editor.
--
-- The SQL Editor runs as a privileged role, so this works even though the
-- public API has no way to write to admin_profiles.

insert into public.admin_profiles (user_id)
select id from auth.users where email = lower('owner@example.com')
on conflict (user_id) do nothing;

-- Verify:
select u.email, a.role, a.created_at
from public.admin_profiles a join auth.users u on u.id = a.user_id;

-- To revoke later:
-- delete from public.admin_profiles where user_id = (select id from auth.users where email = 'owner@example.com');
