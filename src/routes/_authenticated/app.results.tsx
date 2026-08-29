import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, SkipForward, Trophy, XCircle } from "lucide-react";

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
      const { data } = await supabase
        .from("attempts")
        .select("id, score, correct_count, wrong_count, unattempted_count, submitted_at, status, time_spent_seconds, tests(title, total_questions, marks_correct)")
        .eq("user_id", u.user.id)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false });
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
          No results yet.{" "}
          <Link to="/app/tests" className="text-primary font-medium">
            Take a test →
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {list.map((a) => {
          const total = (a.tests?.total_questions ?? 180) * (a.tests?.marks_correct ?? 4);
          const score = Math.round(Number(a.score));
          const mins = Math.floor((a.time_spent_seconds ?? 0) / 60);

          return (
            <Link
              key={a.id}
              to="/app/result/$attemptId"
              params={{ attemptId: a.id }}
              className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-xs hover:shadow-sm hover:border-primary/30 transition-all duration-150"
            >
              {/* Trophy icon */}
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10">
                <Trophy className="h-5 w-5 text-primary" />
              </div>

              {/* Test info */}
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm font-bold text-foreground">
                  {a.tests?.title ?? "Test"}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {/* Correct chip */}
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-100">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    {a.correct_count}
                  </span>
                  {/* Wrong chip */}
                  <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-100">
                    <XCircle className="h-3 w-3 text-rose-500" />
                    {a.wrong_count}
                  </span>
                  {/* Skipped chip */}
                  <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 border border-orange-100">
                    <SkipForward className="h-3 w-3 text-orange-400" />
                    {a.unattempted_count} skipped
                  </span>
                  {/* Time */}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {mins}m
                  </span>
                </div>
              </div>

              {/* Score + date */}
              <div className="shrink-0 text-right">
                <div>
                  <span className="font-display text-xl font-black text-foreground">{score}</span>
                  <span className="text-xs font-semibold text-muted-foreground">/{total}</span>
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {new Date(a.submitted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
