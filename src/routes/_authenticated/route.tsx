import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      // 1. Check existing cached session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (!sessionError && sessionData.session?.user) {
        // If session is expired or expiring soon (within 2 minutes), proactively refresh it
        const isExpiring = sessionData.session.expires_at
          ? sessionData.session.expires_at * 1000 < Date.now() + 120000
          : false;

        if (isExpiring) {
          const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
          if (!refreshErr && refreshed.session?.user) {
            return { user: refreshed.session.user };
          }
        }
        return { user: sessionData.session.user };
      }

      // 2. Try explicit session refresh (e.g. from refresh_token in storage)
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && refreshed.session?.user) {
        return { user: refreshed.session.user };
      }

      // 3. Fallback check with getUser
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!userError && userData?.user) {
        return { user: userData.user };
      }
    } catch (e) {
      console.warn("[auth-guard] Session verification note:", e);
    }

    // Only redirect if genuinely unauthenticated
    throw redirect({
      to: "/auth",
      search: { redirect: location.href },
    });
  },
  component: () => <Outlet />,
});

