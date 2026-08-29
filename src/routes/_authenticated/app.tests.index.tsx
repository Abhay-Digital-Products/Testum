import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlements, type PlanCode } from "@/hooks/use-entitlements";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TestListSkeleton } from "@/components/skeleton-loaders";
import {
  Search, Clock, ListChecks, Play, Atom, TestTube2, Sprout, Trophy,
  CheckCircle2, Lock, Crown, Sparkles, Layers, BookOpen, Calendar, ArrowRight
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/tests/")({
  head: () => ({
    meta: [
      { title: "Test Series - Testum" },
      { name: "description", content: "Browse free tests, chapter-wise, part and full syllabus NEET CBT tests on Testum." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { tab?: string } => {
    return { tab: typeof search.tab === "string" ? search.tab : undefined };
  },
  component: Tests,
});

const subjectIcon = (s: string) => {
  const l = (s || "").toLowerCase();
  if (l.includes("physic")) return Atom;
  if (l.includes("chem")) return TestTube2;
  if (l.includes("bio") || l.includes("botan") || l.includes("zool")) return Sprout;
  return Trophy;
};

const TAB_CONFIG = {
  free: {
    title: "100% Free Practice Tests",
    description: "Real NTA exam pattern, timer, question palette & instant performance scorecards without payment.",
    icon: Sparkles,
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 text-emerald-700",
    badge: "Free Access",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  chapter: {
    title: "Chapter-Wise Targeted Series",
    description: "Master each NCERT chapter individually with focused questions, PYQ patterns, and instant solutions.",
    icon: BookOpen,
    gradient: "from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20 text-blue-700",
    badge: "Chapter Plan",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
  },
  part: {
    title: "Part Syllabus Checkpoints",
    description: "Combined multi-chapter and class-level checkpoints to track progressive syllabus mastery.",
    icon: Layers,
    gradient: "from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20 text-amber-700",
    badge: "Part Plan",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
  },
  full: {
    title: "Full-Length Mock Series",
    description: "Complete 180 Questions, 720 Marks full syllabus simulations under authentic exam pressure.",
    icon: Trophy,
    gradient: "from-purple-500/10 via-purple-500/5 to-transparent border-purple-500/20 text-purple-700",
    badge: "Full Mock Plan",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
  },
};

function Tests() {
  const search = Route.useSearch();
  const [tests, setTests] = useState<any[]>([]);
  const [attemptedIds, setAttemptedIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"free" | "chapter" | "part" | "full">((search.tab as any) || "free");
  const [dataLoading, setDataLoading] = useState(true);
  const { hasAccess, loading: entLoading } = useEntitlements();

  useEffect(() => {
    (async () => {
      setDataLoading(true);
      const { data } = await supabase
        .from("tests")
        .select("id, title, duration_minutes, total_questions, marks_correct, marks_wrong, opens_at, syllabus, is_free, subject_scope, series_id, test_series(kind, subject, title, plan_code)")
        .order("created_at", { ascending: false });
      setTests(data ?? []);

      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: att } = await supabase.from("attempts").select("test_id, status").eq("user_id", u.user.id).eq("status", "submitted");
        setAttemptedIds(new Set((att ?? []).map((a: any) => a.test_id)));
      }
      setDataLoading(false);
    })();
  }, []);

  // Helper to accurately determine if a test is free
  const checkIsFreeTest = (t: any) => {
    if (!t) return false;
    if (Boolean(t.is_free)) return true;
    const plan = t.test_series?.plan_code ?? null;
    if (!plan || plan === "free") return true;
    const seriesTitle = (t.test_series?.title ?? "").toLowerCase();
    const testTitle = (t.title ?? "").toLowerCase();
    return seriesTitle.includes("free") || testTitle.includes("free");
  };

  // Compute test counts per tab
  const counts = useMemo(() => {
    const res = { free: 0, chapter: 0, part: 0, full: 0 };
    for (const t of tests) {
      if (checkIsFreeTest(t)) res.free++;
      const kind = t.test_series?.kind;
      if (kind === "chapter") res.chapter++;
      else if (kind === "part") res.part++;
      else if (kind === "full") res.full++;
    }
    return res;
  }, [tests]);

  const filtered = useMemo(() => {
    return tests.filter((t) => {
      const isFreeTest = checkIsFreeTest(t);

      if (tab === "free") {
        if (!isFreeTest) return false;
      } else {
        if (t.test_series?.kind !== tab) return false;
      }

      if (q) {
        const query = q.toLowerCase();
        const titleMatch = t.title.toLowerCase().includes(query);
        const seriesMatch = (t.test_series?.title ?? "").toLowerCase().includes(query);
        const syllabusMatch = (t.syllabus ?? "").toLowerCase().includes(query);
        if (!titleMatch && !seriesMatch && !syllabusMatch) return false;
      }
      return true;
    });
  }, [tests, tab, q]);

  const activeConf = TAB_CONFIG[tab] || TAB_CONFIG.free;
  const ActiveIcon = activeConf.icon;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black sm:text-3xl tracking-tight">Test Series Portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select your category to begin.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-xl border-primary/30 text-primary hover:bg-primary/5 font-semibold">
          <Link to="/app/pricing"><Crown className="mr-1.5 h-4 w-4 text-primary" /> Unlock All Plans</Link>
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tests by title, chapter or syllabus topics..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-10 h-12 rounded-xl text-sm bg-card border-border/80 shadow-xs focus:ring-2 focus:ring-primary/20"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {/* Tabs Switcher with Badges */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-12 p-1 bg-muted/60 rounded-xl border border-border/60">
          <TabsTrigger
            value="free"
            className="rounded-lg text-xs font-bold transition-all data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-emerald-700 dark:text-emerald-400"
          >
            <Sparkles className="mr-1 h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Free Tests</span>
            <span className="ml-1.5 hidden sm:inline-block rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
              {counts.free}
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="chapter"
            className="rounded-lg text-xs font-semibold transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <span className="truncate">Chapter-wise</span>
            <span className="ml-1.5 hidden sm:inline-block rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
              {counts.chapter}
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="part"
            className="rounded-lg text-xs font-semibold transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <span className="truncate">Part syllabus</span>
            <span className="ml-1.5 hidden sm:inline-block rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
              {counts.part}
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="full"
            className="rounded-lg text-xs font-semibold transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <span className="truncate">Full syllabus</span>
            <span className="ml-1.5 hidden sm:inline-block rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
              {counts.full}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Dynamic Category Hero Card */}
        <div className={"mt-4 rounded-2xl border bg-gradient-to-r p-4 sm:p-5 transition-all duration-300 " + activeConf.gradient}>
          <div className="flex items-start gap-3.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card border shadow-xs">
              <ActiveIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-base sm:text-lg font-bold text-foreground">{activeConf.title}</h2>
                <span className={"rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border " + activeConf.badgeColor}>
                  {filtered.length} {filtered.length === 1 ? "Test Available" : "Tests Available"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {activeConf.description}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Contents */}
        {(["free", "chapter", "part", "full"] as const).map((k) => (
          <TabsContent
            key={k}
            value={k}
            className="mt-4 space-y-3 focus-visible:outline-none animate-in fade-in-50 slide-in-from-bottom-2 duration-300"
          >
            {dataLoading ? (
              <TestListSkeleton count={4} />
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center animate-in fade-in-50 duration-200">
                <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <ListChecks className="h-6 w-6 animate-pulse" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                  </span>
                </div>
                <h3 className="mt-4 font-display font-bold text-base text-foreground">No tests found</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  {q ? ("No tests matched \"" + q + "\". Try clearing your search term.") : ("No " + activeConf.title.toLowerCase() + " added yet. Switch to Free Tests or check back soon.")}
                </p>
                {q ? (
                  <Button variant="outline" size="sm" onClick={() => setQ("")} className="mt-4 rounded-xl text-xs">
                    Clear Search
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm" className="mt-4 rounded-xl text-xs">
                    <Link to="/app/tests" search={{ tab: "free" }}>View Free Tests</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-3">
                {filtered.map((t, index) => {
                  const subj = t.test_series?.subject ?? "mixed";
                  const Icon = subjectIcon(subj);
                  const done = attemptedIds.has(t.id);
                  const isFreeTest = checkIsFreeTest(t);
                  const plan = isFreeTest ? null : ((t.test_series?.plan_code ?? t.test_series?.kind ?? null) as PlanCode | null);
                  const unlocked = isFreeTest || (!entLoading && hasAccess(plan, isFreeTest));
                  const totalMarks = (t.total_questions || 180) * (t.marks_correct || 4);

                  return (
                    <div
                      key={t.id}
                      style={{ animationDelay: (index * 50) + "ms" }}
                      className={"group relative rounded-2xl border bg-card p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-in fade-in-50 slide-in-from-bottom-2 fill-mode-both " + (
                        isFreeTest
                          ? "border-emerald-500/30 hover:border-emerald-500/60"
                          : unlocked
                          ? "hover:border-primary/40"
                          : "opacity-90 hover:border-border"
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        {/* Test details */}
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          <div className={"grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105 " + (
                            isFreeTest
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : unlocked
                              ? "bg-primary/10 text-primary"
                              : "bg-secondary text-muted-foreground"
                          )}>
                            <Icon className="h-6 w-6" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-display text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                                {t.title}
                              </span>
                              {isFreeTest && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 border border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300">
                                  <Sparkles className="h-3 w-3" /> 100% FREE
                                </span>
                              )}
                            </div>

                            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground/80">{t.test_series?.title ?? "NEET Test Series"}</span>
                              <span>·</span>
                              <span className="capitalize font-semibold text-primary">{t.test_series?.subject ?? "Mixed"}</span>
                            </div>

                            {/* Syllabus Box if available */}
                            {t.syllabus && (
                              <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-muted/40 p-2.5 text-xs text-foreground/90 border border-border/60">
                                <BookOpen className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                                <div className="min-w-0 leading-relaxed">
                                  <span className="font-bold text-foreground mr-1.5">Syllabus:</span>
                                  <span className="text-muted-foreground">{t.syllabus}</span>
                                </div>
                              </div>
                            )}

                            {/* Meta pills */}
                            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 font-medium">
                                <ListChecks className="h-3.5 w-3.5 text-primary" /> {t.total_questions} Questions
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 font-medium">
                                <Clock className="h-3.5 w-3.5 text-primary" /> {t.duration_minutes} Mins
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 font-medium">
                                <Trophy className="h-3.5 w-3.5 text-primary" /> {totalMarks} Marks
                              </span>
                              {t.opens_at && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 font-medium">
                                  <Calendar className="h-3.5 w-3.5 text-primary" /> {new Date(t.opens_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons & status */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                          <span className={"rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " + (
                            isFreeTest
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : !unlocked
                              ? "bg-muted text-muted-foreground border border-border"
                              : done
                              ? "bg-success/15 text-success border border-success/30"
                              : "bg-primary/10 text-primary border border-primary/20"
                          )}>
                            {isFreeTest ? "Free Mock" : !unlocked ? "Locked" : done ? "Attempted" : "Ready"}
                          </span>

                          {unlocked ? (
                            <Button
                              asChild
                              className={"h-10 px-5 font-semibold rounded-xl shadow-xs transition-all w-full sm:w-auto " + (
                                isFreeTest
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
                              )}
                            >
                              <Link to="/app/tests/$testId" params={{ testId: t.id }}>
                                {done ? (
                                  <><CheckCircle2 className="mr-1.5 h-4 w-4" /> Reattempt</>
                                ) : (
                                  <><Play className="mr-1.5 h-4 w-4 fill-current" /> Start Test</>
                                )}
                              </Link>
                            </Button>
                          ) : (
                            <Button asChild variant="secondary" className="h-10 px-4 font-semibold rounded-xl w-full sm:w-auto" disabled={entLoading}>
                              <Link to="/app/pricing">
                                <Lock className="mr-1.5 h-4 w-4 text-muted-foreground" /> Unlock
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
