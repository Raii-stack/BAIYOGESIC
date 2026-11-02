-- Issue #74: persist payment methods and make the public balance view obey caller RLS.

ALTER TABLE public.payment
  ADD COLUMN IF NOT EXISTS payment_method varchar(20);

UPDATE public.payment
SET payment_method = 'Cash'
WHERE payment_method IS NULL OR btrim(payment_method) = '';

ALTER TABLE public.payment
  ALTER COLUMN payment_method SET DEFAULT 'Cash',
  ALTER COLUMN payment_method SET NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_payment_method_check'
      AND conrelid = 'public.payment'::regclass
  ) THEN
    ALTER TABLE public.payment
      ADD CONSTRAINT payment_payment_method_check
      CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Check', 'Card', 'E-wallet'));
  END IF;
END
$migration$;

ALTER VIEW public.sales_balance_view
  SET (security_invoker = true);

COMMENT ON COLUMN public.payment.payment_method IS
  'Customer payment channel recorded with the official receipt.';
