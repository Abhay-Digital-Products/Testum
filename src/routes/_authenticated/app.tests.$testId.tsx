import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlements, type PlanCode } from "@/hooks/use-entitlements";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Info, Loader2, Lock, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

function InstructionsErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[Instructions Error]", error);
  const handleRecover = () => {
    try {
      reset();
    } catch {}
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="max-w-md text-center p-6 rounded-3xl border bg-card shadow-sm space-y-4">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <Info className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold font-display text-foreground">Could not load test details</h2>
        <p className="text-xs text-muted-foreground">
          There was a temporary connection problem loading this test. Tap below to retry.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Button onClick={handleRecover} className="rounded-xl font-bold cursor-pointer">
            Retry Loading Test
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/app/tests">Back to Tests</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/tests/$testId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Instructions  -  Testum" }] }),
  component: Instructions,
  errorComponent: InstructionsErrorComponent,
});

const NTA_INSTRUCTIONS = [
  "Total duration of the examination is shown at the top-right corner of your screen.",
  "The clock will be set at the server. The countdown timer at the top-right will display the remaining time. When the timer reaches zero, the exam will end and your answers will be submitted automatically.",
  "The Questions Palette displayed on the right side of your screen shows the status of each question using one of the following symbols:",
  "· White: You have not visited the question yet.",
  "· Red: You have not answered the question.",
  "· Green: You have answered the question.",
  "· Purple: You have marked the question for review.",
  "· Purple with a tick: You answered the question and marked it for review  -  it will be considered for evaluation.",
  "You can click on the question number in the palette to jump to that question directly.",
  "To answer a question, click one of the option buttons. To change your answer, click another option. To deselect, click the same option again or use Clear Response.",
  "Click Save & Next to save your answer and move to the next question.",
  "Click Mark for Review & Next to mark the current question for review and move to the next question. Marked questions are still evaluated if answered.",
  "The section navigation lets you switch between Physics, Chemistry and Biology at any time.",
  "You can submit the test anytime by clicking the Submit button. Once submitted, no changes can be made.",
];

function Instructions() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState<any>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const { hasAccess, loading: entLoading } = useEntitlements();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setLoadError(null);

    async function loadTest() {
      try {
        const { data: t, error: tErr } = await supabase
          .from("tests")
          .select("id, title, duration_minutes, total_questions, marks_correct, marks_wrong, test_series(title, kind, plan_code, planner_pdf_url)")
          .eq("id", testId)
          .maybeSingle();

        if (tErr) {
          if (isMounted) {
            setLoadError(tErr.message || "Failed to load test details.");
            setLoading(false);
          }
          return;
        }

        if (!t) {
          if (isMounted) {
            setLoadError("Test not found or no longer available.");
            setLoading(false);
          }
          return;
        }

        if (isMounted) setTest(t);

        const { data: u } = await supabase.auth.getUser();
        if (u.user && isMounted) {
          const { data: open } = await supabase
            .from("attempts")
            .select("id")
            .eq("test_id", testId)
            .eq("user_id", u.user.id)
            .eq("status", "in_progress")
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (isMounted) setResumeId(open?.id ?? null);
        }

        if (isMounted) setLoading(false);
      } catch (err: any) {
        if (isMounted) {
          setLoadError(err?.message || "Connection error. Please try again.");
          setLoading(false);
        }
      }
    }

    loadTest();

    return () => {
      isMounted = false;
    };
  }, [testId, retryCount]);

  const isStandalone = !test?.series_id || !test?.test_series;
  const rawPlan = isStandalone ? null : (test?.test_series?.plan_code ?? test?.test_series?.kind ?? null);
  const isFreeTest =
    isStandalone ||
    Boolean(test?.is_free) ||
    rawPlan === "free" ||
    (test?.test_series?.title ?? "").toLowerCase().includes("free") ||
    (test?.title ?? "").toLowerCase().includes("free");
  const planCode = isFreeTest ? null : (rawPlan as PlanCode | null);
  const unlocked = isFreeTest || (!entLoading && hasAccess(planCode, isFreeTest));

  const startAttempt = async () => {
    if (!unlocked) { toast.error("Unlock this test series first."); return; }
    setBusy(true);
    try {
      if (resumeId) {
        navigate({ to: "/app/attempt/$attemptId", params: { attemptId: resumeId } });
        return;
      }
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("Please sign in to begin this test.");
        setBusy(false);
        return;
      }

      // Check once more for existing active attempt before creating new one
      const { data: existingActive } = await supabase
        .from("attempts")
        .select("id")
        .eq("test_id", testId)
        .eq("user_id", u.user.id)
        .eq("status", "in_progress")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingActive?.id) {
        navigate({ to: "/app/attempt/$attemptId", params: { attemptId: existingActive.id } });
        return;
      }

      const { data: qs, error: qsErr } = await supabase
        .from("questions")
        .select("id")
        .eq("test_id", testId)
        .order("order_index", { ascending: true });

      if (qsErr || !qs || qs.length === 0) {
        toast.error("No questions in this test yet.");
        setBusy(false);
        return;
      }

      const { data: attempt, error: attError } = await supabase
        .from("attempts")
        .insert({ test_id: testId, user_id: u.user.id, status: "in_progress" })
        .select("id")
        .single();

      if (attError || !attempt) {
        toast.error(attError?.message ?? "Failed to start test session.");
        setBusy(false);
        return;
      }

      // Insert initial answers in safe batches of 50
      const rows = qs.map((q: any) => ({
        attempt_id: attempt.id,
        question_id: q.id,
        status: "not_visited" as const,
      }));

      const BATCH_SIZE = 50;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        try {
          await supabase.from("answers").insert(batch);
        } catch {
          // Non-blocking: attempt page will auto-initialize missing answers in memory
        }
      }

      navigate({ to: "/app/attempt/$attemptId", params: { attemptId: attempt.id } });
    } catch (err: any) {
      console.error("Failed to start attempt:", err);
      toast.error(err?.message || "Failed to start test. Please try again.");
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-2.5">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="font-semibold text-foreground text-sm">Loading test instructions…</p>
        </div>
      </div>
    );
  }

  if (loadError || !test) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
        <div className="max-w-md p-6 rounded-3xl border bg-card text-center space-y-4 shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <Info className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-foreground">Could not load test</h2>
            <p className="mt-1 text-xs text-muted-foreground">{loadError || "Test not found."}</p>
          </div>
          <div className="flex justify-center gap-2 pt-1">
            <Button onClick={() => setRetryCount((c) => c + 1)} className="rounded-xl font-bold cursor-pointer">
              Retry Loading
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/app/tests">Back to Tests</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button asChild variant="ghost" size="sm"><Link to="/app/tests"><ArrowLeft className="mr-1 h-4 w-4"/>Back</Link></Button>

      <div className="rounded-3xl border bg-hero p-6 text-primary-foreground shadow-elegant">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs opacity-90 uppercase tracking-wider">{test.test_series?.title ?? "Standalone Free Practice Test"}</div>
          {test.test_series?.planner_pdf_url && (
            <Button
              asChild
              size="sm"
              variant="secondary"
              className="h-7 px-2.5 rounded-lg text-xs font-bold bg-white/20 hover:bg-white/30 text-white border-0 cursor-pointer shadow-xs gap-1"
              title="Open Test Series Planner PDF"
            >
              <a href={test.test_series.planner_pdf_url} target="_blank" rel="noopener noreferrer">
                <FileText className="h-3.5 w-3.5" /> Series Planner (PDF)
                <ExternalLink className="h-3 w-3 opacity-70 ml-0.5" />
              </a>
            </Button>
          )}
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{test.title}</h1>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-primary-foreground/10 p-3">
            <div className="text-xs opacity-90">Duration</div>
            <div className="font-display text-lg font-bold">{test.duration_minutes} min</div>
          </div>
          <div className="rounded-xl bg-primary-foreground/10 p-3">
            <div className="text-xs opacity-90">Questions</div>
            <div className="font-display text-lg font-bold">{test.total_questions}</div>
          </div>
          <div className="rounded-xl bg-primary-foreground/10 p-3">
            <div className="text-xs opacity-90">Marking</div>
            <div className="font-display text-lg font-bold">+{test.marks_correct}/{test.marks_wrong}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Info className="h-4 w-4"/></div>
          <h2 className="font-display text-lg font-semibold">General Instructions</h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Please read the following instructions carefully:</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          {NTA_INSTRUCTIONS.map((line, i) => (
            <li key={i} className={line.startsWith("·") ? "list-none -ml-5 pl-4 text-muted-foreground" : ""}>{line.replace(/^·\s*/, "")}</li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        {unlocked ? (
          <>
            {resumeId && (
              <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                You have an unfinished attempt for this test. Continue where you left off  -  your saved answers and timer are restored.
              </div>
            )}
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-0.5" />
              <span className="text-sm">
                I have read all the instructions carefully. I understand that using unfair means or leaving the test window may lead to disqualification. I am ready to begin the test.
              </span>
            </label>
            <Button disabled={!agreed || busy} onClick={startAttempt} className="mt-5 w-full h-12">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              {resumeId ? "Resume my test" : "I am ready to begin"}
            </Button>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><Lock className="h-5 w-5"/></div>
            <h3 className="mt-3 font-display font-semibold">This test is locked</h3>
            <p className="mt-1 text-sm text-muted-foreground">Purchase this test series to attempt it.</p>
            <Button asChild className="mt-5 w-full h-12" disabled={entLoading}><Link to="/app/pricing">View plans</Link></Button>
          </div>
        )}
      </div>
    </div>
  );
}
