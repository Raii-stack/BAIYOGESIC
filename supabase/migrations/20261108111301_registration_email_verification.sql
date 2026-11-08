CREATE TABLE public.registration_email_verification (
  email text PRIMARY KEY CHECK (email = lower(btrim(email))),
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  send_count integer NOT NULL DEFAULT 1 CHECK (send_count BETWEEN 1 AND 3),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  used boolean NOT NULL DEFAULT false
);

ALTER TABLE public.registration_email_verification ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.registration_email_verification FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.registration_email_verification TO service_role;
