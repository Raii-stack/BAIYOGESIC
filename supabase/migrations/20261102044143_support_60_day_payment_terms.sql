-- Keep the database constraint aligned with the CRM API and UI payment-term contract.
ALTER TABLE public.customer
  DROP CONSTRAINT IF EXISTS customer_payterm_check;

ALTER TABLE public.customer
  ADD CONSTRAINT customer_payterm_check
  CHECK (payterm IN ('COD', '30D', '45D', '60D'));
