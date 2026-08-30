import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlements, type PlanCode } from "@/hooks/use-entitlements";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { TestListSkeleton } from "@/components/skeleton-loaders";
import {
  Search, Clock, ListChecks, Play, Atom, TestTube2, Sprout, Trophy,
  CheckCircle2, Lock, Crown, Layers, BookOpen, Calendar, Gift, Puzzle, FileText, ExternalLink, Download, Sparkles
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
    icon: Gift,
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
    icon: Puzzle,
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
  const [allSeries, setAllSeries] = useState<any[]>([]);
  const [attemptedIds, setAttemptedIds] = useState<Set<string>>(new Set());
  const [plannerModalSeries, setPlannerModalSeries] = useState<any | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"free" | "chapter" | "part" | "full">((search.tab as any) || "free");
  const [dataLoading, setDataLoading] = useState(true);
  const { hasAccess, loading: entLoading } = useEntitlements();

  useEffect(() => {
    (async () => {
      setDataLoading(true);
      const [{ data: testData }, { data: seriesData }] = await Promise.all([
        supabase
          .from("tests")
          .select("id, title, duration_minutes, total_questions, marks_correct, marks_wrong, opens_at, syllabus, is_free, subject_scope, series_id, test_series(id, kind, subject, title, plan_code, planner_pdf_url)")
          .order("created_at", { ascending: false }),
        supabase
          .from("test_series")
          .select("id, title, kind, subject, description, plan_code, planner_pdf_url")
          .order("title", { ascending: true }),
      ]);
      setTests(testData ?? []);
      setAllSeries(seriesData ?? []);

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

  // Test series belonging to the active tab
  const tabSeries = useMemo(() => {
    if (tab === "free") {
      const freeOnly = allSeries.filter((s) => s.plan_code === "free" || !s.plan_code);
      return freeOnly.length > 0 ? freeOnly : allSeries;
    }
    return allSeries.filter((s) => s.kind === tab);
  }, [allSeries, tab]);

  const availablePlanners = useMemo(() => {
    return tabSeries.filter((s) => Boolean(s.planner_pdf_url && typeof s.planner_pdf_url === "string" && s.planner_pdf_url.trim()));
  }, [tabSeries]);

  const activeConf = TAB_CONFIG[tab] || TAB_CONFIG.free;
  const ActiveIcon = activeConf.icon;

  return (
    <div className="space-y-4 max-w-5xl mx-auto w-full min-w-0 pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-black sm:text-2xl lg:text-3xl tracking-tight text-foreground truncate">Test Series</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground truncate">
            Select your category to begin practicing.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-xl border-primary/30 text-primary hover:bg-primary/5 font-semibold text-xs shrink-0 h-8 sm:h-9 px-3">
          <Link to="/app/pricing"><Crown className="mr-1.5 h-3.5 w-3.5 text-primary" /> Unlock Plans</Link>
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search test name, syllabus or topic..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-10 pr-16 h-10 sm:h-11 rounded-xl text-sm bg-card border-border/80 shadow-xs w-full"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded"
          >
            Clear
          </button>
        )}
      </div>

      {/* Tabs Switcher - Fully Responsive Pill Bar */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full min-w-0">
        <div className="w-full rounded-2xl sm:rounded-full border border-blue-200/90 dark:border-blue-900/60 bg-white/95 dark:bg-card/95 p-1 sm:p-1.5 shadow-sm overflow-hidden">
          <div className="flex sm:grid sm:grid-cols-4 items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
            {([
              { key: "free",    label: "Free",    icon: Gift,     count: counts.free },
              { key: "chapter", label: "Chapter", icon: BookOpen, count: counts.chapter },
              { key: "part",    label: "Part",    icon: Puzzle,   count: counts.part },
              { key: "full",    label: "Full",    icon: Trophy,   count: counts.full },
            ] as const).map(({ key, label, icon: Icon, count }) => {
              const isActive = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key as any)}
                  className={`shrink-0 sm:shrink min-w-[80px] sm:min-w-0 flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl sm:rounded-full transition-all duration-200 select-none ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/70 ring-1 ring-blue-400/50 dark:ring-blue-600 shadow-2xs font-bold text-blue-700 dark:text-blue-300"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 font-medium"
                  }`}
                >
                  {/* Left Circular Icon */}
                  <div
                    className={`grid h-6 w-6 sm:h-7 sm:w-7 shrink-0 place-items-center rounded-full transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400"
                    }`}
                  >
                    <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </div>

                  {/* Label */}
                  <span className="text-xs sm:text-sm tracking-tight whitespace-nowrap">{label}</span>

                  {/* Count Pill Badge */}
                  <span
                    className={`shrink-0 rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-bold transition-colors ${
                      isActive
                        ? "bg-blue-600/15 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 ring-1 ring-blue-400/30"
                        : "bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Category Hero Banner with Planner Action */}
        <div className={"mt-3 rounded-2xl border bg-gradient-to-r p-3.5 sm:p-4.5 transition-all duration-300 min-w-0 overflow-hidden " + activeConf.gradient}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card border shadow-xs">
                <ActiveIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display text-sm sm:text-base font-bold text-foreground truncate">{activeConf.title}</h2>
                  <span className={"rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border shrink-0 " + activeConf.badgeColor}>
                    {filtered.length} tests
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed hidden sm:block">
                  {activeConf.description}
                </p>
              </div>
            </div>

            {/* Planner Button in Category Banner */}
            {availablePlanners.length > 0 && (
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {availablePlanners.map((p) => (
                  <Button
                    key={p.id}
                    asChild
                    size="sm"
                    variant="outline"
                    className="rounded-xl bg-card/90 hover:bg-card border-primary/40 text-primary font-bold text-xs gap-1.5 shadow-xs cursor-pointer h-8 sm:h-9"
                    title={`Open ${p.title} Planner PDF`}
                  >
                    <a href={p.planner_pdf_url} target="_blank" rel="noopener noreferrer">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span>{availablePlanners.length === 1 ? "📅 View Planner (PDF)" : `📅 Planner: ${p.title.slice(0, 16)}…`}</span>
                      <ExternalLink className="h-3 w-3 opacity-60 ml-0.5" />
                    </a>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tab Contents */}
        {(["free", "chapter", "part", "full"] as const).map((k) => (
          <TabsContent
            key={k}
            value={k}
            className="mt-4 space-y-4 focus-visible:outline-none animate-in fade-in-50 slide-in-from-bottom-2 duration-300 min-w-0"
          >
            {/* Test Series & Planners Section */}
            {tabSeries.length > 0 && (
              <div className="rounded-2xl border bg-card/60 p-3.5 sm:p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-foreground">
                        {k === "free" ? "Test Series Schedules & Planners" : `${activeConf.title} · Planners`}
                      </h3>
                      <p className="text-[11px] text-muted-foreground hidden sm:block">
                        Download syllabus blueprints & chapter schedules for each test series.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-secondary text-foreground shrink-0 border">
                    {tabSeries.length} Series
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {tabSeries.map((s) => {
                    const isFreeSeries = s.plan_code === "free" || !s.plan_code;
                    const SubjIcon = subjectIcon(s.subject);
                    const hasPdf = Boolean(s.planner_pdf_url && typeof s.planner_pdf_url === "string" && s.planner_pdf_url.trim());

                    return (
                      <div
                        key={s.id}
                        className="group relative rounded-xl border border-border/80 bg-background/80 p-3 shadow-2xs hover:border-primary/50 transition-all flex flex-col justify-between gap-2.5"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <SubjIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-display font-bold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition-colors">
                              {s.title}
                            </h4>
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] sm:text-[11px] text-muted-foreground capitalize">
                              <span className="font-semibold text-primary">{s.subject}</span>
                              <span>·</span>
                              <span className="truncate">{isFreeSeries ? "Free Series" : `${s.kind} Syllabus`}</span>
                            </div>
                          </div>
                        </div>

                        {/* Planner Action */}
                        <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                          <span className={"inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase " + (
                            hasPdf ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800" : "bg-muted text-muted-foreground border border-border/60"
                          )}>
                            {hasPdf ? "PDF Ready" : "Schedule"}
                          </span>

                          {hasPdf ? (
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 rounded-lg text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 dark:hover:bg-purple-900 border-purple-300 dark:border-purple-800 shadow-2xs gap-1 cursor-pointer"
                              title={`Download ${s.title} Planner PDF`}
                            >
                              <a href={s.planner_pdf_url} target="_blank" rel="noopener noreferrer">
                                <FileText className="h-3 w-3" /> Planner PDF ↗
                              </a>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setPlannerModalSeries(s)}
                              className="h-7 px-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
                            >
                              <FileText className="h-3 w-3" /> View Planner
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tests Listing */}
            {dataLoading ? (
              <TestListSkeleton count={4} />
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 sm:p-10 text-center animate-in fade-in-50 duration-200">
                <div className="relative mx-auto grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <ListChecks className="h-6 w-6 animate-pulse" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                  </span>
                </div>
                <h3 className="mt-4 font-display font-bold text-base text-foreground">No tests found</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  {q ? (`No tests matched "${q}". Try clearing your search term.`) : (`No ${activeConf.title.toLowerCase()} added yet. Switch to another tab or check back soon.`)}
                </p>
                {q ? (
                  <Button variant="outline" size="sm" onClick={() => setQ("")} className="mt-4 rounded-xl text-xs cursor-pointer">
                    Clear Search
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm" className="mt-4 rounded-xl text-xs cursor-pointer">
                    <Link to="/app/tests" search={{ tab: "part" }}>View Part Syllabus Tests</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-3 min-w-0">
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
                      style={{ animationDelay: `${index * 35}ms` }}
                      className={"group relative rounded-2xl border bg-card p-3.5 sm:p-5 transition-all duration-200 hover:shadow-md animate-in fade-in-50 slide-in-from-bottom-2 fill-mode-both min-w-0 overflow-hidden " + (
                        isFreeTest
                          ? "border-emerald-500/30 hover:border-emerald-500/60"
                          : unlocked
                          ? "hover:border-primary/40"
                          : "opacity-90"
                      )}
                    >
                      {/* Top Row: Icon + Info + Badge */}
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Subject Icon */}
                        <div className={"grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-xl " + (
                          isFreeTest
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : unlocked
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary text-muted-foreground"
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>

                        {/* Main Content */}
                        <div className="min-w-0 flex-1">
                          {/* Title row */}
                          <div className="flex items-start justify-between gap-2 min-w-0">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-display text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors leading-snug break-words">
                                {t.title}
                              </h3>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                                <span className="font-medium text-foreground/70 truncate max-w-[140px] sm:max-w-none">{t.test_series?.title ?? "NEET Test Series"}</span>
                                <span>·</span>
                                <span className="capitalize font-semibold text-primary shrink-0">{t.test_series?.subject ?? "Mixed"}</span>
                                {t.test_series?.planner_pdf_url ? (
                                  <>
                                    <span>·</span>
                                    <a
                                      href={t.test_series.planner_pdf_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 bg-purple-100 dark:bg-purple-950/80 px-2 py-0.5 rounded-md border border-purple-300 dark:border-purple-800 transition-colors shadow-2xs cursor-pointer"
                                      title="Open Series Planner / Schedule PDF"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <FileText className="h-3 w-3" /> Planner PDF ↗
                                    </a>
                                  </>
                                ) : (
                                  <>
                                    <span>·</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (t.test_series) setPlannerModalSeries(t.test_series);
                                      }}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted px-1.5 py-0.5 rounded-md border border-border/60 transition-colors cursor-pointer"
                                      title="View Planner Information"
                                    >
                                      <FileText className="h-3 w-3" /> Planner
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Status badge */}
                            <span className={"shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider " + (
                              isFreeTest
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                                : !unlocked
                                ? "bg-muted text-muted-foreground border border-border"
                                : done
                                ? "bg-success/15 text-success border border-success/30"
                                : "bg-primary/10 text-primary border border-primary/20"
                            )}>
                              {isFreeTest ? "Free" : !unlocked ? "Locked" : done ? "Done" : "Ready"}
                            </span>
                          </div>

                          {/* Meta pills */}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 font-medium shrink-0">
                              <ListChecks className="h-3 w-3 text-primary" /> {t.total_questions}Q
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 font-medium shrink-0">
                              <Clock className="h-3 w-3 text-primary" /> {t.duration_minutes}m
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 font-medium shrink-0">
                              <Trophy className="h-3 w-3 text-primary" /> {totalMarks} marks
                            </span>
                            {t.opens_at && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 font-medium shrink-0">
                                <Calendar className="h-3 w-3 text-primary" /> {new Date(t.opens_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>

                          {/* Syllabus */}
                          {t.syllabus && (
                            <div className="mt-2 flex items-start gap-2 rounded-xl bg-muted/40 p-2 text-xs text-foreground/90 border border-border/60">
                              <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                              <div className="min-w-0 leading-relaxed">
                                <span className="font-bold text-foreground mr-1">Syllabus:</span>
                                <span className="text-muted-foreground">{t.syllabus}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom CTA Button */}
                      <div className="mt-3 pt-3 border-t border-border/60">
                        {unlocked ? (
                          <Button
                            asChild
                            size="sm"
                            className={"w-full h-10 font-bold rounded-xl shadow-xs " + (
                              isFreeTest
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-primary hover:bg-primary/90 text-primary-foreground"
                            )}
                          >
                            <Link to="/app/tests/$testId" params={{ testId: t.id }}>
                              {done ? (
                                <><CheckCircle2 className="mr-1.5 h-4 w-4" /> Reattempt Test</>
                              ) : (
                                <><Play className="mr-1.5 h-4 w-4 fill-current" /> Start Test</>
                              )}
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild variant="secondary" size="sm" className="w-full h-10 font-bold rounded-xl" disabled={entLoading}>
                            <Link to="/app/pricing">
                              <Lock className="mr-1.5 h-4 w-4 text-muted-foreground" /> Unlock to Access
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Planner Info / Download Dialog */}
      <Dialog open={!!plannerModalSeries} onOpenChange={(open) => { if (!open) setPlannerModalSeries(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {plannerModalSeries?.title ?? "Test Series Planner"}
            </DialogTitle>
            <DialogDescription>
              Official schedule & chapter-wise syllabus blueprint for this test series.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <div className="rounded-2xl border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Category</span>
                <span className="font-semibold capitalize text-foreground">{plannerModalSeries?.kind} Syllabus</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Subject</span>
                <span className="font-semibold capitalize text-foreground">{plannerModalSeries?.subject}</span>
              </div>
              {plannerModalSeries?.description && (
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  {plannerModalSeries.description}
                </div>
              )}
            </div>

            {plannerModalSeries?.planner_pdf_url ? (
              <div className="space-y-2.5">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Study planner PDF is available for download and online view.
                </p>
                <div className="flex gap-2">
                  <Button asChild className="flex-1 font-bold rounded-xl gap-1.5 cursor-pointer">
                    <a href={plannerModalSeries.planner_pdf_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" /> Open PDF in New Tab
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="font-bold rounded-xl gap-1.5 cursor-pointer">
                    <a href={plannerModalSeries.planner_pdf_url} download target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" /> Download
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/40 dark:border-amber-900/60 p-4 text-center space-y-2">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                  <Clock className="h-5 w-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">Schedule Uploading Soon</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The study planner and test schedule PDF for <b>{plannerModalSeries?.title}</b> is currently being prepared and will be uploaded shortly by the instructor.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPlannerModalSeries(null)} className="cursor-pointer">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
