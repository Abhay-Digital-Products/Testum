import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Countdown } from "@/components/countdown";
import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, CheckCircle2, ClipboardList, Flame, SkipForward, Target, TrendingUp, Trophy, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dashboard  -  Testum" }] }),
  component: Dashboard,
});

function Dashboard() {
  const [stats, setStats] = useState({ attempted: 0, avgScore: 0, accuracy: 0, best: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [name, setName] = useState<string>("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [weak, setWeak] = useState<string[]>([]);
  const [resume, setResume] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase.from("profiles").select("full_name").eq("user_id", u.user.id).maybeSingle();
      setName(p?.full_name?.split(" ")[0] ?? "");

      const { data: open } = await supabase
        .from("attempts")
        .select("id, started_at, tests(title)")
        .eq("user_id", u.user.id)
        .eq("status", "in_progress")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setResume(open ?? null);


      const { data: atts } = await supabase
        .from("attempts")
        .select("id, score, correct_count, wrong_count, unattempted_count, submitted_at, status, tests(title, total_questions, marks_correct)")
        .eq("user_id", u.user.id).eq("status", "submitted")
        .order("submitted_at", { ascending: false }).limit(10);

      const list = atts ?? [];
      if (list.length) {
        const scores = list.map((a: any) => Number(a.score));
        const totalQ = list.reduce((s: number, a: any) => s + (a.correct_count + a.wrong_count), 0);
        const totalC = list.reduce((s: number, a: any) => s + a.correct_count, 0);
        setStats({
          attempted: list.length,
          avgScore: Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length),
          accuracy: totalQ ? Math.round((totalC / totalQ) * 100) : 0,
          best: Math.round(Math.max(...scores)),
        });
      }
      setRecent(list.slice(0, 4));

      if (list[0]) {
        const { data: an } = await supabase.from("analysis").select("ai_summary, weak_topics").eq("attempt_id", list[0].id).maybeSingle();
        setAiSummary(an?.ai_summary ?? null);
        setWeak(an?.weak_topics ?? []);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="relative rounded-3xl border bg-hero p-5 text-primary-foreground shadow-elegant sm:p-7 overflow-hidden">
        {/* Subtle background grid overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 31px,white 31px,white 32px),repeating-linear-gradient(90deg,transparent,transparent 31px,white 31px,white 32px)" }}
        />

        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          {/* Left: text + countdown */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs opacity-80 font-semibold uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
              NEET 2027 · Sunday, 2 May 2027
            </div>
            <h1 className="mt-2 font-display text-2xl font-black sm:text-3xl leading-tight">
              {name ? `Hey ${name} 👋` : "Welcome back 👋"}
            </h1>
            <p className="mt-1 text-sm opacity-75 leading-relaxed">
              Stay consistent · one test a day builds your NEET rank.
            </p>

            <div className="mt-5">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest opacity-60">Time left to NEET 2027</div>
              <Countdown dark />
            </div>
          </div>

        </div>
      </div>


      {resume && (
        <div className="flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning/20 text-warning">
            <Flame className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Unfinished test  -  {resume.tests?.title ?? "Mock test"}</div>
            <div className="text-xs text-muted-foreground">Your answers are saved. Continue right where you left off.</div>
          </div>
          <Button asChild size="sm" className="sm:w-auto">
            <Link to="/app/attempt/$attemptId" params={{ attemptId: resume.id }}>Resume test</Link>
          </Button>
        </div>
      )}



      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Attempted", v: stats.attempted, Icon: ClipboardList, tint: "bg-primary/10 text-primary" },
          { l: "Avg Score", v: stats.avgScore, Icon: TrendingUp, tint: "bg-success/10 text-success" },
          { l: "Accuracy", v: `${stats.accuracy}%`, Icon: Target, tint: "bg-info/10 text-info" },
          { l: "Best", v: stats.best, Icon: Trophy, tint: "bg-warning/10 text-warning" },
        ].map(({ l, v, Icon, tint }) => (
          <div key={l} className="rounded-2xl border bg-card p-4">
            <div className={`grid h-9 w-9 place-items-center rounded-xl ${tint}`}><Icon className="h-4 w-4" /></div>
            <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{l}</div>
            <div className="mt-0.5 font-display text-2xl font-bold">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold">Recent tests</h2>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-primary font-semibold">
              <Link to="/app/tests">All tests <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
          <div className="space-y-3">
            {recent.length === 0 && (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No attempts yet. <Link to="/app/tests" className="text-primary font-medium">Take your first test →</Link>
              </div>
            )}
            {recent.map((a) => {
              const total = (a.tests?.total_questions ?? 180) * (a.tests?.marks_correct ?? 4);
              const score = Math.round(Number(a.score));
              return (
                <Link
                  key={a.id}
                  to="/app/result/$attemptId"
                  params={{ attemptId: a.id }}
                  className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-xs hover:shadow-sm hover:border-primary/30 transition-all duration-150"
                >
                  {/* Trophy Icon */}
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
                    </div>
                  </div>

                  {/* Score */}
                  <div className="shrink-0 text-right">
                    <span className="font-display text-xl font-black text-foreground">
                      {score}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">/{total}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-foreground"><Brain className="h-4 w-4" /></div>
            <h2 className="font-display text-lg font-semibold">AI Insights</h2>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {aiSummary ?? "Complete a test to unlock personalized AI feedback and weak-topic analysis."}
          </p>
          {weak.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Focus areas</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {weak.slice(0, 6).map((w) => (
                  <span key={w} className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">{w}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="h-4 w-4 text-warning" />
          <h2 className="font-display text-lg font-semibold">Quick start</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { t: "Chapter-wise", d: "Master one chapter at a time", tab: "chapter" },
            { t: "Part syllabus", d: "Mid-prep checkpoints", tab: "part" },
            { t: "Full syllabus", d: "180 Q · 180 min mock", tab: "full" },
          ].map((c) => (
            <Link key={c.t} to="/app/tests" search={{ tab: c.tab }} className="rounded-xl border p-4 hover:border-primary hover:shadow-elegant transition cursor-pointer">
              <div className="font-display font-semibold">{c.t}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{c.d}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
