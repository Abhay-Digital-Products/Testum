import { createFileRoute, Outlet, useRouter, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ClipboardList, ArrowLeft, Users, IndianRupee, Tag, Megaphone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", l: "Overview", Icon: LayoutDashboard, exact: true },
  { to: "/admin/tests", l: "Tests", Icon: ClipboardList },
  { to: "/admin/students", l: "Students", Icon: Users },
  { to: "/admin/orders", l: "Orders", Icon: IndianRupee },
  { to: "/admin/plans", l: "Plans", Icon: Tag },
  { to: "/admin/offers", l: "Offer Popup", Icon: Megaphone },
];

function AdminLayout() {
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [ok, setOk] = useState<null | boolean>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { router.navigate({ to: "/auth" }); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
      if (!data) { toast.error("Admin access required"); router.navigate({ to: "/app" }); setOk(false); return; }
      setOk(true);
    })();
  }, [router]);

  if (ok === null) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Checking access…</div>;
  if (!ok) return null;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Logo />
          <span className="ml-2 rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">Admin</span>
          <nav className="ml-4 hidden gap-1 md:flex">
            {NAV.map((n) => {
              const active = n.exact ? path === n.to : path.startsWith(n.to);
              return (
                <Link key={n.to} to={n.to as never} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-secondary" : "text-muted-foreground hover:text-foreground"}`}>
                  <n.Icon className="h-4 w-4" />{n.l}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto">
            <Button asChild variant="ghost" size="sm"><Link to="/app"><ArrowLeft className="mr-1 h-4 w-4" />Back to app</Link></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t bg-background/95 backdrop-blur md:hidden">
        {NAV.map((n) => {
          const active = n.exact ? path === n.to : path.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to as never} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${active ? "text-primary font-bold" : "text-muted-foreground"}`}>
              <n.Icon className="h-4 w-4" />
              <span className="truncate max-w-[50px]">{n.l.replace("Offer Popup", "Offers")}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
