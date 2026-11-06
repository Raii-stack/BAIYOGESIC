CREATE TABLE public.app_user_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.app_user(user_id) ON DELETE CASCADE,
  density text NOT NULL DEFAULT 'comfortable' CHECK (density IN ('comfortable', 'compact')),
  motion boolean NOT NULL DEFAULT true,
  employment boolean NOT NULL DEFAULT true,
  sales boolean NOT NULL DEFAULT true,
  payments boolean NOT NULL DEFAULT true,
  products boolean NOT NULL DEFAULT true,
  popups boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.app_notification (
  notification_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.app_user(user_id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('account', 'employment', 'sales', 'payments', 'products')),
  title text NOT NULL,
  message text NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('profile', 'settings', 'sale', 'product')),
  target_key text,
  event_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (user_id, event_key)
);
CREATE INDEX app_notification_inbox_idx ON public.app_notification(user_id, created_at DESC, notification_id DESC);
CREATE INDEX app_notification_unread_idx ON public.app_notification(user_id) WHERE read_at IS NULL;
ALTER TABLE public.app_user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notification ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_user_preferences, public.app_notification FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_preferences, public.app_notification TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.app_notification_notification_id_seq TO service_role;

-- Match the API's module access: restricted admins use their explicit rights.
CREATE FUNCTION public.workspace_module_access(p_user uuid, p_module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_user u WHERE u.user_id = p_user
      AND u.status = 'active' AND NOT u.is_blocked
      AND (
        (u.role IN ('admin', 'superadmin', 'administrator') AND NOT EXISTS (
          SELECT 1 FROM public.app_user_right r WHERE r.user_id = u.user_id
        ))
        OR EXISTS (
          SELECT 1 FROM public.app_user_right r WHERE r.user_id = u.user_id
          AND r.right_code = ANY(CASE p_module
            WHEN 'sales' THEN ARRAY['sales.access','sales.add','sales.edit','sales.delete','sales.details.view','sales.details.add','sales.details.edit','sales.details.delete']
            WHEN 'products' THEN ARRAY['products.access','products.add','products.edit','products.delete','products.price.add','products.price.edit','products.price.delete']
            ELSE ARRAY[]::text[] END)
        )
      )
  );
$$;

CREATE FUNCTION public.workspace_notice_visible(p_user uuid, p_category text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT CASE WHEN p_category IN ('account','employment') THEN true
    WHEN p_category IN ('sales','payments') THEN public.workspace_module_access(p_user, 'sales')
    WHEN p_category = 'products' THEN public.workspace_module_access(p_user, 'sales') OR public.workspace_module_access(p_user, 'products')
    ELSE false END;
$$;

CREATE FUNCTION public.trg_workspace_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  previous jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  current_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  category_name text;
  notice_title text;
  notice_message text;
  target_type text;
  reference text;
  personal_user uuid;
  assigned_employee text;
  actor text := lower(COALESCE(NULLIF(current_setting('app.username', true), ''), 'system'));
  event_suffix text;
  operation text;
BEGIN
  IF TG_OP = 'UPDATE' AND (previous - ARRAY['stamp','updated_at']) = (current_row - ARRAY['stamp','updated_at']) THEN RETURN NEW; END IF;
  operation := CASE WHEN TG_OP = 'INSERT' THEN 'added'
    WHEN TG_OP = 'DELETE' OR (current_row->>'is_deleted')::boolean THEN 'archived'
    WHEN (previous->>'is_deleted')::boolean THEN 'restored' ELSE 'updated' END;

  CASE TG_TABLE_NAME
    WHEN 'app_user' THEN
      IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
      personal_user := (current_row->>'user_id')::uuid;
      category_name := 'account'; target_type := 'settings';
      IF previous->'password_hash' IS DISTINCT FROM current_row->'password_hash' THEN
        notice_title := 'Password changed'; notice_message := 'Your account password was changed.'; event_suffix := 'security';
      ELSIF (previous->'role', previous->'status', previous->'is_blocked') IS DISTINCT FROM (current_row->'role', current_row->'status', current_row->'is_blocked') THEN
        notice_title := 'Account access updated'; notice_message := 'Your role or account access was updated. Review your account details.';
      ELSE RETURN NEW; END IF;
    WHEN 'audit_log' THEN
      IF NEW.table_name <> 'app_user_right' THEN RETURN NEW; END IF;
      IF (SELECT array_agg(v ORDER BY v) FROM jsonb_array_elements_text(COALESCE(NEW.old_values->'rights','[]')) v)
         IS NOT DISTINCT FROM (SELECT array_agg(v ORDER BY v) FROM jsonb_array_elements_text(COALESCE(NEW.new_values->'rights','[]')) v)
         AND NEW.old_values->'role' IS NOT DISTINCT FROM NEW.new_values->'role' THEN RETURN NEW; END IF;
      personal_user := NEW.record_key::uuid; category_name := 'account'; target_type := 'settings';
      notice_title := 'Account access updated'; notice_message := 'Your role or access permissions were updated. Review your account details.';
    WHEN 'employee', 'jobhistory' THEN
      IF TG_TABLE_NAME = 'employee' AND TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
      -- Job history already emits the effective-date notice when it updates these employee columns.
      IF TG_TABLE_NAME = 'employee' AND (previous - ARRAY['stamp','jobcode','deptcode']) = (current_row - ARRAY['stamp','jobcode','deptcode']) THEN RETURN NEW; END IF;
      SELECT user_id INTO personal_user FROM public.app_user WHERE empno = current_row->>'empno';
      IF personal_user IS NULL THEN RETURN NEW; END IF;
      category_name := 'employment'; target_type := 'profile';
      notice_title := 'Employment details updated'; notice_message := 'Your employment record was updated.';
      IF current_row ? 'effdate' THEN notice_message := notice_message || ' Effective date: ' || (current_row->>'effdate') || '.'; END IF;
    WHEN 'sales', 'payment' THEN
      IF TG_TABLE_NAME = 'sales' AND TG_OP = 'UPDATE' AND previous->'is_deleted' IS NOT DISTINCT FROM current_row->'is_deleted' THEN RETURN NEW; END IF;
      reference := current_row->>'transno';
      SELECT empno INTO assigned_employee FROM public.sales WHERE transno = reference;
      IF TG_TABLE_NAME = 'payment' AND EXISTS (SELECT 1 FROM public.sales WHERE transno = reference AND is_deleted) THEN RETURN NEW; END IF;
      category_name := CASE TG_TABLE_NAME WHEN 'sales' THEN 'sales' ELSE 'payments' END;
      target_type := 'sale'; notice_title := CASE TG_TABLE_NAME WHEN 'sales' THEN 'Sale ' ELSE 'Payment ' END || operation;
      notice_message := notice_title || ' for sale ' || reference || '.';
      IF TG_TABLE_NAME = 'payment' THEN event_suffix := current_row->>'orno'; END IF;
    WHEN 'product', 'pricehist' THEN
      IF TG_TABLE_NAME = 'product' AND (TG_OP <> 'UPDATE' OR previous->'is_deleted' IS NOT DISTINCT FROM current_row->'is_deleted') THEN RETURN NEW; END IF;
      reference := current_row->>'prodcode'; category_name := 'products'; target_type := 'product';
      IF TG_TABLE_NAME = 'pricehist' AND EXISTS (SELECT 1 FROM public.product WHERE prodcode = reference AND is_deleted) THEN RETURN NEW; END IF;
      -- Restoring a product also restores its prices; show one product notice for that operation.
      IF TG_TABLE_NAME = 'pricehist' AND TG_OP = 'UPDATE' AND (previous->>'is_deleted')::boolean AND NOT (current_row->>'is_deleted')::boolean THEN RETURN NEW; END IF;
      IF TG_TABLE_NAME = 'product' THEN
        DELETE FROM public.app_notification WHERE category = 'products' AND target_key = reference AND event_key LIKE txid_current()::text || ':products:' || reference || ':%';
      END IF;
      notice_title := CASE TG_TABLE_NAME WHEN 'product' THEN 'Product ' ELSE 'Product price ' END || operation;
      notice_message := notice_title || ' for product ' || reference || '.';
      IF TG_TABLE_NAME = 'pricehist' THEN
        event_suffix := current_row->>'effdate';
        notice_message := notice_message || ' Effective date: ' || (current_row->>'effdate') || '.';
      END IF;
    ELSE RETURN NEW;
  END CASE;

  INSERT INTO public.app_notification(user_id, category, title, message, target_kind, target_key, event_key)
  SELECT u.user_id, category_name, notice_title, notice_message, target_type, reference,
         txid_current()::text || ':' || category_name || ':' || COALESCE(personal_user::text, reference) || ':' || COALESCE(event_suffix, '')
  FROM public.app_user u LEFT JOIN public.app_user_preferences p ON p.user_id = u.user_id
  WHERE (
    (personal_user IS NOT NULL AND u.user_id = personal_user)
    OR (personal_user IS NULL AND u.status = 'active' AND NOT u.is_blocked
      AND actor NOT IN (lower(u.email), lower(u.user_id::text), lower(COALESCE(u.empno,'')))
      AND public.workspace_notice_visible(u.user_id, category_name)
      AND (category_name = 'products' OR u.empno = assigned_employee OR u.role IN ('admin','superadmin','administrator')
        OR EXISTS (SELECT 1 FROM public.app_user_right r WHERE r.user_id = u.user_id AND r.right_code = 'sales.delete')))
  ) AND CASE category_name WHEN 'employment' THEN COALESCE(p.employment,true)
    WHEN 'sales' THEN COALESCE(p.sales,true) WHEN 'payments' THEN COALESCE(p.payments,true)
    WHEN 'products' THEN COALESCE(p.products,true) ELSE true END
  ON CONFLICT (user_id, event_key) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_user_workspace_notice AFTER UPDATE ON public.app_user FOR EACH ROW EXECUTE FUNCTION public.trg_workspace_notification();
CREATE TRIGGER rights_workspace_notice AFTER INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.trg_workspace_notification();
CREATE TRIGGER employee_workspace_notice AFTER UPDATE ON public.employee FOR EACH ROW EXECUTE FUNCTION public.trg_workspace_notification();
CREATE TRIGGER jobhistory_workspace_notice AFTER INSERT OR UPDATE ON public.jobhistory FOR EACH ROW EXECUTE FUNCTION public.trg_workspace_notification();
CREATE TRIGGER sales_workspace_notice AFTER INSERT OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.trg_workspace_notification();
CREATE TRIGGER payment_workspace_notice AFTER INSERT OR UPDATE ON public.payment FOR EACH ROW EXECUTE FUNCTION public.trg_workspace_notification();
CREATE TRIGGER product_workspace_notice AFTER UPDATE ON public.product FOR EACH ROW EXECUTE FUNCTION public.trg_workspace_notification();
CREATE TRIGGER pricehist_workspace_notice AFTER INSERT OR UPDATE ON public.pricehist FOR EACH ROW EXECUTE FUNCTION public.trg_workspace_notification();
REVOKE ALL ON FUNCTION public.workspace_module_access(uuid,text), public.workspace_notice_visible(uuid,text), public.trg_workspace_notification() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_module_access(uuid,text), public.workspace_notice_visible(uuid,text), public.trg_workspace_notification() TO service_role;
