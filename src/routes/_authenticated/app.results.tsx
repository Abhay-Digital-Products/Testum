import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/results")({
  head: () => ({ meta: [{ title: "My Results  -  Testum" }] }),
  component: Results,
});

function Results() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("attempts")
        .select("id, score, correct_count, wrong_count, unattempted_count, submitted_at, status, time_spent_seconds, tests(title, total_questions, marks_correct)")
        .eq("user_id", u.user.id).eq("status","submitted").order("submitted_at", { ascending: false });
      setList(data ?? []);
    })();
  }, []);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">My Results</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every test you've completed.</p>
      </div>
      {list.length === 0 && (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No results yet. <Link to="/app/tests" className="text-primary font-medium">Take a test →</Link>
        </div>
      )}
      <div className="space-y-2">
        {list.map(a => {
          const total = (a.tests?.total_questions ?? 180) * (a.tests?.marks_correct ?? 4);
          return (
            <Link key={a.id} to="/app/result/$attemptId" params={{ attemptId: a.id }} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-card p-4 hover:shadow-elegant">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Trophy className="h-5 w-5"/></div>
                <div className="min-w-0">
                  <div className="truncate font-display font-semibold">{a.tests?.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{a.correct_count}✓ · {a.wrong_count}✗ · {a.unattempted_count} skipped</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3"/>{Math.floor(a.time_spent_seconds/60)}m</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-xl font-bold">{Math.round(Number(a.score))}<span className="text-xs text-muted-foreground">/{total}</span></div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{new Date(a.submitted_at).toLocaleDateString()}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
