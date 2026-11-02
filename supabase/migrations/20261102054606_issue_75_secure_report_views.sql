-- Ensure public report views evaluate table access using the caller's privileges.
-- This prevents the views from bypassing row-level security owned by their creator.
ALTER VIEW public.report_product_master_list SET (security_invoker = true);
ALTER VIEW public.report_active_employees SET (security_invoker = true);
ALTER VIEW public.report_all_employees SET (security_invoker = true);
ALTER VIEW public.report_employee_job_history_view SET (security_invoker = true);
ALTER VIEW public.report_top_sales_view SET (security_invoker = true);
