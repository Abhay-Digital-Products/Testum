import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Clock, LayoutGrid, Flag, CircleX, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/attempt/$attemptId")({
  head: () => ({ meta: [{ title: "In Progress  -  Testum CBT" }] }),
  component: Player,
});

type Q = {
  id: string; order_index: number; subject: string; chapter: string | null;
  question_image_url: string | null; question_text: string | null;
  option_type: "image" | "text"; options: Array<{ key: string; text?: string; image_url?: string }>;
  correct_option: string;
};
type A = { question_id: string; selected_option: string | null; status: "not_visited"|"not_answered"|"answered"|"marked"|"answered_marked"; time_spent_seconds: number };

function Player() {
  const { attemptId } = Route.useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, A>>({});
  const [idx, setIdx] = useState(0);
  const [subject, setSubject] = useState<string>("all");
  const [remaining, setRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const questionStart = useRef<number>(Date.now());

  useEffect(() => {
    (async () => {
      const { data: att, error: attErr } = await supabase.from("attempts")
        .select("id, test_id, started_at, status, tests(id, title, duration_minutes, total_questions, marks_correct, marks_wrong)")
        .eq("id", attemptId).maybeSingle();
      if (attErr || !att) { toast.error("Attempt not found"); navigate({ to: "/app/tests" }); return; }
      if (att.status === "submitted") { navigate({ to: "/app/result/$attemptId", params: { attemptId } }); return; }
      setTest(att.tests);
      const { data: qs } = await supabase.from("questions")
        .select("id, order_index, subject, chapter, question_image_url, question_text, option_type, options, correct_option")
        .eq("test_id", att.test_id).order("order_index");
      setQuestions((qs as any) ?? []);
      const { data: ans } = await supabase.from("answers").select("question_id, selected_option, status, time_spent_seconds").eq("attempt_id", attemptId);
      const map: Record<string, A> = {};
      (ans ?? []).forEach((a: any) => { map[a.question_id] = a as any; });
      setAnswers(map);

      const dur = (att.tests?.duration_minutes ?? 180) * 60;
      const elapsed = Math.floor((Date.now() - new Date(att.started_at).getTime()) / 1000);
      setRemaining(Math.max(0, dur - elapsed));
      setLoading(false);
      questionStart.current = Date.now();
    })();
  }, [attemptId, navigate]);

  // Timer
  useEffect(() => {
    if (loading || remaining <= 0) return;
    const id = setInterval(() => setRemaining(r => r - 1), 1000);
    return () => clearInterval(id);
  }, [loading, remaining]);

  const submit = useCallback(async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);
    // Grade
    let correct = 0, wrong = 0, unattempted = 0;
    const updates: any[] = [];
    for (const q of questions) {
      const a = answers[q.id];
      const answered = a && (a.status === "answered" || a.status === "answered_marked") && a.selected_option;
      let is_correct: boolean | null = null;
      if (!answered) { unattempted++; }
      else if (a!.selected_option === q.correct_option) { correct++; is_correct = true; }
      else { wrong++; is_correct = false; }
      updates.push({ attempt_id: attemptId, question_id: q.id, selected_option: a?.selected_option ?? null, status: a?.status ?? "not_answered", time_spent_seconds: a?.time_spent_seconds ?? 0, is_correct });
    }
    const score = correct * (test?.marks_correct ?? 4) + wrong * (test?.marks_wrong ?? -1);
    const { error: upErr } = await supabase.from("answers").upsert(updates, { onConflict: "attempt_id,question_id" });
    if (upErr) console.error(upErr);
    const { data: att } = await supabase.from("attempts").select("started_at").eq("id", attemptId).maybeSingle();
    const timeSpent = att ? Math.floor((Date.now() - new Date(att.started_at).getTime()) / 1000) : 0;
    await supabase.from("attempts").update({ status: "submitted", submitted_at: new Date().toISOString(), score, correct_count: correct, wrong_count: wrong, unattempted_count: unattempted, time_spent_seconds: timeSpent }).eq("id", attemptId);
    if (auto) toast.info("Time's up  -  auto-submitted");
    navigate({ to: "/app/result/$attemptId", params: { attemptId } });
  }, [submitting, questions, answers, attemptId, test, navigate]);

  // auto-submit on timeout
  useEffect(() => { if (!loading && remaining === 0) submit(true); }, [remaining, loading, submit]);

  const visible = useMemo(() => subject === "all" ? questions : questions.filter(q => q.subject === subject), [questions, subject]);
  const current = visible[idx];

  useEffect(() => { if (current) markVisited(current.id); }, [current?.id]); // eslint-disable-line

  function persistAnswer(qId: string, patch: Partial<A>) {
    setAnswers(prev => {
      const now = prev[qId] ?? { question_id: qId, selected_option: null, status: "not_visited" as const, time_spent_seconds: 0 };
      const next: A = { ...now, ...patch };
      supabase.from("answers").update({ selected_option: next.selected_option, status: next.status, time_spent_seconds: next.time_spent_seconds }).eq("attempt_id", attemptId).eq("question_id", qId).then(() => {});
      return { ...prev, [qId]: next };
    });
  }
  function markVisited(qId: string) {
    const a = answers[qId];
    if (!a || a.status === "not_visited") persistAnswer(qId, { status: "not_answered" });
    questionStart.current = Date.now();
  }
  function addTime(qId: string) {
    const delta = Math.floor((Date.now() - questionStart.current) / 1000);
    const a = answers[qId];
    persistAnswer(qId, { time_spent_seconds: (a?.time_spent_seconds ?? 0) + delta });
  }
  function selectOption(key: string) {
    if (!current) return;
    const a = answers[current.id];
    const nextStatus = a?.status === "marked" || a?.status === "answered_marked" ? "answered_marked" : "answered";
    persistAnswer(current.id, { selected_option: key, status: nextStatus });
  }
  function clearResponse() {
    if (!current) return;
    const a = answers[current.id];
    const nextStatus = a?.status === "answered_marked" || a?.status === "marked" ? "marked" : "not_answered";
    persistAnswer(current.id, { selected_option: null, status: nextStatus });
  }
  function saveNext() {
    if (!current) return;
    addTime(current.id);
    const a = answers[current.id];
    if (a?.selected_option) persistAnswer(current.id, { status: a?.status === "answered_marked" ? "answered_marked" : "answered" });
    else persistAnswer(current.id, { status: a?.status === "marked" ? "marked" : "not_answered" });
    setIdx(i => Math.min(visible.length - 1, i + 1));
  }
  function markNext() {
    if (!current) return;
    addTime(current.id);
    const a = answers[current.id];
    persistAnswer(current.id, { status: a?.selected_option ? "answered_marked" : "marked" });
    setIdx(i => Math.min(visible.length - 1, i + 1));
  }

  if (loading) return <div className="grid min-h-[100dvh] place-items-center text-sm text-muted-foreground">Loading test…</div>;
  if (!current) return <div className="grid min-h-[100dvh] place-items-center text-sm">No questions.</div>;

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const hh = String(Math.floor(remaining / 3600)).padStart(2, "0");
  const summary = summarize(questions, answers);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-secondary/30">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-semibold sm:text-base">{test?.title}</div>
            
          </div>
          <div className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-sm font-semibold tabular-nums",
            remaining < 300 ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-primary text-primary-foreground")}>
            <Clock className="h-3.5 w-3.5" /> {hh}:{mm}:{ss}
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="md:hidden"><LayoutGrid className="h-4 w-4"/></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm p-0">
              <SheetHeader className="p-4 border-b"><SheetTitle>Question Palette</SheetTitle></SheetHeader>
              <Palette questions={questions} answers={answers} visible={visible} idx={idx} setIdx={setIdx} subject={subject} setSubject={setSubject} summary={summary} />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col md:flex-row md:gap-4 md:p-4">
        <main className="flex-1 md:rounded-2xl md:border md:bg-card md:p-5 bg-card p-4">
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Question <b className="text-foreground">{idx + 1}</b> of {visible.length}</span>
            <span className="uppercase font-semibold tracking-wider">{current.subject}{current.chapter ? ` · ${current.chapter}` : ""}</span>
          </div>

          {current.question_image_url && (
            <img src={current.question_image_url} alt={`Question ${current.order_index}`} className="mb-4 max-w-full rounded-xl border" />
          )}
          {current.question_text && <p className="mb-4 whitespace-pre-wrap text-base leading-relaxed">{current.question_text}</p>}

          <div className="grid gap-2 sm:grid-cols-2">
            {current.options.map(op => {
              const selected = answers[current.id]?.selected_option === op.key;
              return (
                <button key={op.key} onClick={() => selectOption(op.key)} className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-left transition touch-manipulation",
                  selected ? "border-primary bg-primary/10 ring-2 ring-primary" : "hover:border-primary/50"
                )}>
                  <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border text-sm font-bold",
                    selected ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground")}>{op.key}</span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    {op.image_url && <img src={op.image_url} alt={`Option ${op.key}`} className="max-h-40 rounded" />}
                    {op.text && <span className="text-sm">{op.text}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button variant="secondary" size="sm" onClick={clearResponse}><CircleX className="mr-1 h-3.5 w-3.5"/>Clear</Button>
            <Button variant="outline" size="sm" onClick={markNext}><Flag className="mr-1 h-3.5 w-3.5"/>Mark & Next</Button>
            <Button variant="outline" size="sm" onClick={() => { addTime(current.id); setIdx(i => Math.max(0, i - 1)); }}><ChevronLeft className="mr-1 h-3.5 w-3.5"/>Previous</Button>
            <Button size="sm" onClick={saveNext}><Save className="mr-1 h-3.5 w-3.5"/>Save & Next<ChevronRight className="h-3.5 w-3.5"/></Button>
          </div>

          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div className="text-xs text-muted-foreground">Answered: <b className="text-success">{summary.answered}</b> · Marked: <b className="text-primary">{summary.marked}</b> · Skipped: <b className="text-destructive">{summary.notAnswered}</b></div>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Submit test</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Submit your test?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You have answered {summary.answered} of {questions.length} questions. Once submitted you cannot change your answers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Continue test</AlertDialogCancel>
                  <AlertDialogAction onClick={() => submit(false)}>Yes, submit</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </main>

        <aside className="hidden md:block w-72 shrink-0 rounded-2xl border bg-card">
          <Palette questions={questions} answers={answers} visible={visible} idx={idx} setIdx={setIdx} subject={subject} setSubject={setSubject} summary={summary} />
        </aside>
      </div>
    </div>
  );
}

function summarize(qs: Q[], ans: Record<string, A>) {
  let answered=0, notAnswered=0, marked=0, answeredMarked=0, notVisited=0;
  for (const q of qs) {
    const s = ans[q.id]?.status ?? "not_visited";
    if (s==="answered") answered++;
    else if (s==="not_answered") notAnswered++;
    else if (s==="marked") marked++;
    else if (s==="answered_marked") answeredMarked++;
    else notVisited++;
  }
  return { answered, notAnswered, marked, answeredMarked, notVisited };
}

function Palette({ questions, answers, visible, idx, setIdx, subject, setSubject, summary }: any) {
  const subjects = Array.from(new Set(questions.map((q: Q) => q.subject)));
  const legend = [
    { c: "bg-palette-answered text-white", l: "Answered", v: summary.answered },
    { c: "bg-palette-not-answered text-white", l: "Not Answered", v: summary.notAnswered },
    { c: "bg-palette-marked text-white", l: "Marked", v: summary.marked },
    { c: "bg-palette-answered-marked text-white", l: "Ans+Marked", v: summary.answeredMarked },
    { c: "bg-palette-not-visited text-foreground border", l: "Not Visited", v: summary.notVisited },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subject</div>
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setSubject("all")} className={cn("rounded-md px-2.5 py-1 text-xs font-medium", subject==="all"?"bg-primary text-primary-foreground":"bg-secondary")}>All</button>
          {subjects.map((s: any) => (
            <button key={s} onClick={() => setSubject(s)} className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize", subject===s?"bg-primary text-primary-foreground":"bg-secondary")}>{s}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 border-b p-3 text-[11px]">
        {legend.map(l => (
          <div key={l.l} className="flex items-center gap-1.5">
            <span className={cn("grid h-5 w-5 place-items-center rounded text-[10px] font-bold", l.c)}>{l.v}</span>
            <span className="text-muted-foreground">{l.l}</span>
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Questions</div>
        <div className="grid grid-cols-6 gap-1.5">
          {visible.map((q: Q, i: number) => {
            const s = answers[q.id]?.status ?? "not_visited";
            const cls =
              s==="answered" ? "bg-palette-answered text-white" :
              s==="not_answered" ? "bg-palette-not-answered text-white" :
              s==="marked" ? "bg-palette-marked text-white" :
              s==="answered_marked" ? "bg-palette-answered-marked text-white relative after:absolute after:top-0.5 after:right-0.5 after:h-1.5 after:w-1.5 after:rounded-full after:bg-white" :
              "bg-palette-not-visited text-foreground border";
            return (
              <button key={q.id} onClick={() => setIdx(i)} className={cn("aspect-square rounded-md text-xs font-bold transition", cls, i===idx && "ring-2 ring-offset-1 ring-primary")}>
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
