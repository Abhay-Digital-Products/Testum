import { createFileRoute, Link, useRouter, useSearch } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth-dialog";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AuthSearch = {
  redirect?: string;
  tab?: "signin" | "signup";
};

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    tab: search.tab === "signup" || search.tab === "signin" ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in / Sign up  -  Testum" },
      {
        name: "description",
        content: "Sign in or sign up to Testum to access NEET 2027 CBT tests and AI analysis.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const search = useSearch({ from: "/auth" });
  const [checking, setChecking] = useState(true);

  const destination =
    search?.redirect && search.redirect.startsWith("/") && !search.redirect.startsWith("/auth")
      ? search.redirect
      : "/app";

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }: any) => {
        if (!mounted) return;
        if (data?.session?.user) {
          router.navigate({ to: destination as any, replace: true });
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        if (mounted) setChecking(false);
      });

    return () => {
      mounted = false;
    };
  }, [router, destination]);

  if (checking) {
    return (
      <div className="grid min-h-[100dvh] place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="relative grid min-h-[100dvh] place-items-center overflow-x-hidden bg-background px-4 py-8 sm:py-12">
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
      <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md rounded-3xl border bg-card p-6 sm:p-8 shadow-elegant">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>

        <div className="text-center mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Ready to crack NEET 2027?
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in or create your account to continue.
          </p>
        </div>

        <AuthForm defaultTab={search?.tab || "signin"} redirectTo={destination} />

        <div className="mt-6 flex flex-col gap-2 pt-4 border-t text-center">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">Back to homepage</Link>
          </Button>
          <Link
            to="/admin-login"
            className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            Admin login
          </Link>
        </div>
      </div>
    </div>
  );
}
