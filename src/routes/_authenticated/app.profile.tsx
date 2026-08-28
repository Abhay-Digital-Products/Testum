import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlements, PlanCode } from "@/hooks/use-entitlements";
import { createCheckout } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Crown, Check, BookOpen, Layers, Trophy, ShieldCheck, ArrowRight, User, Mail, Phone, GraduationCap, Zap, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/profile")({
  head: () => ({
    meta: [
      { title: "Profile & Plans  -  Testum" },
      { name: "description", content: "Manage your Testum profile details, view your active subscription plans, and unlock test series." },
    ],
  }),
  component: Profile,
});

const CLASS_LABEL: Record<string, string> = { "11th": "11th Class", "12th": "12th Class", dropper: "Dropper" };
const PLAN_LABEL: Record<string, string> = {
  chapter: "Chapter-Wise Series",
  part: "Part Syllabus Series",
  full: "Full Syllabus Series",
  combo: "Combo All-Access Pack",
};
const ICONS: Record<string, typeof BookOpen> = { chapter: BookOpen, part: Layers, full: Trophy, combo: Crown };

interface PlanItem {
  id: string;
  code: PlanCode;
  title: string;
  description: string | null;
  price_inr: number;
  duration_days: number;
  sort_order: number;
}

function Profile() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [studentClass, setStudentClass] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const checkout = useServerFn(createCheckout);
  const [availablePlans, setAvailablePlans] = useState<PlanItem[]>([]);
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null);

  const { plans, isAdmin, loading } = useEntitlements();

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? "");

      const [{ data: p }, { data: plansData }] = await Promise.all([
        supabase.from("profiles").select("full_name, mobile, student_class").eq("user_id", u.user.id).maybeSingle(),
        supabase.from("plans").select("*").eq("is_active", true).order("sort_order"),
      ]);

      setName(p?.full_name ?? "");
      setMobile(p?.mobile ?? "");
      setStudentClass(p?.student_class ?? "");
      if (plansData) {
        setAvailablePlans(plansData as PlanItem[]);
      }
    })();
  }, []);

  const save = async () => {
    if (mobile && !/^[6-9]\d{9}$/.test(mobile)) return toast.error("Enter a valid 10-digit mobile number");
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setBusy(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim(), mobile: mobile || null, student_class: (studentClass || null) as never })
      .eq("user_id", u.user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved successfully");
  };

  const buy = async (p: PlanItem) => {
    setBuyingPlan(p.code);
    try {
      const returnUrl = `${window.location.origin}/app/payment-status`;
      const res = await checkout({ data: { planCode: p.code as any, returnUrl } });
      const w = window as any;
      if (!w.Cashfree) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Could not load payment SDK"));
          document.head.appendChild(s);
        });
      }
      const cf = w.Cashfree({ mode: res.env });
      cf.checkout({ paymentSessionId: res.paymentSessionId, redirectTarget: "_self" });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start payment.");
      setBuyingPlan(null);
    }
  };

  const hasCombo = plans.has("combo");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Profile & Subscriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account details and view or upgrade your test series plans.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Left Column: Personal Information */}
        <div className="space-y-6 md:col-span-5">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <User className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-semibold">Personal Info</h2>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Email Address</Label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{email || "Loading..."}</span>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Full Name</Label>
                <Input
                  className="mt-1"
                  placeholder="Your full name"
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Class / Academic Batch</Label>
                <Select value={studentClass} onValueChange={setStudentClass}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select your class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="11th">11th Class</SelectItem>
                    <SelectItem value="12th">12th Class</SelectItem>
                    <SelectItem value="dropper">Dropper Batch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Mobile Number</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    inputMode="numeric"
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Target Exam</Label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-sm font-medium">
                  <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
                  <span>NEET 2027 CBT</span>
                </div>
              </div>
            </div>

            <Button onClick={save} disabled={busy} className="w-full h-11 font-semibold">
              {busy ? "Saving..." : "Save Profile Changes"}
            </Button>
          </div>
        </div>

        {/* Right Column: Plans & Entitlements */}
        <div className="space-y-6 md:col-span-7">
          {/* Active Membership Status Banner */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-semibold">Your Active Access</h2>
              </div>
              {isAdmin && (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  ADMIN UNLIMITED
                </span>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Checking subscription status...</p>
            ) : isAdmin ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <div className="font-semibold text-foreground flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> Full Admin Privileges Active
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  You have full unrestricted access to all test series, chapter tests, and solutions.
                </p>
              </div>
            ) : plans.size > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Unlocked Series & Plans:</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(plans).map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-success/30 bg-success/10 px-3.5 py-1.5 text-xs font-bold text-success"
                    >
                      <Check className="h-4 w-4" />
                      {PLAN_LABEL[code] ?? code}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-4 text-center space-y-2">
                <p className="text-sm text-muted-foreground">You currently have no active paid plans.</p>
                <p className="text-xs text-muted-foreground">Free practice tests are available. Unlock full series below.</p>
              </div>
            )}
          </div>

          {/* Test Series Plans Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Available Test Series Plans</h2>
              <Link to="/app/pricing" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                Full Pricing Page <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              {availablePlans.map((p) => {
                const Icon = ICONS[p.code] ?? BookOpen;
                const isUnlocked = isAdmin || hasCombo || plans.has(p.code);
                const isCombo = p.code === "combo";

                return (
                  <div
                    key={p.id}
                    className={`relative flex flex-col justify-between rounded-2xl border bg-card p-5 transition-all ${
                      isCombo ? "border-primary ring-1 ring-primary/40 shadow-sm" : ""
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="text-right">
                          <div className="font-display text-xl font-extrabold text-foreground">₹{Number(p.price_inr)}</div>
                          {isCombo && (
                            <span className="inline-block rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                              Best Value
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="mt-3 font-display font-bold text-foreground text-sm sm:text-base">{p.title}</h3>
                      {p.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                    </div>

                    <div className="mt-4 pt-3 border-t">
                      {isUnlocked ? (
                        <div className="flex items-center justify-center gap-1.5 rounded-xl bg-success/10 py-2 text-xs font-bold text-success">
                          <Check className="h-4 w-4" /> Active Plan
                        </div>
                      ) : (
                        <Button
                          variant={isCombo ? "default" : "outline"}
                          size="sm"
                          className="w-full h-9 font-semibold text-xs"
                          disabled={buyingPlan !== null}
                          onClick={() => buy(p)}
                        >
                          {buyingPlan === p.code ? (
                            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Opening...</>
                          ) : (
                            `Pay Rs.${Number(p.price_inr)}`
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl border bg-card/60 p-4 text-xs text-muted-foreground">
              <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
              <span>Secure payment via Cashfree · UPI, Cards, Net Banking supported · Instant access on success.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
