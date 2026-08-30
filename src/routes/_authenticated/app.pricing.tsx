import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createCheckout } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Layers,
  Trophy,
  Crown,
  Check,
  Loader2,
  ShieldCheck,
  Zap,
  Star,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/pricing")({
  head: () => ({
    meta: [
      { title: "Unlock Test Series - Testum" },
      {
        name: "description",
        content:
          "Unlock Testum NEET 2027 CBT test series. Chapter, part, full syllabus or the combo pack.",
      },
    ],
  }),
  component: Pricing,
});

const ICONS: Record<string, typeof BookOpen> = {
  chapter: BookOpen,
  part: Layers,
  full: Trophy,
  combo: Crown,
};

function loadCashfree(env: "production" | "sandbox"): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.Cashfree) return resolve(w.Cashfree);
    const s = document.createElement("script");
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.onload = () => resolve((window as any).Cashfree);
    s.onerror = () => reject(new Error("Could not load payment SDK"));
    document.head.appendChild(s);
  });
}

function Pricing() {
  const navigate = useNavigate();
  const checkout = useServerFn(createCheckout);

  const [plans, setPlans] = useState<any[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      setPlans(data ?? []);
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: ents } = await supabase
          .from("entitlements")
          .select("plan_code, expires_at")
          .eq("user_id", u.user.id);
        const now = Date.now();
        setOwned(
          new Set(
            (ents ?? [])
              .filter((e: any) => !e.expires_at || new Date(e.expires_at).getTime() > now)
              .map((e: any) => e.plan_code),
          ),
        );
      }
      setLoading(false);
    })();
  }, []);

  const buy = async (planCode: string) => {
    setBusy(planCode);
    try {
      const returnUrl = `${window.location.origin}/app/payment-status`;
      const res = await checkout({ data: { planCode: planCode as any, returnUrl } });
      const Cashfree = await loadCashfree(res.env);
      const cf = Cashfree({ mode: res.env });
      cf.checkout({ paymentSessionId: res.paymentSessionId, redirectTarget: "_self" });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start payment. Please try again.");
      setBusy(null);
    }
  };

  const hasCombo = owned.has("combo");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Unlock your test series</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One-time payment. Full access for 1 year. Instant activation after payment.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> Loading plans...
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No active plans available right now. Please check back later.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((p) => {
            const Icon = ICONS[p.code] ?? BookOpen;
            const unlocked = hasCombo || owned.has(p.code);
            const isCombo = p.code === "combo";
            const isLoading = busy === p.code;

            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border bg-card p-5 transition-all ${
                  isCombo
                    ? "border-primary shadow-md ring-2 ring-primary/20"
                    : unlocked
                      ? "border-success/30 bg-success/5"
                      : "hover:border-primary/30"
                }`}
              >
                {isCombo && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
                      <Star className="h-3 w-3 fill-white" /> Best Value
                    </span>
                  </div>
                )}

                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`grid h-12 w-12 place-items-center rounded-xl ${isCombo ? "bg-primary/10 text-primary" : "bg-secondary text-foreground"}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl font-extrabold text-foreground">
                      ₹{Number(p.price_inr)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">one-time</div>
                  </div>
                </div>

                <div className="mt-3 flex-1">
                  <h2 className="font-display text-base font-bold text-foreground">{p.title}</h2>
                  {p.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  Valid for {p.duration_days} days from purchase
                </div>

                <div className="mt-4 pt-3 border-t">
                  {unlocked ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-success/10 py-2.5 text-sm font-bold text-success">
                      <Check className="h-4 w-4" /> Plan Active
                    </div>
                  ) : (
                    <Button
                      className="h-11 w-full font-semibold"
                      variant={isCombo ? "default" : "outline"}
                      disabled={busy !== null}
                      onClick={() => buy(p.code)}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Opening payment...
                        </>
                      ) : (
                        `Pay ₹${Number(p.price_inr)} securely`
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, text: "256-bit SSL encryption" },
          { icon: Zap, text: "Instant access after payment" },
          { icon: Check, text: "1-year validity guaranteed" },
        ].map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex items-center gap-2.5 rounded-xl border bg-card/60 px-4 py-3 text-xs font-medium text-muted-foreground"
          >
            <Icon className="h-4 w-4 shrink-0 text-success" />
            {text}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-success" />
        Payments powered by Cashfree · RBI-compliant · UPI, Cards, Net Banking accepted
      </div>
    </div>
  );
}
