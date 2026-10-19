ALTER TABLE public.app_user
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;

UPDATE public.app_user
SET must_change_password = true
WHERE password_hash = '$2b$12$Sh.fL6u/TPNAjGI/fSW8hOvULS15zndPibEKyqu1MEXHTrsxqF31m';
