CREATE INDEX IF NOT EXISTS audit_log_recent_idx
  ON public.audit_log (action_at DESC, audit_id DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_recent_idx
  ON public.audit_log (action, action_at DESC, audit_id DESC);

CREATE TABLE IF NOT EXISTS public.app_user_presence (
  session_id text PRIMARY KEY CHECK (session_id ~ '^[0-9a-f]{64}$'),
  user_id uuid NOT NULL REFERENCES public.app_user (user_id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS app_user_presence_user_idx ON public.app_user_presence (user_id);
CREATE INDEX IF NOT EXISTS app_user_presence_expiry_idx ON public.app_user_presence (expires_at);
CREATE INDEX IF NOT EXISTS app_user_presence_recent_idx
  ON public.app_user_presence (last_seen_at DESC) WHERE closed_at IS NULL;
ALTER TABLE public.app_user_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_user_presence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_presence TO service_role;

INSERT INTO public.app_right (right_code, module, description, sort_order, is_module_access)
VALUES ('activity.access', 'activity', 'View employees currently using the workspace', 600, true)
ON CONFLICT (right_code) DO NOTHING;

-- Existing manager presets are identified by their management capabilities, without granting ordinary staff access.
INSERT INTO public.app_user_right (user_id, right_code, granted_by)
SELECT u.user_id, 'activity.access', 'system'
FROM public.app_user u
WHERE u.role IN ('employee', 'user')
  AND EXISTS (
    SELECT 1 FROM (VALUES
      (ARRAY['customers.delete', 'sales.delete']),
      (ARRAY['products.delete', 'products.price.delete']),
      (ARRAY['hr.employee.delete', 'hr.department.delete', 'hr.job.delete']),
      (ARRAY['sales.edit', 'products.price.edit', 'reports.all-employees'])
    ) AS manager(required_rights)
    WHERE manager.required_rights <@ ARRAY(
      SELECT right_code FROM public.app_user_right ur WHERE ur.user_id = u.user_id
    )
  )
ON CONFLICT DO NOTHING;
