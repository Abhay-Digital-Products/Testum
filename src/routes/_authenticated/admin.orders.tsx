import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, IndianRupee } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({ meta: [{ title: "Admin · Orders  -  Testum" }] }),
  component: AdminOrders,
});

const FILTERS = ["all", "paid", "created", "failed", "cancelled"] as const;

function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: p }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("profiles").select("id, user_id, full_name, mobile"),
      ]);
      setOrders(o ?? []);
      const nameMap: Record<string, string> = {};
      for (const x of p ?? []) {
        const label = `${x.full_name ?? "Student"}${x.mobile ? ` · ${x.mobile}` : ""}`;
        if (x.user_id) nameMap[x.user_id] = label;
        if (x.id) nameMap[x.id] = label;
      }
      setNames(nameMap);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (!t) return true;
      return [names[o.user_id], o.plan_code, o.cf_order_id, o.id].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(t),
      );
    });
  }, [orders, status, q, names]);

  const revenue = filtered
    .filter((o) => o.status === "paid")
    .reduce((t, o) => t + Number(o.amount_inr || 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every checkout attempt with its payment status.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <IndianRupee className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Revenue (filtered)
          </div>
          <div className="font-display text-2xl font-bold">₹{revenue.toLocaleString("en-IN")}</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search student, plan or order id"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={status === f ? "default" : "outline"}
              className="capitalize"
              onClick={() => setStatus(f)}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading orders…
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No orders match this filter.</p>
      )}

      <div className="space-y-2">
        {filtered.map((o) => (
          <div key={o.id} className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display font-semibold">{names[o.user_id] ?? "Student"}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  <span className="capitalize">{o.plan_code}</span> ·{" "}
                  {new Date(o.created_at).toLocaleString("en-IN")}
                </div>
                {o.cf_order_id && (
                  <div className="mt-1 break-all text-[11px] text-muted-foreground">
                    Ref: {o.cf_order_id}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-display text-lg font-bold">
                  ₹{Number(o.amount_inr).toLocaleString("en-IN")}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${o.status === "paid" ? "bg-success/10 text-success" : o.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`}
                >
                  {o.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
