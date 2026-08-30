import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateAiAnalysis } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  TrendingUp,
  ArrowLeft,
  Loader2,
  Download,
  PlayCircle,
  Sparkles,
  BookOpen,
  Clock,
  Target,
  Calendar,
  LayoutGrid,
  Filter,
  ChevronDown,
  ChevronUp,
  Search,
  RotateCcw,
  Check,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { ExamImage } from "@/components/common/exam-image";
import {
  extractSelectedOption,
  getOptionText,
  hasAttemptedAnswer,
  isOptionSelected,
  normalizeCorrectOption,
  normalizeOptionKey,
  normalizeQuestionOptions,
} from "@/lib/exam-options";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/result/$attemptId")({
  head: () => ({ meta: [{ title: "Diagnostic Result & Test Analysis - Testum" }] }),
  component: Result,
});

type FilterStatus = "all" | "wrong" | "correct" | "unattempted";
type ActiveTab = "review" | "diagnostics" | "ai_plan";

function Result() {
  const { attemptId } = Route.useParams();
  const runAi = useServerFn(generateAiAnalysis);
  const [attempt, setAttempt] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ step: string; percent: number } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [review, setReview] = useState<any[]>([]);

  // Navigation & Filter state
  const [activeTab, setActiveTab] = useState<ActiveTab>("review");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showPalette, setShowPalette] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data: att } = await supabase
        .from("attempts")
        .select(
          "id, score, correct_count, wrong_count, unattempted_count, time_spent_seconds, submitted_at, tests(id, title, total_questions, marks_correct, marks_wrong, duration_minutes)",
        )
        .eq("id", attemptId)
        .maybeSingle();
      setAttempt(att);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name, student_class")
          .eq("user_id", user.id)
          .maybeSingle();
        setProfile(p);
      }

      const { data: an } = await supabase
        .from("analysis")
        .select("*")
        .eq("attempt_id", attemptId)
        .maybeSingle();
      setAnalysis(an);

      // Fetch all answers for this attempt directly
      const { data: rows } = await supabase
        .from("answers")
        .select("question_id, is_correct, selected_option, status, time_spent_seconds")
        .eq("attempt_id", attemptId);

      // Fetch all questions for this test
      let allQRows: any[] = [];
      if (att?.tests?.id) {
        const { data: allQ } = await supabase
          .from("questions")
          .select(
            "id, order_index, subject, chapter, question_text, question_image_url, option_type, options, correct_option, solution_text, solution_image_url, solution_video_url",
          )
          .eq("test_id", att.tests.id)
          .order("order_index", { ascending: true });
        allQRows = allQ ?? [];
      }

      // Build answer lookup by question id
      const answerMap = new Map<string, any>();
      for (const r of rows ?? []) {
        if (r.question_id) answerMap.set(r.question_id, r);
      }

      // Merge & normalize
      const merged = allQRows.map((q: any) => {
        const ans = answerMap.get(q.id);
        const selected = extractSelectedOption(ans);
        const attempted = Boolean(selected) || hasAttemptedAnswer(ans);
        const correct = normalizeCorrectOption(q.correct_option);

        let isCorrect: boolean | null = null;
        if (attempted && selected && correct) {
          isCorrect = selected === correct;
        } else if (ans?.is_correct === true || ans?.is_correct === false) {
          isCorrect = Boolean(ans.is_correct);
        }

        const hasAttempted = attempted || ans?.is_correct === true || ans?.is_correct === false;

        return {
          is_correct: isCorrect,
          selected_option: selected,
          selected_option_lost: hasAttempted && !selected,
          correct_option: correct,
          has_attempted: hasAttempted,
          time_spent_seconds: ans?.time_spent_seconds ?? 0,
          questions: {
            ...q,
            options: normalizeQuestionOptions(q.options),
            correct_option: correct ?? q.correct_option,
          },
        };
      });

      const sortedRows = merged
        .filter((r: any) => r.questions)
        .sort(
          (a: any, b: any) => (a.questions?.order_index ?? 0) - (b.questions?.order_index ?? 0),
        );
      setReview(sortedRows);

      // Auto-trigger AI analysis if not yet available
      if (!an && att) {
        setAiBusy(true);
        try {
          const res = await runAi({ data: { attemptId } });
          if (res?.analysis) {
            setAnalysis(res.analysis);
          }
        } catch (e) {
          console.warn("AI analysis auto-run note:", e);
        } finally {
          setAiBusy(false);
        }
      }
    } catch (err) {
      console.error("Error loading result:", err);
    }
  };

  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [attemptId]);

  if (!attempt) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
          <p className="font-display font-bold text-foreground text-base">
            Loading result diagnostics...
          </p>
          <p className="text-xs text-muted-foreground">
            Analyzing scores, solutions, and AI insights...
          </p>
        </div>
      </div>
    );
  }

  const totalQuestions = attempt?.tests?.total_questions ?? review.length ?? 180;
  const marksPerCorrect = attempt?.tests?.marks_correct ?? 4;
  const marksPerWrong = attempt?.tests?.marks_wrong ?? -1;
  const totalMax = totalQuestions * marksPerCorrect;

  // Derived counts for 100% calculation accuracy
  const derivedCorrect = review.filter((r: any) => r.is_correct === true).length;
  const derivedWrong = review.filter((r: any) => r.has_attempted && r.is_correct === false).length;
  const derivedUnattempted = review.filter((r: any) => !r.has_attempted).length;
  const storedAttempted = (attempt?.correct_count ?? 0) + (attempt?.wrong_count ?? 0);
  const derivedAttempted = derivedCorrect + derivedWrong;

  const hasDerived =
    review.length > 0 &&
    (derivedAttempted > storedAttempted ||
      ((attempt?.correct_count === 0 || attempt?.correct_count === undefined) &&
        (attempt?.wrong_count === 0 || attempt?.wrong_count === undefined) &&
        derivedAttempted > 0));

  const finalCorrect = hasDerived ? derivedCorrect : (attempt?.correct_count ?? derivedCorrect);
  const finalWrong = hasDerived ? derivedWrong : (attempt?.wrong_count ?? derivedWrong);
  const finalUnattempted = hasDerived
    ? derivedUnattempted
    : (attempt?.unattempted_count ?? derivedUnattempted);
  const finalScore = hasDerived
    ? finalCorrect * marksPerCorrect + finalWrong * marksPerWrong
    : Number(attempt?.score ?? 0);

  const attempted = finalCorrect + finalWrong;
  const total = attempted + finalUnattempted;
  const accuracy = attempted ? Math.round((finalCorrect / attempted) * 100) : 0;
  const percent = totalMax ? Math.round((finalScore / totalMax) * 100) : 0;
  const subjects = analysis?.subject_breakdown?.subjects ?? {};
  const chapters = analysis?.subject_breakdown?.chapters ?? {};

  // Extract available subject list
  const subjectList = Array.from(
    new Set(review.map((r: any) => r.questions?.subject).filter(Boolean)),
  );

  // Filtered review list
  const filteredReview = review.filter((r: any) => {
    // Subject filter
    if (subjectFilter !== "all" && r.questions?.subject !== subjectFilter) {
      return false;
    }
    // Status filter
    if (statusFilter === "wrong") {
      if (!r.has_attempted || r.is_correct !== false) return false;
    } else if (statusFilter === "correct") {
      if (r.is_correct !== true) return false;
    } else if (statusFilter === "unattempted") {
      if (r.has_attempted) return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const qText = (r.questions?.question_text || "").toLowerCase();
      const chapter = (r.questions?.chapter || "").toLowerCase();
      const s = searchQuery.toLowerCase();
      if (!qText.includes(s) && !chapter.includes(s)) return false;
    }
    return true;
  });

  const scrollToQuestion = (orderIndex: number) => {
    const el = document.getElementById(`review-q-${orderIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const downloadPdf = async () => {
    setPdfBusy(true);
    setPdfProgress({ step: "Starting PDF generation...", percent: 5 });
    try {
      const an = analysis;
      const { downloadResultPdf } = await import("@/lib/result-pdf");
      await downloadResultPdf(
        {
          studentName: profile?.full_name ?? "Testum Student",
          studentClass: profile?.student_class ?? null,
          testTitle: attempt?.tests?.title ?? "Mock Test",
          submittedAt: attempt?.submitted_at ?? new Date().toISOString(),
          score: finalScore,
          totalMax,
          correct: finalCorrect,
          wrong: finalWrong,
          unattempted: finalUnattempted,
          marksCorrect: marksPerCorrect,
          marksWrong: marksPerWrong,
          timeSpentSeconds: attempt?.time_spent_seconds ?? 0,
          durationMinutes: attempt?.tests?.duration_minutes ?? 180,
          subjects: an?.subject_breakdown?.subjects ?? {},
          chapters: an?.subject_breakdown?.chapters ?? {},
          aiSummary: an?.ai_summary ?? null,
          weakTopics: an?.weak_topics ?? null,
          strongTopics: an?.strong_topics ?? null,
          studyPlan: an?.study_plan ?? null,
          questions: review.map((r: any) => ({
            order_index: r.questions.order_index,
            subject: r.questions.subject,
            chapter: r.questions.chapter,
            question_text: r.questions.question_text,
            question_image_url: r.questions.question_image_url,
            option_type: r.questions.option_type,
            options: r.questions.options,
            correct_option:
              normalizeOptionKey(r.questions.correct_option) ?? r.questions.correct_option,
            selected_option: r.selected_option ?? null,
            is_correct: r.is_correct ?? null,
            time_spent_seconds: r.time_spent_seconds ?? 0,
            solution_text: r.questions.solution_text,
            solution_image_url: r.questions.solution_image_url,
            solution_video_url: r.questions.solution_video_url,
          })),
        },
        (step, percent) => {
          setPdfProgress({ step, percent });
        },
      );
      toast.success("Detailed report downloaded successfully");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate PDF");
    } finally {
      setPdfBusy(false);
      setPdfProgress(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button asChild variant="ghost" size="sm" className="rounded-xl font-semibold">
          <Link to="/app">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-xl font-semibold">
            <Link to="/app/tests">
              <RotateCcw className="mr-1.5 h-4 w-4 text-primary" /> Practice Another Test
            </Link>
          </Button>

          <Button
            onClick={downloadPdf}
            size="sm"
            className="bg-primary text-primary-foreground font-bold shadow-sm rounded-xl px-4"
            disabled={pdfBusy}
          >
            {pdfBusy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            Download PDF Report
          </Button>
        </div>
      </div>

      {/* PDF Generation Progress Notification */}
      {pdfProgress && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-sm animate-in fade-in space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-primary">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {pdfProgress.step}
            </span>
            <span>{pdfProgress.percent}%</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${pdfProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Hero Score Banner */}
      <div className="rounded-3xl border bg-hero p-6 sm:p-8 text-primary-foreground shadow-elegant relative overflow-hidden">
        {/* Background decorative circles */}
        <div className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-primary-foreground/15 pb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider opacity-85">
              Official Diagnostic Report · Submitted{" "}
              {attempt?.submitted_at
                ? new Date(attempt.submitted_at).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Recently"}
            </div>
            <h1 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">
              {attempt?.tests?.title ?? "NEET Test"}
            </h1>
            <p className="text-xs opacity-90 mt-0.5">
              Candidate: <strong>{profile?.full_name ?? "Testum Student"}</strong>
              {profile?.student_class ? " · " + profile.student_class : ""}
            </p>
          </div>

          {/* Performance Badge */}
          <div className="rounded-2xl bg-white/15 backdrop-blur-md px-4 py-2 self-start sm:self-auto border border-white/20">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Verdict</div>
            <div className="font-display text-sm font-black">
              {accuracy >= 80
                ? "🌟 Outstanding Score"
                : accuracy >= 60
                  ? "🎯 Strong Effort"
                  : "📈 Targeted Focus Needed"}
            </div>
          </div>
        </div>

        {/* 4 Core Diagnostic Metrics */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-primary-foreground/10 p-4 backdrop-blur-sm border border-white/10">
            <div className="text-xs opacity-85 font-medium">Final Score</div>
            <div className="font-display text-3xl font-black mt-0.5">
              {Math.round(finalScore)}
              <span className="text-base font-semibold opacity-75">/{totalMax}</span>
            </div>
            <div className="mt-1 text-xs opacity-85">{percent}% of maximum</div>
          </div>
          <div className="rounded-2xl bg-primary-foreground/10 p-4 backdrop-blur-sm border border-white/10">
            <div className="text-xs opacity-85 font-medium">Accuracy</div>
            <div className="font-display text-3xl font-black mt-0.5">{accuracy}%</div>
            <div className="mt-1 text-xs opacity-85">
              {finalCorrect} correct of {attempted}
            </div>
          </div>
          <div className="rounded-2xl bg-primary-foreground/10 p-4 backdrop-blur-sm border border-white/10">
            <div className="text-xs opacity-85 font-medium">Time Utilized</div>
            <div className="font-display text-3xl font-black mt-0.5">
              {Math.floor((attempt.time_spent_seconds || 0) / 60)}
              <span className="text-base font-semibold opacity-75">m</span>
            </div>
            <div className="mt-1 text-xs opacity-85">
              of {attempt.tests?.duration_minutes}m duration
            </div>
          </div>
          <div className="rounded-2xl bg-primary-foreground/10 p-4 backdrop-blur-sm border border-white/10">
            <div className="text-xs opacity-85 font-medium">Attempt Ratio</div>
            <div className="font-display text-3xl font-black mt-0.5">
              {attempted}
              <span className="text-base font-semibold opacity-75">/{total}</span>
            </div>
            <div className="mt-1 text-xs opacity-85">{finalUnattempted} skipped</div>
          </div>
        </div>
      </div>

      {/* Answer counts summary cards (Clickable quick filters) */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            Icon: CheckCircle2,
            l: "Correct (+4)",
            v: finalCorrect,
            pts: "+" + finalCorrect * marksPerCorrect + " Marks",
            status: "correct" as FilterStatus,
            c: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
          },
          {
            Icon: XCircle,
            l: "Incorrect (-1)",
            v: finalWrong,
            pts:
              (finalWrong * marksPerWrong < 0 ? "" : "+") + finalWrong * marksPerWrong + " Marks",
            status: "wrong" as FilterStatus,
            c: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
          },
          {
            Icon: MinusCircle,
            l: "Skipped (0)",
            v: finalUnattempted,
            pts: "0 Marks",
            status: "unattempted" as FilterStatus,
            c: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800",
          },
        ].map(({ Icon, l, v, pts, status, c }) => (
          <button
            key={l}
            type="button"
            onClick={() => {
              setActiveTab("review");
              setStatusFilter(statusFilter === status ? "all" : status);
            }}
            className={cn(
              "rounded-2xl border p-4 flex items-center justify-between text-left transition-all hover:scale-[1.01] cursor-pointer",
              c,
              statusFilter === status && "ring-2 ring-primary ring-offset-2",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-background shadow-xs">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wide">{l}</div>
                <div className="font-display text-2xl font-black">{v}</div>
              </div>
            </div>
            <div className="text-xs font-semibold">{pts}</div>
          </button>
        ))}
      </div>

      {/* Structured Diagnostic Tabs */}
      <div className="flex items-center gap-2 border-b pb-2">
        <button
          onClick={() => setActiveTab("review")}
          className={cn(
            "rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2",
            activeTab === "review"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
        >
          <Target className="h-4 w-4" />
          <span>Question Review & Solutions ({review.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("diagnostics")}
          className={cn(
            "rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2",
            activeTab === "diagnostics"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
        >
          <TrendingUp className="h-4 w-4" />
          <span>Subject Diagnostics</span>
        </button>

        <button
          onClick={() => setActiveTab("ai_plan")}
          className={cn(
            "rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2",
            activeTab === "ai_plan"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
        >
          <Sparkles className="h-4 w-4" />
          <span>AI Mentor & 7-Day Plan</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: QUESTION REVIEW & DETAILED SOLUTIONS */}
      {/* ========================================================================= */}
      {activeTab === "review" && (
        <div className="space-y-6">
          {/* Filter Bar & Quick Tools */}
          <div className="rounded-3xl border bg-card p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" /> Question-by-Question Review
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verify your selections against the official answer keys and step-by-step
                  solutions.
                </p>
              </div>

              {/* Toggle Question Navigator Matrix */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPalette(!showPalette)}
                className="rounded-xl font-semibold gap-1.5 self-start sm:self-auto"
              >
                <LayoutGrid className="h-4 w-4 text-primary" />
                <span>Question Palette</span>
                {showPalette ? (
                  <ChevronUp className="h-4 w-4 ml-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 ml-1" />
                )}
              </Button>
            </div>

            {/* Collapsible Question Palette Navigator */}
            {showPalette && (
              <div className="rounded-2xl border bg-secondary/30 p-4 space-y-3 animate-in fade-in-50 duration-200">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Click any question number to jump directly:</span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1 text-emerald-600 font-bold">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />{" "}
                      Correct
                    </span>
                    <span className="flex items-center gap-1 text-rose-600 font-bold">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" />{" "}
                      Incorrect
                    </span>
                    <span className="flex items-center gap-1 text-slate-500 font-bold">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-400 inline-block" />{" "}
                      Skipped
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-15 gap-1.5 max-h-48 overflow-y-auto p-1">
                  {review.map((item) => {
                    const q = item.questions;
                    const isCorr = item.is_correct === true;
                    const isWrn = item.has_attempted && item.is_correct === false;

                    let colorCls =
                      "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300";
                    if (isCorr) {
                      colorCls =
                        "bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-2xs";
                    } else if (isWrn) {
                      colorCls = "bg-rose-600 text-white font-bold hover:bg-rose-700 shadow-2xs";
                    }

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => scrollToQuestion(q.order_index)}
                        className={cn(
                          "h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center border cursor-pointer",
                          colorCls,
                        )}
                        title={`Q${q.order_index} (${q.subject})`}
                      >
                        {q.order_index}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter Pills & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 border-t">
              {/* Status Filters */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-muted-foreground mr-1 flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5" /> Filter:
                </span>
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                    statusFilter === "all"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-background text-muted-foreground hover:text-foreground border",
                  )}
                >
                  All ({review.length})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("wrong")}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                    statusFilter === "wrong"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900",
                  )}
                >
                  <span>✗ Mistakes</span>
                  <span className="rounded-full bg-rose-200/50 dark:bg-rose-800 px-1.5 text-[10px]">
                    {derivedWrong}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("correct")}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                    statusFilter === "correct"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900",
                  )}
                >
                  <span>✓ Correct</span>
                  <span className="rounded-full bg-emerald-200/50 dark:bg-emerald-800 px-1.5 text-[10px]">
                    {derivedCorrect}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("unattempted")}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                    statusFilter === "unattempted"
                      ? "bg-slate-700 text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
                  )}
                >
                  <span>— Skipped</span>
                  <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-1.5 text-[10px]">
                    {derivedUnattempted}
                  </span>
                </button>
              </div>

              {/* Section Filters & Search */}
              <div className="flex items-center gap-2 flex-wrap">
                {subjectList.length > 1 && (
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setSubjectFilter("all")}
                      className={cn(
                        "rounded-xl px-2.5 py-1 text-xs font-semibold transition-all shrink-0 cursor-pointer",
                        subjectFilter === "all"
                          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                          : "bg-background text-muted-foreground hover:text-foreground border",
                      )}
                    >
                      All Sections
                    </button>
                    {subjectList.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSubjectFilter(s)}
                        className={cn(
                          "rounded-xl px-2.5 py-1 text-xs font-semibold capitalize transition-all shrink-0 cursor-pointer",
                          subjectFilter === s
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                            : "bg-background text-muted-foreground hover:text-foreground border",
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {/* Keyword Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search questions..."
                    className="h-8 pl-8 pr-3 rounded-xl border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-36 sm:w-44"
                  />
                </div>
              </div>
            </div>

            {/* Filter count notice */}
            {filteredReview.length !== review.length && (
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                <span>
                  Showing <strong>{filteredReview.length}</strong> of {review.length} questions
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setSubjectFilter("all");
                    setSearchQuery("");
                  }}
                  className="text-primary font-semibold hover:underline"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>

          {/* Question List */}
          <div className="space-y-6">
            {filteredReview.length === 0 ? (
              <div className="rounded-3xl border border-dashed p-12 text-center text-sm text-muted-foreground bg-card">
                No questions found matching your filter selection.
              </div>
            ) : (
              filteredReview.map((item, idx) => {
                const q = item.questions;
                const correctOption =
                  item.correct_option ?? normalizeCorrectOption(q.correct_option);
                const isCorrect = item.is_correct === true;
                const isWrong = item.has_attempted && item.is_correct === false;
                const isSkipped = !item.has_attempted;
                const timeM = Math.floor((item.time_spent_seconds || 0) / 60);
                const timeS = (item.time_spent_seconds || 0) % 60;

                const opts = normalizeQuestionOptions(q.options);

                return (
                  <div
                    key={q.id || idx}
                    id={`review-q-${q.order_index}`}
                    className={cn(
                      "rounded-3xl border transition-all duration-200 overflow-hidden bg-card shadow-xs",
                      isCorrect
                        ? "border-emerald-300 dark:border-emerald-900/60"
                        : isWrong
                          ? "border-rose-300 dark:border-rose-900/60"
                          : "border-border",
                    )}
                  >
                    {/* Question Header */}
                    <div
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b",
                        isCorrect
                          ? "bg-emerald-50/60 dark:bg-emerald-950/20"
                          : isWrong
                            ? "bg-rose-50/60 dark:bg-rose-950/20"
                            : "bg-muted/40",
                      )}
                    >
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-background text-xs font-bold shadow-xs border text-foreground">
                          Q{q.order_index}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-primary">
                          {q.subject}
                          {q.chapter ? ` · ${q.chapter}` : ""}
                        </span>
                        {item.time_spent_seconds > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium bg-background px-2.5 py-0.5 rounded-lg border">
                            <Clock className="h-3 w-3 text-muted-foreground" />{" "}
                            {timeM > 0 ? `${timeM}m ${timeS}s` : `${timeS}s`}
                          </span>
                        )}
                      </div>

                      {/* Marks Verdict Badge */}
                      <div>
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 px-3 py-1 text-xs font-bold border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Correct (+{marksPerCorrect} Marks)
                          </span>
                        ) : isWrong ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 px-3 py-1 text-xs font-bold border border-rose-300 dark:border-rose-800">
                            <XCircle className="h-3.5 w-3.5 text-rose-600" />
                            Incorrect ({marksPerWrong} Marks)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-3 py-1 text-xs font-bold border border-slate-300 dark:border-slate-700">
                            <MinusCircle className="h-3.5 w-3.5 text-slate-500" />
                            Not Attempted (0 Marks)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Question Content Body */}
                    <div className="p-4 sm:p-6 space-y-5">
                      {/* Question Text */}
                      {q.question_text && (
                        <p className="text-sm sm:text-base font-medium text-foreground leading-relaxed whitespace-pre-wrap select-text">
                          {q.question_text}
                        </p>
                      )}

                      {/* Question Image with Zoom Lightbox */}
                      {q.question_image_url && (
                        <div className="max-w-2xl">
                          <ExamImage
                            src={q.question_image_url}
                            alt={`Question ${q.order_index}`}
                            onZoom={(url) => setZoomImage(url)}
                            maxHeightClass="max-h-[360px] sm:max-h-[440px]"
                          />
                        </div>
                      )}

                      {/* Options Grid (A, B, C, D) with Explicit Highlight */}
                      {opts.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2 pt-1">
                          {opts.map((op) => {
                            const isCorrectOpt = isOptionSelected(correctOption, op.key);
                            const isStudentOpt = isOptionSelected(item.selected_option, op.key);
                            const isWrongStudentOpt = isStudentOpt && !isCorrectOpt;

                            return (
                              <div
                                key={op.key}
                                className={cn(
                                  "flex items-start gap-3 rounded-2xl border p-3.5 sm:p-4 text-left transition-all duration-150",
                                  isCorrectOpt && isStudentOpt
                                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 ring-2 ring-emerald-500/30 font-semibold"
                                    : isCorrectOpt
                                      ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-500/30 font-semibold"
                                      : isWrongStudentOpt
                                        ? "border-rose-500 bg-rose-50 dark:bg-rose-950/40 ring-2 ring-rose-500/30"
                                        : "border-border bg-background",
                                )}
                              >
                                <span
                                  className={cn(
                                    "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-bold border transition-colors",
                                    isCorrectOpt
                                      ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                                      : isWrongStudentOpt
                                        ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                                        : "bg-secondary text-foreground",
                                  )}
                                >
                                  {op.key}
                                </span>

                                <div className="min-w-0 flex-1 pt-0.5 text-xs sm:text-sm">
                                  {op.image_url && (
                                    <ExamImage
                                      src={op.image_url}
                                      alt={`Option ${op.key}`}
                                      maxHeightClass="max-h-28 sm:max-h-36"
                                      showZoomButton={false}
                                      containerClassName="p-1 mb-1.5 border-0 bg-transparent"
                                    />
                                  )}
                                  <span>{op.text ?? getOptionText(q.options, op.key)}</span>

                                  {/* Explicit Badges */}
                                  {isCorrectOpt && isStudentOpt && (
                                    <span className="block mt-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                      ✓ Your Selection (Correct)
                                    </span>
                                  )}
                                  {isCorrectOpt && !isStudentOpt && (
                                    <span className="block mt-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                      ✓ Correct Option
                                    </span>
                                  )}
                                  {isWrongStudentOpt && (
                                    <span className="block mt-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                      ✗ Your Selected Answer (Incorrect)
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Response Verdict Strip */}
                      <div
                        className={cn(
                          "rounded-2xl border p-4 sm:p-5 space-y-3",
                          isCorrect
                            ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/10"
                            : isWrong
                              ? "border-rose-200 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/10"
                              : "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30",
                        )}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Student Answer Box */}
                          <div
                            className={cn(
                              "rounded-xl border p-3",
                              item.selected_option && isWrong
                                ? "border-rose-200 bg-rose-100/30 dark:border-rose-900/40 dark:bg-rose-950/20"
                                : item.selected_option
                                  ? "border-emerald-200 bg-emerald-100/30 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                                  : item.selected_option_lost
                                    ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10"
                                    : "border-slate-200 bg-slate-100/30 dark:border-slate-800 dark:bg-slate-900/20",
                            )}
                          >
                            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              Your Selected Choice
                            </div>
                            <div className="text-base font-bold mt-0.5">
                              {item.selected_option ? (
                                <span
                                  className={
                                    isWrong
                                      ? "text-rose-600 dark:text-rose-400"
                                      : "text-emerald-600 dark:text-emerald-400"
                                  }
                                >
                                  Option ({item.selected_option})
                                </span>
                              ) : item.selected_option_lost ? (
                                <span className="text-amber-600 dark:text-amber-400 font-medium text-sm">
                                  Answered (option not recorded)
                                </span>
                              ) : (
                                <span className="text-slate-500 font-medium">Skipped</span>
                              )}
                            </div>
                          </div>

                          {/* Correct Answer Box */}
                          <div className="rounded-xl border border-emerald-200 bg-emerald-100/30 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-3">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                              Correct Answer
                            </div>
                            <div className="text-base font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                              Option ({correctOption ?? "-"})
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step-by-Step Solution & Video Explanation */}
                      {(q.solution_text || q.solution_image_url || q.solution_video_url) && (
                        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 space-y-3">
                          <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                            <BookOpen className="h-4 w-4" /> Step-by-Step Explanation & Solution
                          </div>

                          {q.solution_text && (
                            <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap select-text">
                              {q.solution_text}
                            </p>
                          )}

                          {q.solution_image_url && (
                            <div className="max-w-2xl pt-1">
                              <ExamImage
                                src={q.solution_image_url}
                                alt={`Solution ${q.order_index}`}
                                onZoom={(url) => setZoomImage(url)}
                                maxHeightClass="max-h-80"
                              />
                            </div>
                          )}

                          {q.solution_video_url && (
                            <div className="pt-1">
                              <a
                                href={q.solution_video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold hover:bg-primary/90 transition shadow-xs"
                              >
                                <PlayCircle className="h-4 w-4" /> Watch Video Solution Online
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SUBJECT & CHAPTER DIAGNOSTICS */}
      {/* ========================================================================= */}
      {activeTab === "diagnostics" && (
        <div className="space-y-6">
          {/* Subject-Wise Performance */}
          {Object.keys(subjects).length > 0 && (
            <div className="rounded-3xl border bg-card p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-bold">
                  Subject-Wise Performance Breakdown
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {Object.entries(subjects).map(([s, v]: any) => {
                  const att = v.correct + v.wrong;
                  const acc = att ? Math.round((v.correct / att) * 100) : 0;
                  return (
                    <div key={s} className="rounded-2xl border p-4 bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold capitalize text-foreground">
                          {s}
                        </span>
                        <span className="font-bold text-sm text-primary">{acc}% Accuracy</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            acc >= 75
                              ? "bg-emerald-500"
                              : acc >= 50
                                ? "bg-amber-500"
                                : "bg-rose-500",
                          )}
                          style={{ width: `${acc}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground pt-1">
                        <span className="text-emerald-600 font-semibold">{v.correct} Correct</span>
                        <span className="text-destructive font-semibold">{v.wrong} Wrong</span>
                        <span>{v.unattempted} Skipped</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chapter-Wise Summary Table */}
          {Object.keys(chapters).length > 0 && (
            <div className="rounded-3xl border bg-card p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-bold">Chapter-Wise Diagnostic Summary</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground border-b pb-2">
                    <tr>
                      <th className="pb-3 text-left">Chapter / Topic</th>
                      <th className="pb-3 text-right">Correct</th>
                      <th className="pb-3 text-right">Wrong</th>
                      <th className="pb-3 text-right">Skipped</th>
                      <th className="pb-3 text-right">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {Object.entries(chapters).map(([c, v]: any) => {
                      const att = v.correct + v.wrong;
                      const acc = att ? Math.round((v.correct / att) * 100) : 0;
                      return (
                        <tr key={c} className="hover:bg-muted/30">
                          <td className="py-3 font-medium text-foreground">{c}</td>
                          <td className="py-3 text-right font-semibold text-emerald-600">
                            +{v.correct}
                          </td>
                          <td className="py-3 text-right font-semibold text-rose-600">
                            -{v.wrong}
                          </td>
                          <td className="py-3 text-right text-muted-foreground">{v.unattempted}</td>
                          <td className="py-3 text-right font-bold text-foreground">{acc}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AI DIAGNOSTIC & STUDY PLAN */}
      {/* ========================================================================= */}
      {activeTab === "ai_plan" && (
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-display text-lg font-bold text-primary">
              <Sparkles className="h-5 w-5 text-primary" /> AI Diagnostic & Study Recommendations
            </div>
            {aiBusy && (
              <span className="flex items-center gap-1.5 text-xs text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing AI analysis...
              </span>
            )}
          </div>

          {analysis?.ai_summary ? (
            <div className="rounded-2xl bg-card border p-4 sm:p-5 text-sm text-foreground leading-relaxed space-y-1 shadow-2xs">
              <p className="font-bold text-primary text-xs uppercase tracking-wider">
                Mentor Evaluation:
              </p>
              <p>{analysis.ai_summary}</p>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Detailed performance diagnostic is ready.
            </div>
          )}

          {/* Strengths & Weaknesses */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-destructive flex items-center gap-1.5">
                <Target className="h-4 w-4" /> Focus Areas (Low Accuracy)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(analysis?.weak_topics ?? []).length > 0 ? (
                  analysis.weak_topics.map((t: string) => (
                    <span
                      key={t}
                      className="rounded-lg bg-destructive/10 text-destructive text-xs font-semibold px-2.5 py-1"
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No weak topics flagged</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> Mastered Concepts
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(analysis?.strong_topics ?? []).length > 0 ? (
                  analysis.strong_topics.map((t: string) => (
                    <span
                      key={t}
                      className="rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold px-2.5 py-1"
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Continue practice across all chapters
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 7-Day Targeted Plan */}
          {analysis?.study_plan && (
            <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3 shadow-2xs">
              <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> 7-Day Targeted Revision Schedule
              </div>
              <div className="space-y-2 text-xs sm:text-sm text-foreground leading-relaxed">
                {analysis.study_plan
                  .split("\n")
                  .filter(Boolean)
                  .map((line: string, i: number) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span>{line.replace(/^[•\s-]+/, "")}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image Lightbox Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in"
          onClick={() => setZoomImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] overflow-hidden rounded-3xl bg-card p-3 shadow-2xl border"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomImage}
              alt="Zoomed Question"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-2xl select-none"
            />
            <div className="mt-3 flex items-center justify-between pt-2 border-t text-xs">
              <span className="text-muted-foreground font-medium">Question Image Preview</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild className="h-8 rounded-xl text-xs">
                  <a href={zoomImage} target="_blank" rel="noopener noreferrer">
                    Open in New Tab
                  </a>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setZoomImage(null)}
                  className="h-8 rounded-xl text-xs font-semibold"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
