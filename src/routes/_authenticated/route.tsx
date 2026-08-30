import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      // 1. Check existing cached session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (!sessionError && sessionData?.session?.user) {
        // If session is expiring within 1 minute, refresh it in the background
        const isExpiring = sessionData.session.expires_at
          ? sessionData.session.expires_at * 1000 < Date.now() + 60000
          : false;

        if (isExpiring) {
          try {
            const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
            if (!refreshErr && refreshed?.session?.user) {
              return { user: refreshed.session.user };
            }
          } catch {
            // Keep using active session if network refresh fails
          }
        }
        return { user: sessionData.session.user };
      }

      // 2. Fallback check with getUser if session isn't in memory
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!userError && userData?.user) {
        return { user: userData.user };
      }
    } catch (e) {
      console.warn("[auth-guard] Session verification note:", e);
    }

    // Only redirect if genuinely unauthenticated
    const returnPath = location.pathname + location.search;
    throw redirect({
      to: "/auth",
      search: { redirect: returnPath.startsWith("/auth") ? undefined : returnPath },
    });
  },
  component: () => <Outlet />,
});
