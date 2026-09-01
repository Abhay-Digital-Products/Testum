import { createFileRoute, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { Logo } from "@/components/logo";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Bell, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OfferPopup } from "@/components/offer-popup";
import { PWAInstallButton } from "@/components/pwa-install-button";

export const Route = createFileRoute("/_authenticated/app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hideChrome = path.startsWith("/app/attempt/");
  const router = useRouter();
  const qc = useQueryClient();
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null; email: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: p } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", userData.user.id).maybeSingle();
      setProfile({ full_name: p?.full_name ?? null, avatar_url: p?.avatar_url ?? null, email: userData.user.email ?? "" });
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id);
      setIsAdmin(!!roles?.some((r: any) => r.role === "admin"));
    })();
  }, []);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.navigate({ to: "/auth", replace: true });
  };

  if (hideChrome) return <Outlet />;

  const initial = (profile?.full_name || profile?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Logo />
          <nav className="ml-4 hidden gap-1 md:flex">
            {[
              { to: "/app", l: "Home" },
              { to: "/app/tests", l: "Tests" },
              { to: "/app/results", l: "Results" },
              { to: "/app/pricing", l: "Plans" },
              { to: "/app/profile", l: "Profile" },
            ].map((n) => {
              const active = n.to === "/app" ? path === n.to : path.startsWith(n.to);
              return (
                <Link key={n.to} to={n.to as never} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{n.l}</Link>
              );
            })}
            {isAdmin && <Link to="/admin" className={`rounded-lg px-3 py-1.5 text-sm font-medium ${path.startsWith("/admin") ? "bg-primary text-primary-foreground" : "text-primary hover:bg-primary/10"}`}>Admin</Link>}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <PWAInstallButton
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex h-8 text-xs font-semibold rounded-lg border-emerald-600/30 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100"
            >
              App
            </PWAInstallButton>
            <Button variant="ghost" size="icon" className="relative"><Bell className="h-4 w-4" /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="grid h-9 w-9 place-items-center rounded-full bg-hero text-sm font-bold text-primary-foreground ring-2 ring-primary/20">{initial}</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5 text-xs">
                  <div className="font-semibold truncate">{profile?.full_name || "Student"}</div>
                  <div className="text-muted-foreground truncate">{profile?.email}</div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/app/profile">Profile</Link></DropdownMenuItem>
                {isAdmin && <DropdownMenuItem asChild><Link to="/admin">Admin panel</Link></DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive"><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3.5 sm:px-4 py-4 sm:py-6 w-full min-w-0">
        <Outlet />
      </main>
      <BottomNav />
      <OfferPopup />
    </div>
  );
}
