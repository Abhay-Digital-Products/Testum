REVOKE EXECUTE ON FUNCTION public.has_access(uuid, public.plan_code) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_access(uuid, public.plan_code) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;