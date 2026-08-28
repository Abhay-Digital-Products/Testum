import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, ClipboardList, HelpCircle, Trophy, IndianRupee, Layers, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Overview  -  Testum" }] }),
  component: AdminHome,
});

function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

function AdminHome() {
  const [s, setS] = useState({ series: 0, tests: 0, questions: 0, attempts: 0, students: 0, revenue: 0, paid: 0 });
  const [orders, setOrders] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [a, b, c, d, e, paidOrders, recentOrders, recentAttempts] = await Promise.all([
        supabase.from("test_series").select("*", { count: "exact", head: true }),
        supabase.from("tests").select("*", { count: "exact", head: true }),
        supabase.from("questions").select("*", { count: "exact", head: true }),
        supabase.from("attempts").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("amount_inr").eq("status", "paid"),
        supabase.from("orders").select("id, plan_code, amount_inr, status, created_at, user_id").order("created_at", { ascending: false }).limit(6),
        supabase.from("attempts").select("id, score, status, submitted_at, tests(title)").order("started_at", { ascending: false }).limit(6),
      ]);
      const revenue = (paidOrders.data ?? []).reduce((t: number, o: any) => t + Number(o.amount_inr || 0), 0);
      setS({
        series: a.count ?? 0, tests: b.count ?? 0, questions: c.count ?? 0,
        attempts: d.count ?? 0, students: e.count ?? 0,
        revenue, paid: (paidOrders.data ?? []).length,
      });
      setOrders(recentOrders.data ?? []);
      setAttempts(recentAttempts.data ?? []);
    })();
  }, []);

  const cards = [
    { l: "Revenue", v: fmt(s.revenue), Icon: IndianRupee, sub: `${s.paid} paid orders` },
    { l: "Students", v: s.students, Icon: Users },
    { l: "Series", v: s.series, Icon: Layers },
    { l: "Tests", v: s.tests, Icon: ClipboardList },
    { l: "Questions", v: s.questions, Icon: HelpCircle },
    { l: "Attempts", v: s.attempts, Icon: Trophy },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Admin Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Content, students and revenue at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(({ l, v, Icon, sub }) => (
          <div key={l} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
            <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{l}</div>
            <div className="mt-0.5 font-display text-2xl font-bold">{v}</div>
            {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent orders</h2>
            <Link to="/admin/orders" className="inline-flex items-center gap-1 text-sm font-medium text-primary">All <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="mt-3 space-y-2">
            {orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm">
                <span className="capitalize">{o.plan_code}</span>
                <span className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString("en-IN")}</span>
                <span className="font-semibold">{fmt(Number(o.amount_inr))}</span>
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${o.status === "paid" ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}>{o.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Recent attempts</h2>
          <div className="mt-3 space-y-2">
            {attempts.length === 0 && <p className="text-sm text-muted-foreground">No attempts yet.</p>}
            {attempts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{a.tests?.title ?? "Test"}</span>
                <span className="shrink-0 text-muted-foreground">{a.status}</span>
                <span className="shrink-0 font-semibold">{Number(a.score)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Getting started</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          <li>Create a <b>Test Series</b> and link it to the plan that unlocks it.</li>
          <li>Add a <b>Test</b> with duration, marks and release date.</li>
          <li>Add <b>Questions</b>  -  paste question/option image URLs, mark the correct option, add a solution.</li>
          <li>Grant free access to a student any time from the <b>Students</b> page.</li>
        </ol>
        <Link to="/admin/tests" className="mt-4 inline-flex text-sm font-medium text-primary">Manage tests →</Link>
      </div>
    </div>
  );
}
