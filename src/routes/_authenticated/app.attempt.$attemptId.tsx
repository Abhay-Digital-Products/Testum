import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Save,
  AlertCircle,
  Maximize2,
  Minimize2,
  FileText,
  Type,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExamImage } from "@/components/common/exam-image";
import {
  isOptionSelected,
  normalizeCorrectOption,
  normalizeOptionKey,
  normalizeQuestionOptions,
  isAnswerCorrect,
} from "@/lib/exam-options";

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

type PaletteFilter = "all" | "answered" | "not_answered" | "marked" | "not_visited";
type FontSizeOption = "normal" | "large";

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

  // Filter subject for Question Palette & Exam: "all" or specific subject
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [paletteFilter, setPaletteFilter] = useState<PaletteFilter>("all");
  const [remaining, setRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [paperModalOpen, setPaperModalOpen] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState<FontSizeOption>("normal");
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving">("synced");

  const questionStart = useRef<number>(Date.now());
  const answersRef = useRef<Record<string, A>>({});
  const submittingRef = useRef(false);

  // Fullscreen detection
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen toggle error:", err);
    }
  };

  // 1. Initial Load & Restore
  useEffect(() => {
    let isMounted = true;

    async function loadAttempt() {
      try {
        let cachedAnswers: Record<string, A> = {};
        try {
          const raw = sessionStorage.getItem(`testum_attempt_${attemptId}_answers`);
          if (raw) cachedAnswers = JSON.parse(raw);
        } catch (e) {
          console.error("Cache read error:", e);
        }

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

        // Fetch questions AND saved answers in parallel
        const [{ data: qs }, { data: ans }] = await Promise.all([
          supabase
            .from("questions")
            .select("id, order_index, subject, chapter, question_image_url, question_text, option_type, options, correct_option")
            .eq("test_id", att.test_id)
            .order("order_index"),
          supabase
            .from("answers")
            .select("question_id, selected_option, status, time_spent_seconds")
            .eq("attempt_id", attemptId),
        ]);

        const qList: Q[] = ((qs as any) ?? []).map((q: any) => ({
          ...q,
          options: normalizeQuestionOptions(q.options),
          correct_option: normalizeCorrectOption(q.correct_option) ?? String(q.correct_option || "").trim().toUpperCase(),
        }));
        if (isMounted) setQuestions(qList);

        const map: Record<string, A> = { ...cachedAnswers };
        (ans ?? []).forEach((a: any) => {
          let s: AnswerStatus = a.status;
          if (s === ("marked_for_review" as any)) s = "marked";
          else if (s === ("answered_and_marked" as any)) s = "answered_marked";
          else if (s === ("unattempted" as any)) s = "not_answered";

          if (!map[a.question_id] || map[a.question_id].status === "not_visited") {
            map[a.question_id] = {
              question_id: a.question_id,
              selected_option: a.selected_option,
              status: s || "not_visited",
              time_spent_seconds: a.time_spent_seconds || 0,
            };
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

          // Mark starting question as visited
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
                .upsert(
                  {
                    attempt_id: attemptId,
                    question_id: startQId,
                    selected_option: null,
                    status: "not_answered",
                    time_spent_seconds: 0,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "attempt_id,question_id" }
                )
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

  // Persist current question index
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

  // Background session keep-alive
  useEffect(() => {
    const keepAliveInterval = setInterval(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          const expiresAt = data.session.expires_at ? data.session.expires_at * 1000 : 0;
          if (!expiresAt || expiresAt < Date.now() + 1000 * 60 * 20) {
            await supabase.auth.refreshSession();
          }
        }
      } catch (err) {
        console.warn("[session-keepalive] Silent refresh error:", err);
      }
    }, 1000 * 60 * 5);

    return () => clearInterval(keepAliveInterval);
  }, []);

  // Subject list extracted from questions
  const subjects = useMemo(() => {
    return Array.from(new Set(questions.map((q) => q.subject))).filter(Boolean);
  }, [questions]);

  // Current active question
  const currentQuestion = questions[currentGlobalIdx];

  // Helper to persist answer updates
  const updateAnswer = useCallback(
    (qId: string, patch: Partial<A>, syncToDb = true) => {
      const current = answersRef.current[qId] ?? {
        question_id: qId,
        selected_option: null,
        status: "not_visited" as const,
        time_spent_seconds: 0,
      };
      const nextA: A = { ...current, ...patch };
      const nextMap: Record<string, A> = { ...answersRef.current, [qId]: nextA };

      // 1. Synchronously update ref
      answersRef.current = nextMap;

      // 2. Synchronously write to local cache
      try {
        sessionStorage.setItem(
          `testum_attempt_${attemptId}_answers`,
          JSON.stringify(nextMap)
        );
      } catch {}

      // 3. Update React UI state
      setAnswers(nextMap);

      // 4. Background persist to DB via upsert
      if (syncToDb) {
        setSyncStatus("saving");
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
          .then(({ error }: any) => {
            setSyncStatus("synced");
            if (error) {
              console.warn("Background answer sync error:", error.message);
            }
          });
      }

      return nextMap;
    },
    [attemptId]
  );

  // Time spent tracker on current question
  const recordCurrentTime = useCallback(() => {
    if (!currentQuestion) return;
    const delta = Math.floor((Date.now() - questionStart.current) / 1000);
    if (delta > 0) {
      const a = answersRef.current[currentQuestion.id];
      updateAnswer(
        currentQuestion.id,
        {
          time_spent_seconds: (a?.time_spent_seconds ?? 0) + delta,
        },
        false
      );
    }
    questionStart.current = Date.now();
  }, [currentQuestion, updateAnswer]);

  // Navigate to a specific question globally
  const goToQuestion = useCallback(
    (targetIdx: number) => {
      if (targetIdx < 0 || targetIdx >= questions.length) return;
      recordCurrentTime();

      const nextQ = questions[targetIdx];
      if (nextQ) {
        const a = answersRef.current[nextQ.id];
        if (!a || a.status === "not_visited") {
          updateAnswer(nextQ.id, { status: "not_answered" }, true);
        }
      }

      setCurrentGlobalIdx(targetIdx);
      try {
        sessionStorage.setItem(
          `testum_attempt_${attemptId}_idx`,
          targetIdx.toString()
        );
      } catch {}
      questionStart.current = Date.now();
    },
    [questions, recordCurrentTime, updateAnswer, attemptId]
  );

  // Option selection
  const selectOption = useCallback(
    (key: string) => {
      if (!currentQuestion) return;
      const normalizedKey = normalizeOptionKey(key);
      if (!normalizedKey) return;

      const a = answersRef.current[currentQuestion.id];
      const nextStatus: AnswerStatus =
        a?.status === "marked" || a?.status === "answered_marked"
          ? "answered_marked"
          : "answered";

      updateAnswer(
        currentQuestion.id,
        {
          selected_option: normalizedKey,
          status: nextStatus,
        },
        true
      );
    },
    [currentQuestion, updateAnswer]
  );

  // Clear current question response
  const clearResponse = useCallback(() => {
    if (!currentQuestion) return;
    const a = answersRef.current[currentQuestion.id];
    const nextStatus: AnswerStatus =
      a?.status === "answered_marked" || a?.status === "marked"
        ? "marked"
        : "not_answered";

    updateAnswer(
      currentQuestion.id,
      {
        selected_option: null,
        status: nextStatus,
      },
      true
    );
    toast.info("Response cleared");
  }, [currentQuestion, updateAnswer]);

  // Save & Next
  const saveAndNext = useCallback(() => {
    if (!currentQuestion) return;
    recordCurrentTime();
    const a = answersRef.current[currentQuestion.id];

    if (a?.selected_option) {
      updateAnswer(
        currentQuestion.id,
        {
          status: a.status === "answered_marked" ? "answered_marked" : "answered",
        },
        true
      );
    } else {
      updateAnswer(
        currentQuestion.id,
        {
          status: a?.status === "marked" ? "marked" : "not_answered",
        },
        true
      );
    }

    if (currentGlobalIdx < questions.length - 1) {
      goToQuestion(currentGlobalIdx + 1);
    } else {
      toast.success("Reached the last question. You can review or submit.");
    }
  }, [currentQuestion, recordCurrentTime, currentGlobalIdx, questions.length, goToQuestion, updateAnswer]);

  // Mark for Review & Next
  const markForReviewAndNext = useCallback(() => {
    if (!currentQuestion) return;
    recordCurrentTime();
    const a = answersRef.current[currentQuestion.id];

    updateAnswer(
      currentQuestion.id,
      {
        status: a?.selected_option ? "answered_marked" : "marked",
      },
      true
    );

    if (currentGlobalIdx < questions.length - 1) {
      goToQuestion(currentGlobalIdx + 1);
    } else {
      toast.info("Marked for review (last question).");
    }
  }, [currentQuestion, recordCurrentTime, currentGlobalIdx, questions.length, goToQuestion, updateAnswer]);

  // Go to Previous question
  const goPrevious = useCallback(() => {
    if (currentGlobalIdx > 0) {
      goToQuestion(currentGlobalIdx - 1);
    }
  }, [currentGlobalIdx, goToQuestion]);

  // Submit test
  const submitTest = useCallback(
    async (auto = false) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      recordCurrentTime();

      let currentAnswers: Record<string, A> = { ...answersRef.current };
      try {
        const raw = sessionStorage.getItem(`testum_attempt_${attemptId}_answers`);
        if (raw) {
          const parsed = JSON.parse(raw);
          currentAnswers = { ...parsed, ...currentAnswers };
        }
      } catch {}

      let correct = 0;
      let wrong = 0;
      let unattempted = 0;
      const updates: any[] = [];

      for (const q of questions) {
        const a = currentAnswers[q.id];
        const selected = normalizeOptionKey(a?.selected_option);
        const hasSelected = Boolean(selected);
        const qCorrect = normalizeCorrectOption(q.correct_option);

        let is_correct: boolean | null = null;
        if (!hasSelected) {
          unattempted++;
        } else if (isAnswerCorrect(selected, qCorrect)) {
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
          status: hasSelected
            ? (a?.status === "answered_marked" ? "answered_marked" : "answered")
            : (a?.status === "marked" ? "marked" : "not_answered"),
          time_spent_seconds: a?.time_spent_seconds ?? 0,
          is_correct,
          updated_at: new Date().toISOString(),
        });
      }

      const marksCorrect = test?.marks_correct ?? 4;
      const marksWrong = test?.marks_wrong ?? -1;
      const score = correct * marksCorrect + wrong * marksWrong;

      try {
        try {
          const { data: sess } = await supabase.auth.getSession();
          if (
            !sess?.session ||
            (sess.session.expires_at &&
              sess.session.expires_at * 1000 < Date.now() + 1000 * 60 * 10)
          ) {
            await supabase.auth.refreshSession();
          }
        } catch {}

        // Upsert all answers in batches
        const BATCH_SIZE = 50;
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
          const batch = updates.slice(i, i + BATCH_SIZE);
          const { error: ansErr } = await supabase
            .from("answers")
            .upsert(batch, { onConflict: "attempt_id,question_id" });
          if (ansErr) throw ansErr;
        }

        const { data: att } = await supabase
          .from("attempts")
          .select("started_at")
          .eq("id", attemptId)
          .maybeSingle();

        const timeSpent = att?.started_at
          ? Math.floor((Date.now() - new Date(att.started_at).getTime()) / 1000)
          : 0;

        const { error: attErr } = await supabase
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

        if (attErr) throw attErr;

        sessionStorage.removeItem(`testum_attempt_${attemptId}_idx`);
        sessionStorage.removeItem(`testum_attempt_${attemptId}_answers`);

        if (auto) {
          toast.info("Time is up! Your test has been submitted automatically.");
        } else {
          toast.success("Test submitted successfully!");
        }

        navigate({ to: "/app/result/$attemptId", params: { attemptId } });
      } catch (err: any) {
        console.error("Failed to submit test:", err);
        toast.error("Failed to submit test: " + (err?.message || "Network error. Please try again."));
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [recordCurrentTime, questions, attemptId, test, navigate]
  );

  // Keyboard Shortcuts (1-4, A-D, Enter, M, X, ArrowLeft/Right)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || submitting || sheetOpen || paperModalOpen) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const key = e.key.toUpperCase();
      if (["A", "B", "C", "D"].includes(key)) {
        selectOption(key);
      } else if (["1", "2", "3", "4"].includes(e.key)) {
        const optionMap: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D" };
        selectOption(optionMap[e.key]);
      } else if (e.key === "Enter" || e.key === "ArrowRight") {
        saveAndNext();
      } else if (e.key === "ArrowLeft") {
        goPrevious();
      } else if (key === "M") {
        markForReviewAndNext();
      } else if (key === "X") {
        clearResponse();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, submitting, sheetOpen, paperModalOpen, selectOption, saveAndNext, goPrevious, markForReviewAndNext, clearResponse]);

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

  // Subject-wise summary statistics
  const subjectSummary = useMemo(() => {
    const map: Record<string, { total: number; answered: number; marked: number; notAnswered: number }> = {};
    for (const s of subjects) {
      map[s] = { total: 0, answered: 0, marked: 0, notAnswered: 0 };
    }
    for (const q of questions) {
      const s = q.subject || "General";
      if (!map[s]) map[s] = { total: 0, answered: 0, marked: 0, notAnswered: 0 };
      map[s].total++;
      const st = answers[q.id]?.status ?? "not_visited";
      if (st === "answered" || st === "answered_marked") {
        map[s].answered++;
      } else if (st === "marked") {
        map[s].marked++;
      } else {
        map[s].notAnswered++;
      }
    }
    return map;
  }, [questions, answers, subjects]);

  if (loading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-background text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-sm" />
          <p className="font-display font-bold text-foreground text-base">Loading NTA CBT Engine…</p>
          <p className="text-xs text-muted-foreground">Preparing question paper and palette...</p>
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
          <Button asChild className="mt-4 rounded-xl">
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
      {/* Top Fixed CBT Header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur shadow-xs">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:px-4">
          {/* Left: Test Title & Live Section Pill */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-sm sm:text-base font-bold text-foreground max-w-[130px] sm:max-w-xs md:max-w-none">
                  {test?.title || "NEET CBT Exam"}
                </h1>
                {/* Sync status indicator */}
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className={cn("h-2 w-2 rounded-full", syncStatus === "synced" ? "bg-emerald-500" : "bg-amber-500 animate-ping")} />
                  {syncStatus === "synced" ? "Auto-saved" : "Saving…"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                <span className="capitalize font-bold text-primary">
                  {currentQuestion.subject}
                </span>
                {currentQuestion.chapter && (
                  <span className="hidden md:inline">· {currentQuestion.chapter}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Tools & Timer & Submit Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Font Scaler Toggle */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFontSize(fontSize === "normal" ? "large" : "normal")}
              className="h-9 px-2 sm:px-2.5 rounded-xl border text-muted-foreground hover:text-foreground hidden sm:flex items-center gap-1"
              title="Toggle Font Size"
            >
              <Type className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{fontSize === "normal" ? "Font: A" : "Font: A+"}</span>
            </Button>

            {/* Question Paper View Modal Trigger */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPaperModalOpen(true)}
              className="h-9 px-2 sm:px-2.5 rounded-xl border text-muted-foreground hover:text-foreground hidden sm:flex items-center gap-1.5"
              title="View full question paper"
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold">Question Paper</span>
            </Button>

            {/* Fullscreen Toggle */}
            <Button
              size="sm"
              variant="outline"
              onClick={toggleFullscreen}
              className="h-9 w-9 p-0 rounded-xl border text-muted-foreground hover:text-foreground hidden md:flex items-center justify-center"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>

            {/* Live Countdown Timer */}
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 font-mono text-xs sm:text-sm font-bold tabular-nums shadow-xs transition-colors",
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
                  className="lg:hidden h-9 rounded-xl border-primary/30 text-primary hover:bg-primary/10 gap-1 px-2 font-semibold"
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
                    paletteFilter={paletteFilter}
                    setPaletteFilter={setPaletteFilter}
                    subjects={subjects}
                    summary={summary}
                  />
                </div>
              </SheetContent>
            </Sheet>

            {/* Submit Test Button with Complete Section Breakdown */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-9 rounded-xl font-bold shadow-xs px-3 sm:px-4"
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-lg rounded-3xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display text-lg font-bold flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-500" />
                    Confirm Test Submission
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-4 pt-2 text-sm text-foreground">
                      <p className="text-xs text-muted-foreground">
                        Please review your summary below before final submission:
                      </p>

                      {/* Section-Wise Table Breakdown */}
                      <div className="rounded-2xl border overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/70 text-muted-foreground font-semibold border-b">
                            <tr>
                              <th className="p-2.5">Section</th>
                              <th className="p-2.5 text-center">Total</th>
                              <th className="p-2.5 text-center text-emerald-600">Answered</th>
                              <th className="p-2.5 text-center text-purple-600">Review</th>
                              <th className="p-2.5 text-center text-rose-600">Skipped</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {Object.entries(subjectSummary).map(([s, stat]) => (
                              <tr key={s} className="hover:bg-muted/30">
                                <td className="p-2.5 font-bold capitalize">{s}</td>
                                <td className="p-2.5 text-center">{stat.total}</td>
                                <td className="p-2.5 text-center font-bold text-emerald-600">{stat.answered}</td>
                                <td className="p-2.5 text-center font-bold text-purple-600">{stat.marked}</td>
                                <td className="p-2.5 text-center font-bold text-rose-600">{stat.notAnswered}</td>
                              </tr>
                            ))}
                            <tr className="bg-muted/40 font-bold border-t-2">
                              <td className="p-2.5">Overall Total</td>
                              <td className="p-2.5 text-center">{questions.length}</td>
                              <td className="p-2.5 text-center text-emerald-600">{summary.answered + summary.answeredMarked}</td>
                              <td className="p-2.5 text-center text-purple-600">{summary.marked}</td>
                              <td className="p-2.5 text-center text-rose-600">{summary.notAnswered + summary.notVisited}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {(summary.notAnswered + summary.notVisited > 0) && (
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                          ⚠️ You have <strong>{summary.notAnswered + summary.notVisited} unanswered questions</strong>. Once submitted, answers cannot be edited.
                        </div>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
                  <AlertDialogCancel className="rounded-xl font-semibold">Back to Exam</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => submitTest(false)}
                    className="rounded-xl bg-destructive hover:bg-destructive/90 font-bold"
                  >
                    Yes, Submit Exam
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Subject Navigation Tabs Bar */}
        {subjects.length > 1 && (
          <div className="border-t bg-card/60 px-3 sm:px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-muted-foreground uppercase mr-1 shrink-0">
              Sections:
            </span>
            <button
              onClick={() => setSelectedSubject("all")}
              className={cn(
                "rounded-xl px-3 py-1 text-xs font-bold transition-all shrink-0 cursor-pointer",
                selectedSubject === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              All Sections ({questions.length})
            </button>
            {subjects.map((s) => {
              const stat = subjectSummary[s] ?? { total: 0, answered: 0 };
              const isCurrentQSubject = currentQuestion.subject === s;
              return (
                <button
                  key={s}
                  onClick={() => {
                    setSelectedSubject(s);
                    if (!isCurrentQSubject) {
                      const firstIdx = questions.findIndex((q) => q.subject === s);
                      if (firstIdx !== -1) goToQuestion(firstIdx);
                    }
                  }}
                  className={cn(
                    "rounded-xl px-3 py-1 text-xs font-bold capitalize transition-all shrink-0 flex items-center gap-1.5 cursor-pointer",
                    selectedSubject === s
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : isCurrentQSubject
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>{s}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/50 font-mono">
                    {stat.answered}/{stat.total}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Examination Layout */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col lg:flex-row lg:items-start lg:gap-5 p-3 sm:p-4 md:p-5">
        {/* Left / Center: Question Paper Workspace */}
        <main className="flex-1 flex flex-col rounded-3xl border bg-card p-4 sm:p-6 shadow-xs transition-all">
          {/* Question Info & Marks Bar */}
          <div className="mb-4 flex items-center justify-between pb-3 border-b border-border/80 gap-2 flex-wrap">
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

          {/* Question Image with zoom */}
          {currentQuestion.question_image_url && (
            <div className="mb-4">
              <ExamImage
                src={currentQuestion.question_image_url}
                alt={`Question ${currentQuestion.order_index}`}
                onZoom={(url) => setZoomImage(url)}
                maxHeightClass="max-h-[260px] sm:max-h-[340px] md:max-h-[440px]"
              />
            </div>
          )}

          {/* Question Text */}
          {currentQuestion.question_text && (
            <div
              className={cn(
                "mb-5 font-medium leading-relaxed text-foreground whitespace-pre-wrap select-text",
                fontSize === "large" ? "text-base sm:text-lg" : "text-sm sm:text-base"
              )}
            >
              {currentQuestion.question_text}
            </div>
          )}

          {/* Options Grid (1 col on mobile, 2 col on sm+) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {currentQuestion.options.map((op) => {
              const isSelected = isOptionSelected(currentAnswer?.selected_option, op.key);
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
                  <div
                    className={cn(
                      "min-w-0 flex-1 pt-0.5 leading-relaxed font-medium",
                      fontSize === "large" ? "text-sm sm:text-base" : "text-xs sm:text-sm"
                    )}
                  >
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

          {/* Bottom Action Controls */}
          <div className="mt-6 pt-4 border-t border-border/80 space-y-3">
            {/* Status preview & Keyboard Shortcuts Hint */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <div>
                {currentAnswer?.selected_option ? (
                  <span>
                    Selected Choice: <strong className="text-primary font-bold">Option ({currentAnswer.selected_option})</strong>
                  </span>
                ) : (
                  <span className="italic text-muted-foreground/80">No option chosen</span>
                )}
              </div>
              <div className="text-[11px] font-medium hidden md:block text-muted-foreground">
                Keys: <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">1-4</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">A-D</kbd> · <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">Enter</kbd> Save · <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">M</kbd> Review
              </div>
            </div>

            {/* Responsive Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 col-span-2 sm:col-span-1 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="default"
                  onClick={clearResponse}
                  disabled={!currentAnswer?.selected_option}
                  className="flex-1 sm:flex-initial h-11 rounded-2xl border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 font-semibold text-xs sm:text-sm"
                >
                  <CircleX className="mr-1.5 h-4 w-4" /> Clear
                </Button>

                <Button
                  variant="secondary"
                  size="default"
                  onClick={markForReviewAndNext}
                  className="flex-1 sm:flex-initial h-11 rounded-2xl font-semibold bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-950 dark:text-purple-300 text-xs sm:text-sm"
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
                  className="flex-1 sm:flex-initial h-11 rounded-2xl font-semibold text-xs sm:text-sm"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Prev
                </Button>

                <Button
                  size="default"
                  onClick={saveAndNext}
                  className="flex-1 sm:flex-initial h-11 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-sm text-xs sm:text-sm px-6"
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
                {summary.answered}/{questions.length} Answered
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
              paletteFilter={paletteFilter}
              setPaletteFilter={setPaletteFilter}
              subjects={subjects}
              summary={summary}
            />
          </div>
        </aside>
      </div>

      {/* Full Question Paper Modal (NTA style view) */}
      <Dialog open={paperModalOpen} onOpenChange={setPaperModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 rounded-3xl">
          <DialogHeader className="p-5 border-b bg-card">
            <DialogTitle className="font-display text-lg font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Complete Question Paper — {test?.title || "NEET Test"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Scroll through all questions in test order. Click any question number to jump to it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {questions.map((q, idx) => (
              <div key={q.id} className="p-4 rounded-2xl border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-primary">
                    Question {idx + 1} · {q.subject}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      goToQuestion(idx);
                      setPaperModalOpen(false);
                    }}
                    className="h-7 text-xs rounded-lg font-semibold"
                  >
                    Go to Question
                  </Button>
                </div>
                {q.question_image_url && (
                  <ExamImage
                    src={q.question_image_url}
                    alt={`Q${idx + 1}`}
                    maxHeightClass="max-h-60"
                  />
                )}
                {q.question_text && (
                  <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                    {q.question_text}
                  </p>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-8 rounded-xl text-xs"
                >
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

// -------------------------------------------------------------
// Component: Question Palette (Accurate NTA Grid, Filters & Colors)
// -------------------------------------------------------------
function QuestionPalette({
  questions,
  answers,
  currentGlobalIdx,
  onSelectQuestion,
  selectedSubject,
  setSelectedSubject,
  paletteFilter,
  setPaletteFilter,
  subjects,
  summary,
}: {
  questions: Q[];
  answers: Record<string, A>;
  currentGlobalIdx: number;
  onSelectQuestion: (globalIdx: number) => void;
  selectedSubject: string;
  setSelectedSubject: (s: string) => void;
  paletteFilter: PaletteFilter;
  setPaletteFilter: (f: PaletteFilter) => void;
  subjects: string[];
  summary: {
    answered: number;
    notAnswered: number;
    marked: number;
    answeredMarked: number;
    notVisited: number;
  };
}) {
  const visibleQuestions = useMemo(() => {
    return questions
      .map((q, globalIdx) => ({ q, globalIdx }))
      .filter(({ q }) => {
        if (selectedSubject !== "all" && q.subject !== selectedSubject) {
          return false;
        }
        const a = answers[q.id];
        const status: AnswerStatus = a?.status ?? "not_visited";
        if (paletteFilter === "answered") {
          return status === "answered" || status === "answered_marked";
        }
        if (paletteFilter === "not_answered") {
          return status === "not_answered";
        }
        if (paletteFilter === "marked") {
          return status === "marked" || status === "answered_marked";
        }
        if (paletteFilter === "not_visited") {
          return status === "not_visited";
        }
        return true;
      });
  }, [questions, selectedSubject, paletteFilter, answers]);

  const legendItems = [
    {
      label: "Answered",
      count: summary.answered,
      filter: "answered" as PaletteFilter,
      cls: "bg-emerald-600 text-white font-bold",
    },
    {
      label: "Not Answered",
      count: summary.notAnswered,
      filter: "not_answered" as PaletteFilter,
      cls: "bg-rose-600 text-white font-bold",
    },
    {
      label: "Marked for Review",
      count: summary.marked,
      filter: "marked" as PaletteFilter,
      cls: "bg-purple-600 text-white font-bold",
    },
    {
      label: "Ans & Marked",
      count: summary.answeredMarked,
      filter: "marked" as PaletteFilter,
      cls: "bg-purple-600 text-white font-bold relative after:content-[''] after:absolute after:bottom-0.5 after:right-0.5 after:h-2 after:w-2 after:rounded-full after:bg-emerald-400",
    },
    {
      label: "Not Visited",
      count: summary.notVisited,
      filter: "not_visited" as PaletteFilter,
      cls: "bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 font-semibold",
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Legend & Filter Grid */}
      <div className="grid grid-cols-2 gap-2 border-b p-3 bg-muted/20 text-xs">
        {legendItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setPaletteFilter(paletteFilter === item.filter ? "all" : item.filter)}
            className={cn(
              "flex items-center gap-2 p-1 rounded-lg text-left transition-all cursor-pointer",
              paletteFilter === item.filter ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/40"
            )}
          >
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
          </button>
        ))}
      </div>

      {/* Questions Matrix Grid */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>
            {selectedSubject === "all" ? "All Questions" : `${selectedSubject}`}
            {paletteFilter !== "all" && ` · ${paletteFilter.replace("_", " ")}`}
          </span>
          <span>{visibleQuestions.length} Total</span>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
          {visibleQuestions.map(({ q, globalIdx }) => {
            const a = answers[q.id];
            const status: AnswerStatus = a?.status ?? "not_visited";
            const isCurrent = globalIdx === currentGlobalIdx;

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
                title={`Q${globalIdx + 1} (${q.subject}) - ${status.replace("_", " ")}`}
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
