-- Enable pg_cron extension (runs scheduled jobs inside the database)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage so the cron job can call the function
GRANT USAGE ON SCHEMA cron TO postgres;

-- -----------------------------------------------------------------------
-- Cleanup function: delete stale orders
-- Deletes orders whose status is 'created' or 'failed'
-- AND were created more than 24 hours ago.
-- (These are abandoned / bounced payment sessions — no money was taken.)
-- 'paid' and 'cancelled' orders are intentionally kept.
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_stale_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.orders
  WHERE status IN ('created', 'failed')
    AND created_at < now() - INTERVAL '24 hours';
END;
$$;

-- -----------------------------------------------------------------------
-- Schedule: run cleanup_stale_orders every hour
-- Cron syntax: minute hour day month weekday
-- '0 * * * *' = top of every hour
-- -----------------------------------------------------------------------
SELECT cron.schedule(
  'cleanup-stale-orders',   -- job name (unique)
  '0 * * * *',              -- every hour on the hour
  $$SELECT public.cleanup_stale_orders();$$
);
