import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";
import { adminLogin } from "@/lib/admin-auth.functions";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Admin Login  -  Testum" },
      { name: "description", content: "Secure staff login for the Testum admin dashboard." },
      { property: "og:title", content: "Admin Login  -  Testum" },
      { property: "og:description", content: "Secure staff login for the Testum admin dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const router = useRouter();
  const login = useServerFn(adminLogin);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setServerError(null);
    try {
      const res = await login({ data: { id: id.trim(), password } });
      if (!res.ok) {
        setServerError(res.message);
        toast.error(res.message);
        return;
      }
      if (!res.email) {
        const message = "Admin login failed. Please try again.";
        setServerError(message);
        toast.error(message);
        return;
      }

      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore sign-out failures, we just want a clean auth state.
      }

      const { error } = await supabase.auth.signInWithPassword({ email: res.email.trim(), password });
      if (error) {
        setServerError(error.message);
        toast.error(error.message);
        return;
      }
      toast.success("Welcome back, admin");
      router.navigate({ to: "/admin" });
    } catch (error) {
      console.error("[admin-login] unexpected error:", error);
      const message = "Something went wrong. Please try again.";
      setServerError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4">
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative w-full max-w-sm rounded-3xl border bg-card p-8 shadow-elegant">
        <div className="flex justify-center"><Logo /></div>
        <div className="mt-6 flex items-center justify-center gap-2 text-primary">
          <ShieldCheck className="h-5 w-5" />
          <h1 className="font-display text-xl font-bold">Admin sign in</h1>
        </div>
        <p className="mt-1 text-center text-sm text-muted-foreground">Staff access only.</p>
        {serverError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {serverError}
          </div>
        ) : null}
        <form onSubmit={submit} className="mt-6 space-y-3">
          <div>
            <Label htmlFor="admin-id">Admin ID</Label>
            <Input
              id="admin-id"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Enter admin ID"
            />
          </div>
          <div>
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign in to dashboard
          </Button>
        </form>
        <div className="mt-4 text-center">
          <Button asChild variant="ghost" size="sm"><Link to="/">Back to homepage</Link></Button>
        </div>
      </div>
    </div>
  );
}
