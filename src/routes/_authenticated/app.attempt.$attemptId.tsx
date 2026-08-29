import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Clock,
  LayoutGrid,
  Flag,
  CircleX,
  ChevronLeft,
  ChevronRight,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Maximize2,
  ZoomIn,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExamImage } from "@/components/common/exam-image";

export const Route = createFileRoute("/_authenticated/app/attempt/$attemptId")({
  head: () => ({ meta: [{ title: "CBT Exam Engine  -  Testum" }] }),
  component: Player,
});

type Option = { key: string; text?: string; image_url?: string };

type Q = {
  id: string;
  order_index: number;
  subject: string;
  chapter: string | null;
  question_image_url: string | null;
  question_text: string | null;
  option_type: "image" | "text";
  options: Option[];
  correct_option: string;
};

type AnswerStatus =
  | "not_visited"
  | "not_answered"
  | "answered"
  | "marked"
  | "answered_marked";

type A = {
  question_id: string;
  selected_option: string | null;
  status: AnswerStatus;
  time_spent_seconds: number;
};

function Player() {
  const { attemptId } = Route.useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, A>>({});
  
  // Current active global question index (0 to questions.length - 1)
  const [currentGlobalIdx, setCurrentGlobalIdx] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(`testum_attempt_${attemptId}_idx`);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  // Filter subject for the Question Palette: "all" or specific subject
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [remaining, setRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const questionStart = useRef<number>(Date.now());
  const answersRef = useRef<Record<string, A>>({});
  answersRef.current = answers;

  // 1. Initial Load & Restore
  useEffect(() => {
    let isMounted = true;

    async function loadAttempt() {
      try {
        const { data: att, error: attErr } = await supabase
          .from("attempts")
          .select("id, test_id, started_at, status, tests(id, title, duration_minutes, total_questions, marks_correct, marks_wrong)")
          .eq("id", attemptId)
          .maybeSingle();

        if (attErr || !att) {
          toast.error("Attempt not found");
          navigate({ to: "/app/tests" });
          return;
        }

        if (att.status === "submitted") {
          navigate({ to: "/app/result/$attemptId", params: { attemptId } });
          return;
        }

        if (!isMounted) return;
        setTest(att.tests);

        // Fetch questions
        const { data: qs } = await supabase
          .from("questions")
          .select("id, order_index, subject, chapter, question_image_url, question_text, option_type, options, correct_option")
          .eq("test_id", att.test_id)
          .order("order_index");

        const qList: Q[] = (qs as any) ?? [];
        if (isMounted) setQuestions(qList);

        // Fetch saved answers
        const { data: ans } = await supabase
          .from("answers")
          .select("question_id, selected_option, status, time_spent_seconds")
          .eq("attempt_id", attemptId);

        // Load local cache if available for instant restore
        let cachedAnswers: Record<string, A> = {};
        try {
          const raw = sessionStorage.getItem(`testum_attempt_${attemptId}_answers`);
          if (raw) cachedAnswers = JSON.parse(raw);
        } catch (e) {
          console.error("Cache read error:", e);
        }

        const map: Record<string, A> = { ...cachedAnswers };
        (ans ?? []).forEach((a: any) => {
          // Merge with DB data
          if (!map[a.question_id] || map[a.question_id].status === "not_visited") {
            map[a.question_id] = a as A;
          }
        });

        // Initialize any missing questions as not_visited
        qList.forEach((q) => {
          if (!map[q.id]) {
            map[q.id] = {
              question_id: q.id,
              selected_option: null,
              status: "not_visited",
              time_spent_seconds: 0,
            };
          }
        });

        if (isMounted) {
          setAnswers(map);
          answersRef.current = map;

          // Compute remaining time
          const durationSec = (att.tests?.duration_minutes ?? 180) * 60;
          const startedAtTime = new Date(att.started_at).getTime();
          const elapsedSec = Math.floor((Date.now() - startedAtTime) / 1000);
          const rem = Math.max(0, durationSec - elapsedSec);
          setRemaining(rem);

          // Restore or validate current index
          let targetIdx = currentGlobalIdx;
          try {
            const saved = sessionStorage.getItem(`testum_attempt_${attemptId}_idx`);
            if (saved !== null) {
              const parsed = parseInt(saved, 10);
              if (parsed >= 0 && parsed < qList.length) {
                targetIdx = parsed;
              }
            }
          } catch {}

          if (targetIdx >= qList.length) targetIdx = 0;
          setCurrentGlobalIdx(targetIdx);

          // Mark the starting question as visited
          if (qList[targetIdx]) {
            const startQId = qList[targetIdx].id;
            const existing = map[startQId];
            if (!existing || existing.status === "not_visited") {
              const updated: A = {
                question_id: startQId,
                selected_option: existing?.selected_option ?? null,
                status: "not_answered",
                time_spent_seconds: existing?.time_spent_seconds ?? 0,
              };
              map[startQId] = updated;
              setAnswers({ ...map });
              supabase
                .from("answers")
                .update({ status: "not_answered" })
                .eq("attempt_id", attemptId)
                .eq("question_id", startQId)
                .then(() => {});
            }
          }

          setLoading(false);
          questionStart.current = Date.now();
        }
      } catch (err) {
        console.error("Failed to load attempt:", err);
      }
    }

    loadAttempt();

    return () => {
      isMounted = false;
    };
  }, [attemptId, navigate]);

  // Persist current question index across screen switches / mode changes
  useEffect(() => {
    try {
      sessionStorage.setItem(
        `testum_attempt_${attemptId}_idx`,
        currentGlobalIdx.toString()
      );
    } catch {}
  }, [attemptId, currentGlobalIdx]);

  // Timer Countdown
  useEffect(() => {
    if (loading || remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [loading, remaining]);

  // Auto-submit when time expires
  useEffect(() => {
    if (!loading && remaining === 0) {
      submitTest(true);
    }
  }, [remaining, loading]);

  // Background session keep-alive: prevents token expiration during long (1-3 hr) exams
  useEffect(() => {
    const keepAliveInterval = setInterval(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          // If token has less than 20 minutes left, refresh it silently in background
          const expiresAt = data.session.expires_at ? data.session.expires_at * 1000 : 0;
          if (!expiresAt || expiresAt < Date.now() + 1000 * 60 * 20) {
            await supabase.auth.refreshSession();
          }
        }
      } catch (err) {
        console.warn("[session-keepalive] Silent refresh error:", err);
      }
    }, 1000 * 60 * 5); // check every 5 minutes

    return () => clearInterval(keepAliveInterval);
  }, []);

  // Subject list extracted from questions
  const subjects = useMemo(() => {
    return Array.from(new Set(questions.map((q) => q.subject))).filter(Boolean);
  }, [questions]);

  // Current active question
  const currentQuestion = questions[currentGlobalIdx];

  // Helper to persist answer updates both in state, sessionStorage cache & DB
  const persistAnswer = useCallback(
    (qId: string, patch: Partial<A>) => {
      setAnswers((prev) => {
        const currentA = prev[qId] ?? {
          question_id: qId,
          selected_option: null,
          status: "not_visited" as const,
          time_spent_seconds: 0,
        };
        const nextA: A = { ...currentA, ...patch };
        const nextMap = { ...prev, [qId]: nextA };
        answersRef.current = nextMap;

        // Write to local session cache
        try {
          sessionStorage.setItem(
            `testum_attempt_${attemptId}_answers`,
            JSON.stringify(nextMap)
          );
        } catch {}

        // Background update to Supabase
        supabase
          .from("answers")
          .upsert(
            {
              attempt_id: attemptId,
              question_id: qId,
              selected_option: nextA.selected_option,
              status: nextA.status,
              time_spent_seconds: nextA.time_spent_seconds,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "attempt_id,question_id" }
          )
          .then(() => {});

        return nextMap;
      });
    },
    [attemptId]
  );

  // Time spent tracker on current question
  const recordCurrentTime = useCallback(() => {
    if (!currentQuestion) return;
    const delta = Math.floor((Date.now() - questionStart.current) / 1000);
    if (delta > 0) {
      const a = answersRef.current[currentQuestion.id];
      persistAnswer(currentQuestion.id, {
        time_spent_seconds: (a?.time_spent_seconds ?? 0) + delta,
      });
    }
    questionStart.current = Date.now();
  }, [currentQuestion, persistAnswer]);

  // Navigate to a specific question globally
  const goToQuestion = useCallback(
    (targetIdx: number) => {
      if (targetIdx < 0 || targetIdx >= questions.length) return;
      recordCurrentTime();

      const nextQ = questions[targetIdx];
      if (nextQ) {
        const a = answersRef.current[nextQ.id];
        if (!a || a.status === "not_visited") {
          persistAnswer(nextQ.id, { status: "not_answered" });
        }
      }

      setCurrentGlobalIdx(targetIdx);
      questionStart.current = Date.now();
    },
    [questions, recordCurrentTime, persistAnswer]
  );

  // Option selection
  const selectOption = (key: string) => {
    if (!currentQuestion) return;
    const a = answers[currentQuestion.id];
    const nextStatus: AnswerStatus =
      a?.status === "marked" || a?.status === "answered_marked"
        ? "answered_marked"
        : "answered";

    persistAnswer(currentQuestion.id, {
      selected_option: key,
      status: nextStatus,
    });
  };

  // Clear current question response
  const clearResponse = () => {
    if (!currentQuestion) return;
    const a = answers[currentQuestion.id];
    const nextStatus: AnswerStatus =
      a?.status === "answered_marked" || a?.status === "marked"
        ? "marked"
        : "not_answered";

    persistAnswer(currentQuestion.id, {
      selected_option: null,
      status: nextStatus,
    });
    toast.info("Response cleared");
  };

  // Save & Next (Green)
  const saveAndNext = () => {
    if (!currentQuestion) return;
    recordCurrentTime();
    const a = answers[currentQuestion.id];

    if (a?.selected_option) {
      persistAnswer(currentQuestion.id, {
        status: a?.status === "answered_marked" ? "answered_marked" : "answered",
      });
    } else {
      persistAnswer(currentQuestion.id, {
        status: a?.status === "marked" ? "marked" : "not_answered",
      });
    }

    if (currentGlobalIdx < questions.length - 1) {
      goToQuestion(currentGlobalIdx + 1);
    } else {
      toast.success("Reached the last question. You can review or submit.");
    }
  };

  // Mark for Review & Next (Purple / Purple+Dot)
  const markForReviewAndNext = () => {
    if (!currentQuestion) return;
    recordCurrentTime();
    const a = answers[currentQuestion.id];

    persistAnswer(currentQuestion.id, {
      status: a?.selected_option ? "answered_marked" : "marked",
    });

    if (currentGlobalIdx < questions.length - 1) {
      goToQuestion(currentGlobalIdx + 1);
    } else {
      toast.info("Marked for review (last question).");
    }
  };

  // Go to Previous question
  const goPrevious = () => {
    if (currentGlobalIdx > 0) {
      goToQuestion(currentGlobalIdx - 1);
    }
  };

  // Submit test
  const submitTest = useCallback(
    async (auto = false) => {
      if (submitting) return;
      setSubmitting(true);
      recordCurrentTime();

      let correct = 0;
      let wrong = 0;
      let unattempted = 0;
      const updates: any[] = [];

      const currentAnswers = answersRef.current;

      for (const q of questions) {
        const a = currentAnswers[q.id];
        const selected = a?.selected_option ? String(a.selected_option).trim() : null;
        const hasSelected = Boolean(selected);

        let is_correct: boolean | null = null;
        if (!hasSelected) {
          unattempted++;
        } else if (selected?.toUpperCase() === String(q.correct_option || "").trim().toUpperCase()) {
          correct++;
          is_correct = true;
        } else {
          wrong++;
          is_correct = false;
        }

        updates.push({
          attempt_id: attemptId,
          question_id: q.id,
          selected_option: selected,
          status: hasSelected ? (a?.status === "answered_marked" ? "answered_marked" : "answered") : (a?.status ?? "not_answered"),
          time_spent_seconds: a?.time_spent_seconds ?? 0,
          is_correct,
        });
      }

      const score =
        correct * (test?.marks_correct ?? 4) +
        wrong * (test?.marks_wrong ?? -1);

      try {
        // Ensure fresh session before DB submission to avoid auth expirations
        try {
          const { data: sess } = await supabase.auth.getSession();
          if (!sess?.session || (sess.session.expires_at && sess.session.expires_at * 1000 < Date.now() + 1000 * 60 * 10)) {
            await supabase.auth.refreshSession();
          }
        } catch {}

        await supabase
          .from("answers")
          .upsert(updates, { onConflict: "attempt_id,question_id" });

        const { data: att } = await supabase
          .from("attempts")
          .select("started_at")
          .eq("id", attemptId)
          .maybeSingle();

        const timeSpent = att
          ? Math.floor((Date.now() - new Date(att.started_at).getTime()) / 1000)
          : 0;

        await supabase
          .from("attempts")
          .update({
            status: "submitted",
            submitted_at: new Date().toISOString(),
            score,
            correct_count: correct,
            wrong_count: wrong,
            unattempted_count: unattempted,
            time_spent_seconds: timeSpent,
          })
          .eq("id", attemptId);

        // Clear local cache
        sessionStorage.removeItem(`testum_attempt_${attemptId}_idx`);
        sessionStorage.removeItem(`testum_attempt_${attemptId}_answers`);

        if (auto) {
          toast.info("Time is up! Your test has been submitted automatically.");
        } else {
          toast.success("Test submitted successfully!");
        }

        navigate({ to: "/app/result/$attemptId", params: { attemptId } });
      } catch (err: any) {
        toast.error("Failed to submit test: " + err.message);
        setSubmitting(false);
      }
    },
    [submitting, recordCurrentTime, questions, attemptId, test, navigate]
  );

  // Keyboard Shortcuts (1-4 or A-D, Enter for Save & Next, Space for Clear)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || submitting || sheetOpen) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const key = e.key.toUpperCase();
      if (["A", "B", "C", "D"].includes(key)) {
        selectOption(key);
      } else if (["1", "2", "3", "4"].includes(e.key)) {
        const optionMap: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D" };
        selectOption(optionMap[e.key]);
      } else if (e.key === "ArrowRight") {
        saveAndNext();
      } else if (e.key === "ArrowLeft") {
        goPrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, submitting, sheetOpen, selectOption, saveAndNext, goPrevious]);

  // Compute summary stats
  const summary = useMemo(() => {
    let answered = 0;
    let notAnswered = 0;
    let marked = 0;
    let answeredMarked = 0;
    let notVisited = 0;

    for (const q of questions) {
      const s = answers[q.id]?.status ?? "not_visited";
      if (s === "answered") answered++;
      else if (s === "not_answered") notAnswered++;
      else if (s === "marked") marked++;
      else if (s === "answered_marked") answeredMarked++;
      else notVisited++;
    }

    return { answered, notAnswered, marked, answeredMarked, notVisited };
  }, [questions, answers]);

  if (loading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-background text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="font-semibold text-foreground">Loading NTA CBT Engine…</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-background p-4 text-center">
        <div>
          <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" />
          <h2 className="text-lg font-bold">No questions found in this test</h2>
          <Button asChild className="mt-4">
            <a href="/app/tests">Back to Tests</a>
          </Button>
        </div>
      </div>
    );
  }

  // Format time display
  const hh = String(Math.floor(remaining / 3600)).padStart(2, "0");
  const mm = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const currentAnswer = answers[currentQuestion.id];
  const isTimeCritical = remaining < 300; // Under 5 mins

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50 dark:bg-slate-950 select-none">
      {/* Top Fixed Header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur shadow-xs">
        <div className="mx-auto flex h-12 sm:h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:px-4">
          {/* Left: Test Title & Subject Chips */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <h1 className="truncate font-display text-sm font-bold text-foreground max-w-[140px] sm:max-w-xs md:max-w-none">
                {test?.title || "CBT Exam"}
              </h1>
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
                <span className="capitalize font-semibold text-primary">
                  {currentQuestion.subject}
                </span>
                {currentQuestion.chapter && (
                  <span className="hidden sm:inline">· {currentQuestion.chapter}</span>
                )}
              </div>
            </div>
          </div>

          {/* Center/Right: Timer & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Live Countdown Timer */}
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-sm font-bold tabular-nums shadow-xs transition-colors",
                isTimeCritical
                  ? "bg-rose-600 text-white animate-pulse"
                  : remaining < 900
                  ? "bg-amber-500 text-white"
                  : "bg-slate-900 text-white dark:bg-slate-800"
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>
                {hh}:{mm}:{ss}
              </span>
            </div>

            {/* Mobile Question Palette Drawer Trigger */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="md:hidden rounded-xl border-primary/30 text-primary hover:bg-primary/10 gap-1.5 px-2.5 font-semibold"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="text-xs font-bold">
                    {summary.answered}/{questions.length}
                  </span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[88vw] max-w-sm p-0 flex flex-col">
                <SheetHeader className="p-4 border-b bg-card">
                  <SheetTitle className="text-sm font-bold flex items-center justify-between">
                    <span>Question Palette</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {summary.answered} of {questions.length} Answered
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-hidden">
                  <QuestionPalette
                    questions={questions}
                    answers={answers}
                    currentGlobalIdx={currentGlobalIdx}
                    onSelectQuestion={(idx) => {
                      goToQuestion(idx);
                      setSheetOpen(false);
                    }}
                    selectedSubject={selectedSubject}
                    setSelectedSubject={setSelectedSubject}
                    subjects={subjects}
                    summary={summary}
                  />
                </div>
              </SheetContent>
            </Sheet>

            {/* Submit Test Button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  className="rounded-xl font-bold shadow-xs px-3"
                  disabled={submitting}
                >
                  Submit
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-md rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display text-lg font-bold flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-500" />
                    Confirm Test Submission
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3 pt-2 text-sm text-foreground">
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-3 text-xs">
                        <div>
                          Total Questions: <strong>{questions.length}</strong>
                        </div>
                        <div>
                          Answered:{" "}
                          <strong className="text-emerald-600">
                            {summary.answered}
                          </strong>
                        </div>
                        <div>
                          Marked for Review:{" "}
                          <strong className="text-purple-600">
                            {summary.marked + summary.answeredMarked}
                          </strong>
                        </div>
                        <div>
                          Unanswered / Skipped:{" "}
                          <strong className="text-rose-600">
                            {summary.notAnswered + summary.notVisited}
                          </strong>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Are you sure you want to submit? Once submitted, your answers cannot be modified.
                      </p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 sm:gap-0">
                  <AlertDialogCancel className="rounded-xl">Continue Test</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => submitTest(false)}
                    className="rounded-xl bg-destructive hover:bg-destructive/90 font-bold"
                  >
                    Yes, Submit Test
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Subject Navigation Tabs Bar */}
        {subjects.length > 1 && (
          <div className="border-t bg-card/60 px-3 sm:px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-muted-foreground uppercase mr-1">
              Sections:
            </span>
            <button
              onClick={() => setSelectedSubject("all")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shrink-0",
                selectedSubject === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              All Sections ({questions.length})
            </button>
            {subjects.map((s) => {
              const count = questions.filter((q) => q.subject === s).length;
              const isCurrentQSubject = currentQuestion.subject === s;
              return (
                <button
                  key={s}
                  onClick={() => {
                    setSelectedSubject(s);
                    // Find first question of this subject if current is not in it
                    if (!isCurrentQSubject) {
                      const firstIdx = questions.findIndex(
                        (q) => q.subject === s
                      );
                      if (firstIdx !== -1) goToQuestion(firstIdx);
                    }
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-all shrink-0 flex items-center gap-1",
                    selectedSubject === s
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : isCurrentQSubject
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>{s}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Examination Layout */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col lg:flex-row lg:items-start lg:gap-5 p-3 sm:p-4 md:p-5">
        {/* Left / Center: Question Paper Workspace */}
        <main className="flex-1 flex flex-col rounded-2xl sm:rounded-3xl border bg-card p-4 sm:p-6 shadow-xs transition-all">
          {/* Question Info & Marks Bar */}
          <div className="mb-4 flex items-center justify-between pb-3 border-b border-border/80 gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-xl bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary tracking-wide">
                Question {currentGlobalIdx + 1} of {questions.length}
              </span>
              <span className="rounded-xl bg-secondary px-2.5 py-1 text-xs font-semibold capitalize text-foreground border border-border/50">
                {currentQuestion.subject}
              </span>
              {currentQuestion.chapter && (
                <span className="text-xs text-muted-foreground hidden sm:inline-block">
                  · {currentQuestion.chapter}
                </span>
              )}
            </div>
            <div className="text-xs font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-muted/40 border">
              <span className="text-emerald-600 font-bold">+{test?.marks_correct ?? 4}</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-rose-600 font-bold">{test?.marks_wrong ?? -1}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium ml-0.5">Marks</span>
            </div>
          </div>

          {/* Question Image (if any) with robust loader & zoom */}
          {currentQuestion.question_image_url && (
            <div className="mb-4">
              <ExamImage
                src={currentQuestion.question_image_url}
                alt={`Question ${currentQuestion.order_index}`}
                onZoom={(url) => setZoomImage(url)}
                maxHeightClass="max-h-[260px] sm:max-h-[340px] md:max-h-[400px]"
              />
            </div>
          )}

          {/* Question Text */}
          {currentQuestion.question_text && (
            <div className="mb-5 text-sm sm:text-base font-medium leading-relaxed text-foreground whitespace-pre-wrap select-text">
              {currentQuestion.question_text}
            </div>
          )}

          {/* Options List — single col on mobile, 2-col on sm+ */}
          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            {currentQuestion.options.map((op) => {
              const isSelected = currentAnswer?.selected_option === op.key;
              return (
                <button
                  key={op.key}
                  type="button"
                  onClick={() => selectOption(op.key)}
                  className={cn(
                    "group flex items-start gap-3 rounded-2xl border p-3.5 sm:p-4 text-left transition-all duration-150 touch-manipulation cursor-pointer text-foreground",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary ring-offset-1 dark:ring-offset-card"
                      : "bg-card hover:border-primary/50 hover:bg-secondary/40 active:scale-[0.99]"
                  )}
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-xl font-display text-sm font-bold transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/30"
                        : "bg-secondary text-foreground group-hover:bg-primary/20 group-hover:text-primary"
                    )}
                  >
                    {op.key}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5 leading-relaxed text-sm font-medium">
                    {op.image_url && (
                      <ExamImage
                        src={op.image_url}
                        alt={`Option ${op.key}`}
                        maxHeightClass="max-h-28 sm:max-h-36"
                        showZoomButton={false}
                        containerClassName="p-1 mb-2 border-0 bg-transparent"
                      />
                    )}
                    {op.text && <span>{op.text}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom Action Buttons Bar */}
          <div className="mt-6 pt-4 border-t border-border/80 space-y-3">
            {/* Status & selection preview */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <div>
                {currentAnswer?.selected_option ? (
                  <span>
                    Selected: <strong className="text-primary font-bold">{currentAnswer.selected_option}</strong>
                  </span>
                ) : (
                  <span className="italic text-muted-foreground/80">No option selected</span>
                )}
              </div>
              <div className="text-[11px] font-medium hidden sm:block text-muted-foreground">
                Shortcuts: <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">1-4</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">A-D</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">→</kbd> Next
              </div>
            </div>

            {/* Responsive Action Buttons: 2x2 grid on small screens, 4-col flex on sm+ */}
            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 col-span-2 sm:col-span-1 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="default"
                  onClick={clearResponse}
                  disabled={!currentAnswer?.selected_option}
                  className="flex-1 sm:flex-initial h-11 rounded-xl border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 font-semibold text-xs sm:text-sm"
                >
                  <CircleX className="mr-1.5 h-4 w-4" /> Clear
                </Button>

                <Button
                  variant="secondary"
                  size="default"
                  onClick={markForReviewAndNext}
                  className="flex-1 sm:flex-initial h-11 rounded-xl font-semibold bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-950 dark:text-purple-300 text-xs sm:text-sm"
                >
                  <Flag className="mr-1.5 h-4 w-4" /> Mark for Review
                </Button>
              </div>

              <div className="flex items-center gap-2 col-span-2 sm:col-span-1 w-full sm:w-auto justify-end">
                <Button
                  variant="outline"
                  size="default"
                  onClick={goPrevious}
                  disabled={currentGlobalIdx === 0}
                  className="flex-1 sm:flex-initial h-11 rounded-xl font-semibold text-xs sm:text-sm"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Prev
                </Button>

                <Button
                  size="default"
                  onClick={saveAndNext}
                  className="flex-1 sm:flex-initial h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-sm text-xs sm:text-sm px-5"
                >
                  <Save className="mr-1.5 h-4 w-4" /> Save & Next
                </Button>
              </div>
            </div>
          </div>
        </main>

        {/* Right Desktop Question Palette Sidebar */}
        <aside className="hidden lg:flex w-80 shrink-0 flex-col rounded-3xl border bg-card shadow-xs overflow-hidden sticky top-20 max-h-[calc(100vh-100px)]">
          <div className="p-4 border-b bg-card">
            <h3 className="font-display font-bold text-sm text-foreground flex items-center justify-between">
              <span>Question Palette</span>
              <span className="text-xs font-semibold text-primary">
                {summary.answered}/{questions.length} Done
              </span>
            </h3>
          </div>
          <div className="flex-1 overflow-hidden">
            <QuestionPalette
              questions={questions}
              answers={answers}
              currentGlobalIdx={currentGlobalIdx}
              onSelectQuestion={(idx) => goToQuestion(idx)}
              selectedSubject={selectedSubject}
              setSelectedSubject={setSelectedSubject}
              subjects={subjects}
              summary={summary}
            />
          </div>
        </aside>
      </div>

      {/* Image Lightbox Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in"
          onClick={() => setZoomImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl bg-card p-3 shadow-2xl border"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomImage}
              alt="Zoomed Question"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              className="max-h-[82vh] w-auto max-w-full object-contain rounded-xl select-none"
            />
            <div className="mt-3 flex items-center justify-between pt-2 border-t text-xs">
              <span className="text-muted-foreground font-medium">Question Image Preview</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-8 rounded-lg text-xs"
                >
                  <a href={zoomImage} target="_blank" rel="noopener noreferrer">
                    Open in New Tab
                  </a>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setZoomImage(null)}
                  className="h-8 rounded-lg text-xs font-semibold"
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

// -------------------------------------------------------------
// Component: Question Palette (Accurate NTA Grid & Colors)
// -------------------------------------------------------------
function QuestionPalette({
  questions,
  answers,
  currentGlobalIdx,
  onSelectQuestion,
  selectedSubject,
  setSelectedSubject,
  subjects,
  summary,
}: {
  questions: Q[];
  answers: Record<string, A>;
  currentGlobalIdx: number;
  onSelectQuestion: (globalIdx: number) => void;
  selectedSubject: string;
  setSelectedSubject: (s: string) => void;
  subjects: string[];
  summary: {
    answered: number;
    notAnswered: number;
    marked: number;
    answeredMarked: number;
    notVisited: number;
  };
}) {
  // Filtered list for current subject view
  const visibleQuestions = useMemo(() => {
    return questions.map((q, globalIdx) => ({ q, globalIdx })).filter(({ q }) => {
      if (selectedSubject === "all") return true;
      return q.subject === selectedSubject;
    });
  }, [questions, selectedSubject]);

  const legendItems = [
    {
      label: "Answered",
      count: summary.answered,
      cls: "bg-emerald-600 text-white font-bold",
    },
    {
      label: "Not Answered",
      count: summary.notAnswered,
      cls: "bg-rose-600 text-white font-bold",
    },
    {
      label: "Marked for Review",
      count: summary.marked,
      cls: "bg-purple-600 text-white font-bold",
    },
    {
      label: "Ans & Marked",
      count: summary.answeredMarked,
      cls: "bg-purple-600 text-white font-bold relative after:content-[''] after:absolute after:bottom-0.5 after:right-0.5 after:h-2 after:w-2 after:rounded-full after:bg-emerald-400",
    },
    {
      label: "Not Visited",
      count: summary.notVisited,
      cls: "bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 font-semibold",
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Legend Grid */}
      <div className="grid grid-cols-2 gap-2 border-b p-3 bg-muted/20 text-xs">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] shadow-2xs",
                item.cls
              )}
            >
              {item.count}
            </span>
            <span className="text-[11px] text-muted-foreground truncate font-medium">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Questions Matrix Grid */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>
            {selectedSubject === "all" ? "All Questions" : `${selectedSubject} Questions`}
          </span>
          <span>{visibleQuestions.length} Total</span>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
          {visibleQuestions.map(({ q, globalIdx }) => {
            const a = answers[q.id];
            const status: AnswerStatus = a?.status ?? "not_visited";
            const isCurrent = globalIdx === currentGlobalIdx;

            // NTA Style Palette Colors
            let statusColor = "bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200";
            if (status === "answered") {
              statusColor = "bg-emerald-600 text-white font-bold shadow-xs hover:bg-emerald-700";
            } else if (status === "not_answered") {
              statusColor = "bg-rose-600 text-white font-bold shadow-xs hover:bg-rose-700";
            } else if (status === "marked") {
              statusColor = "bg-purple-600 text-white font-bold shadow-xs hover:bg-purple-700";
            } else if (status === "answered_marked") {
              statusColor = "bg-purple-600 text-white font-bold shadow-xs relative hover:bg-purple-700 after:content-[''] after:absolute after:bottom-0.5 after:right-0.5 after:h-2 after:w-2 after:rounded-full after:bg-emerald-400";
            }

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onSelectQuestion(globalIdx)}
                className={cn(
                  "aspect-square rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center cursor-pointer touch-manipulation",
                  statusColor,
                  isCurrent &&
                    "ring-3 ring-primary ring-offset-2 scale-105 z-10 dark:ring-offset-card"
                )}
                title={`Q${globalIdx + 1} (${q.subject}) - Status: ${status.replace("_", " ")}`}
              >
                {globalIdx + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
