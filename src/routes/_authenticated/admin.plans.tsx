import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BookOpen,
  Layers,
  Trophy,
  Crown,
  Pencil,
  Loader2,
  IndianRupee,
  Clock,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  head: () => ({ meta: [{ title: "Admin - Plans & Pricing" }] }),
  component: AdminPlans,
});

const ICONS: Record<string, typeof BookOpen> = {
  chapter: BookOpen,
  part: Layers,
  full: Trophy,
  combo: Crown,
};
const PLAN_COLORS: Record<string, string> = {
  chapter: "bg-blue-500/10 text-blue-600",
  part: "bg-amber-500/10 text-amber-600",
  full: "bg-purple-500/10 text-purple-600",
  combo: "bg-primary/10 text-primary",
};

interface Plan {
  id: string;
  code: string;
  title: string;
  description: string | null;
  price_inr: number;
  duration_days: number;
  sort_order: number;
  is_active: boolean;
}

function AdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("plans").select("*").order("sort_order");
    if (error) toast.error(error.message);
    setPlans((data as Plan[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleActive = async (plan: Plan) => {
    setTogglingId(plan.id);
    const nextState = !plan.is_active;

    // Optimistic UI update
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, is_active: nextState } : p)));

    const { error } = await supabase
      .from("plans")
      .update({ is_active: nextState, updated_at: new Date().toISOString() })
      .eq("id", plan.id);

    setTogglingId(null);
    if (error) {
      // Revert on error
      setPlans((prev) =>
        prev.map((p) => (p.id === plan.id ? { ...p, is_active: plan.is_active } : p)),
      );
      return toast.error("Failed to update status: " + error.message);
    }
    toast.success(
      `${plan.title} is now ${nextState ? "Active (visible to students)" : "Inactive (hidden from students)"}`,
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Plans & Pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit plan prices, descriptions, and active status. Changes reflect instantly on the Home
          Page, Pricing Page, and Cashfree Gateway amount.
        </p>
      </div>

      {/* Info notice */}
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-900/20">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <p className="font-semibold text-emerald-800 dark:text-emerald-300">
            Live Dynamic Synchronization
          </p>
          <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
            Changing the price here automatically updates the student facing UI (Homepage & Pricing
            page) and the exact charge amount on Cashfree. Toggling a plan off hides it from student
            purchase options.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading plans...
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            const Icon = ICONS[plan.code] ?? BookOpen;
            const colorClass = PLAN_COLORS[plan.code] ?? "bg-secondary text-foreground";
            const isToggling = togglingId === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border bg-card p-5 shadow-sm transition-all ${
                  plan.code === "combo" ? "border-primary ring-1 ring-primary/20" : ""
                } ${!plan.is_active ? "opacity-60 bg-muted/30 border-dashed" : ""}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className={`grid h-11 w-11 place-items-center rounded-xl ${colorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Active toggle button */}
                    <button
                      onClick={() => toggleActive(plan)}
                      disabled={isToggling}
                      title={
                        plan.is_active
                          ? "Click to deactivate and hide from students"
                          : "Click to activate and show to students"
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                        plan.is_active
                          ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20"
                          : "bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {isToggling ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : plan.is_active ? (
                        <>
                          <ToggleRight className="h-4 w-4 text-emerald-600" /> Active
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-4 w-4 text-slate-400" /> Inactive
                        </>
                      )}
                    </button>
                    <Button variant="outline" size="sm" onClick={() => setEditing(plan)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit Price
                    </Button>
                  </div>
                </div>

                {/* Plan info */}
                <div className="mt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-2xl font-extrabold text-foreground">
                      ₹{Number(plan.price_inr)}
                    </span>
                    <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {plan.code}
                    </span>
                  </div>
                  <h2 className="mt-1 font-display font-bold text-foreground">{plan.title}</h2>
                  {plan.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {plan.description}
                    </p>
                  )}
                </div>

                {/* Meta row */}
                <div className="mt-4 flex flex-wrap gap-3 border-t pt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium">
                    <IndianRupee className="h-3.5 w-3.5 text-primary" />
                    Live Price: ₹{Number(plan.price_inr)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    Valid: {plan.duration_days} days
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 font-semibold text-[11px] ${
                      plan.is_active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {plan.is_active ? "Visible to Students" : "Hidden"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <PlanEditDialog
          plan={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/* -  -  -  - Edit Dialog -  -  -  - */

function PlanEditDialog({
  plan,
  onClose,
  onSaved,
}: {
  plan: Plan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(plan.title);
  const [description, setDescription] = useState(plan.description ?? "");
  const [priceInr, setPriceInr] = useState(String(Number(plan.price_inr)));
  const [durationDays, setDurationDays] = useState(String(plan.duration_days));
  const [sortOrder, setSortOrder] = useState(String(plan.sort_order));
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(priceInr);
    const duration = Number(durationDays);
    const sort = Number(sortOrder);
    if (!title.trim()) return toast.error("Title is required");
    if (isNaN(price) || price <= 0) return toast.error("Enter a valid price greater than 0");
    if (isNaN(duration) || duration <= 0) return toast.error("Duration must be at least 1 day");

    setBusy(true);
    const { error } = await supabase
      .from("plans")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        price_inr: price,
        duration_days: duration,
        sort_order: sort,
        updated_at: new Date().toISOString(),
      })
      .eq("id", plan.id);
    setBusy(false);

    if (error) return toast.error(error.message);
    toast.success(`${title} updated! New price ₹${price} is live.`);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Edit Plan: <span className="capitalize text-primary">{plan.code}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4 pt-1">
          {/* Price  -  top & highlighted */}
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wide text-primary">
              Live Price (UI + Payment Gateway)
            </div>
            <div>
              <Label className="text-sm font-semibold">
                Price (₹){" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {" "}
                  - updates frontend & Cashfree
                </span>
              </Label>
              <div className="relative mt-1">
                <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  min="1"
                  step="1"
                  required
                  className="pl-9 text-lg font-bold"
                  value={priceInr}
                  onChange={(e) => setPriceInr(e.target.value)}
                  placeholder="149"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold">Validity (days)</Label>
              <div className="relative mt-1">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  min="1"
                  required
                  className="pl-9"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  placeholder="365"
                />
              </div>
            </div>
          </div>

          {/* Plan content */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-semibold">Plan Title</Label>
              <Input
                className="mt-1"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Chapter-Wise Series"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold">Description</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this plan includes..."
              />
            </div>
            <div>
              <Label className="text-sm font-semibold">Sort Order</Label>
              <Input
                type="number"
                className="mt-1"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
