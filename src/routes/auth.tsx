import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthDialog } from "@/components/auth-dialog";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in  -  Testum" }, { name: "description", content: "Sign in to Testum to access NEET 2027 CBT tests." }] }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }: any) => {
      if (error) {
        setChecking(false);
        return;
      }
      if (data.user) router.navigate({ to: "/app" });
      else setChecking(false);
    }).catch(() => setChecking(false));
  }, [router]);
  if (checking) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4">
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-elegant">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 font-display text-2xl font-bold">Ready to crack NEET 2027?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to open your dashboard.</p>
        <div className="mt-6 flex flex-col gap-2">
          <AuthDialog defaultOpen={false} trigger={<Button size="lg" className="w-full">Sign in / Sign up</Button>} />
          <Button asChild variant="ghost" size="sm"><Link to="/">Back to homepage</Link></Button>
          <Link to="/admin-login" className="text-xs font-medium text-muted-foreground hover:text-primary">Admin login</Link>
        </div>
      </div>
    </div>
  );
}
