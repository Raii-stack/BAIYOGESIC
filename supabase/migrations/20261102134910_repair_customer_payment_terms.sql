-- Older databases use pay_ck, so replacing only customer_payterm_check leaves Net 60 broken.
ALTER TABLE public.customer DROP CONSTRAINT IF EXISTS pay_ck;
ALTER TABLE public.customer DROP CONSTRAINT IF EXISTS customer_payterm_check;
ALTER TABLE public.customer
  ADD CONSTRAINT customer_payterm_check CHECK (payterm IN ('COD', '30D', '45D', '60D'));
