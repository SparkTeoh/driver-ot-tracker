-- Replace old driver with new driver account and clear old data
-- Run in Supabase SQL Editor as project owner/admin.

BEGIN;

-- 1) Update these emails before running:
--    old_email = previous driver login email
--    new_email = new driver login email
DO $$
DECLARE
  old_email text := 'old-driver@example.com';
  new_email text := 'mrsanisaim00@gmail.com';
  new_password text := '12345678';
  old_user_id uuid;
  new_user_id uuid;
BEGIN
  SELECT id INTO old_user_id FROM auth.users WHERE email = old_email LIMIT 1;
  SELECT id INTO new_user_id FROM auth.users WHERE email = new_email LIMIT 1;

  -- If new user already exists, clear this user's old work logs.
  IF new_user_id IS NOT NULL THEN
    DELETE FROM public.work_logs WHERE user_id = new_user_id;
  END IF;

  -- If old user exists, remove old work logs.
  IF old_user_id IS NOT NULL THEN
    DELETE FROM public.work_logs WHERE user_id = old_user_id;
  END IF;

  -- If old user exists, repoint account to new email + password.
  -- If old user does not exist and new user exists, update new user password only.
  IF old_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET
      email = new_email,
      encrypted_password = crypt(new_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = old_user_id;

    -- Keep auth identity row in sync for email login.
    UPDATE auth.identities
    SET
      identity_data = jsonb_set(
        COALESCE(identity_data, '{}'::jsonb),
        '{email}',
        to_jsonb(new_email),
        true
      ),
      provider_id = new_email,
      updated_at = now()
    WHERE user_id = old_user_id
      AND provider = 'email';
  ELSIF new_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET
      encrypted_password = crypt(new_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = new_user_id;
  ELSE
    RAISE EXCEPTION 'No user found for old_email or new_email. Create user first in Supabase Auth.';
  END IF;
END $$;

COMMIT;
