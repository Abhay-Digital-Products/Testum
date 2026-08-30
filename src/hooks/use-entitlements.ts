import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlanCode = "chapter" | "part" | "full" | "combo";

export function useEntitlements() {
  const [plans, setPlans] = useState<Set<PlanCode>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (alive) setLoading(false);
        return;
      }
      const [{ data: ents }, { data: roles }] = await Promise.all([
        supabase.from("entitlements").select("plan_code, expires_at").eq("user_id", u.user.id),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      if (!alive) return;
      const now = Date.now();
      setPlans(
        new Set(
          (ents ?? [])
            .filter((e: any) => !e.expires_at || new Date(e.expires_at).getTime() > now)
            .map((e: any) => e.plan_code as PlanCode),
        ),
      );
      setIsAdmin(!!roles?.some((r: any) => r.role === "admin"));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const hasAccess = (plan?: PlanCode | "free" | null, isFree?: boolean) =>
    isAdmin ||
    !plan ||
    plan === "free" ||
    isFree ||
    plans.has("combo") ||
    (!!plan && plans.has(plan as PlanCode));

  return { plans, isAdmin, loading, hasAccess };
}
