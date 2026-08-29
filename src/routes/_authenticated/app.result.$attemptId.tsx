import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateAiAnalysis } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, XCircle, MinusCircle, TrendingUp, ArrowLeft,
  Loader2, Download, PlayCircle, Sparkles, BookOpen, Clock, Target, Calendar
} from "lucide-react";
import { toast } from "sonner";
import { ExamImage } from "@/components/common/exam-image";


export const Route = createFileRoute("/_authenticated/app/result/$attemptId")({
  head: () => ({ meta: [{ title: "Diagnostic Result & Report - Testum" }] }),
  component: Result,
});

function Result() {
  const { attemptId } = Route.useParams();
  const runAi = useServerFn(generateAiAnalysis);
  const [attempt, setAttempt] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [review, setReview] = useState<any[]>([]);

  const load = async () => {
    const { data: att } = await supabase.from("attempts")
      .select("id, score, correct_count, wrong_count, unattempted_count, time_spent_seconds, submitted_at, tests(id, title, total_questions, marks_correct, marks_wrong, duration_minutes)")
      .eq("id", attemptId).maybeSingle();
    setAttempt(att);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: p } = await supabase.from("profiles").select("full_name, student_class").eq("user_id", user.id).maybeSingle();
      setProfile(p);
    }

    const { data: an } = await supabase.from("analysis").select("*").eq("attempt_id", attemptId).maybeSingle();
    setAnalysis(an);

    // Fetch all answers for this attempt
    const { data: rows } = await supabase
      .from("answers")
      .select("is_correct, selected_option, time_spent_seconds, questions(id, order_index, subject, chapter, question_text, question_image_url, option_type, options, correct_option, solution_text, solution_image_url, solution_video_url)")
      .eq("attempt_id", attemptId);

    // Also fetch ALL questions for this test so unattempted ones appear too
    let allQRows: any[] = [];
    if (att?.tests?.id) {
      const { data: allQ } = await supabase
        .from("questions")
        .select("id, order_index, subject, chapter, question_text, question_image_url, option_type, options, correct_option, solution_text, solution_image_url, solution_video_url")
        .eq("test_id", att.tests.id)
        .order("order_index", { ascending: true });
      allQRows = allQ ?? [];
    }

    // Build answer lookup by question id
    const answerMap = new Map<string, any>();
    for (const r of (rows ?? [])) {
      if (r.questions?.id) answerMap.set(r.questions.id, r);
    }

    // Merge: every question gets an entry
    const merged = allQRows.map((q: any) => {
      const ans = answerMap.get(q.id);
      return {
        is_correct: ans?.is_correct ?? null,
        selected_option: ans?.selected_option ?? null,
        time_spent_seconds: ans?.time_spent_seconds ?? 0,
        questions: q,
      };
    });

    const sortedRows = merged
      .filter((r: any) => r.questions)
      .sort((a: any, b: any) => (a.questions?.order_index ?? 0) - (b.questions?.order_index ?? 0));
    setReview(sortedRows);

    // If analysis does not exist yet, generate it automatically
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
  };

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const an = analysis;
      const { downloadResultPdf } = await import("@/lib/result-pdf");
      await downloadResultPdf({
        studentName: profile?.full_name ?? "Testum Student",
        studentClass: profile?.student_class ?? null,
        testTitle: attempt.tests?.title ?? "Mock Test",
        submittedAt: attempt.submitted_at,
        score: Number(attempt.score),
        totalMax: (attempt.tests?.total_questions ?? 180) * (attempt.tests?.marks_correct ?? 4),
        correct: attempt.correct_count,
        wrong: attempt.wrong_count,
        unattempted: attempt.unattempted_count,
        timeSpentSeconds: attempt.time_spent_seconds,
        durationMinutes: attempt.tests?.duration_minutes ?? 180,
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
          correct_option: r.questions.correct_option,
          selected_option: r.selected_option ?? null,
          is_correct: r.is_correct ?? null,
          time_spent_seconds: r.time_spent_seconds ?? 0,
          solution_text: r.questions.solution_text,
          solution_image_url: r.questions.solution_image_url,
          solution_video_url: r.questions.solution_video_url,
        })),
      });
      toast.success("Detailed report downloaded successfully");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate PDF");
    } finally {
      setPdfBusy(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [attemptId]);

  if (!attempt) return <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin text-primary mr-2" /> Loading result diagnostics...</div>;

  const totalMax = (attempt.tests?.total_questions ?? 180) * (attempt.tests?.marks_correct ?? 4);
  const attempted = attempt.correct_count + attempt.wrong_count;
  const total = attempted + attempt.unattempted_count;
  const accuracy = attempted ? Math.round((attempt.correct_count / attempted) * 100) : 0;
  const percent = totalMax ? Math.round((Number(attempt.score) / totalMax) * 100) : 0;
  const subjects = analysis?.subject_breakdown?.subjects ?? {};
  const chapters = analysis?.subject_breakdown?.chapters ?? {};
  const solutions = review.filter((r: any) => r.questions?.solution_video_url);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top action bar */}
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/app"><ArrowLeft className="mr-1 h-4 w-4" /> Back to Dashboard</Link>
        </Button>
        <Button onClick={downloadPdf} size="sm" className="bg-primary font-semibold shadow-sm" disabled={pdfBusy}>
          {pdfBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
          Download Official PDF Report
        </Button>
      </div>

      {/* Hero Score Banner */}
      <div className="rounded-3xl border bg-hero p-6 sm:p-8 text-primary-foreground shadow-elegant">
        <div className="text-xs font-semibold uppercase tracking-wider opacity-85">
          NEET Performance Report · Submitted {new Date(attempt.submitted_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
        <h1 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">{attempt.tests?.title}</h1>
        <p className="text-xs opacity-90 mt-0.5">Student: {profile?.full_name ?? "Student"}{profile?.student_class ? " · " + profile.student_class : ""}</p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-primary-foreground/10 p-4 backdrop-blur-sm">
            <div className="text-xs opacity-85 font-medium">Final Score</div>
            <div className="font-display text-3xl font-black mt-0.5">
              {Math.round(Number(attempt.score))}<span className="text-base font-semibold opacity-75">/{totalMax}</span>
            </div>
            <div className="mt-1 text-xs opacity-85">{percent}% of total marks</div>
          </div>
          <div className="rounded-2xl bg-primary-foreground/10 p-4 backdrop-blur-sm">
            <div className="text-xs opacity-85 font-medium">Accuracy</div>
            <div className="font-display text-3xl font-black mt-0.5">{accuracy}%</div>
            <div className="mt-1 text-xs opacity-85">{attempt.correct_count} correct of {attempted}</div>
          </div>
          <div className="rounded-2xl bg-primary-foreground/10 p-4 backdrop-blur-sm">
            <div className="text-xs opacity-85 font-medium">Time Utilized</div>
            <div className="font-display text-3xl font-black mt-0.5">
              {Math.floor(attempt.time_spent_seconds / 60)}<span className="text-base font-semibold opacity-75">m</span>
            </div>
            <div className="mt-1 text-xs opacity-85">of {attempt.tests?.duration_minutes}m allowed</div>
          </div>
          <div className="rounded-2xl bg-primary-foreground/10 p-4 backdrop-blur-sm">
            <div className="text-xs opacity-85 font-medium">Attempt Ratio</div>
            <div className="font-display text-3xl font-black mt-0.5">{attempted}<span className="text-base font-semibold opacity-75">/{total}</span></div>
            <div className="mt-1 text-xs opacity-85">{attempt.unattempted_count} questions skipped</div>
          </div>
        </div>
      </div>

      {/* Answer counts summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { Icon: CheckCircle2, l: "Correct (+4)", v: attempt.correct_count, pts: "+" + (attempt.correct_count * 4) + " Marks", c: "bg-success/10 text-success border-success/20" },
          { Icon: XCircle, l: "Incorrect (-1)", v: attempt.wrong_count, pts: "-" + (attempt.wrong_count * 1) + " Marks", c: "bg-destructive/10 text-destructive border-destructive/20" },
          { Icon: MinusCircle, l: "Unattempted (0)", v: attempt.unattempted_count, pts: "0 Marks", c: "bg-secondary text-muted-foreground border-border" },
        ].map(({ Icon, l, v, pts, c }) => (
          <div key={l} className={`rounded-2xl border p-4 flex items-center justify-between ${c}`}>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-background shadow-xs"><Icon className="h-5 w-5" /></div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wide">{l}</div>
                <div className="font-display text-2xl font-black">{v}</div>
              </div>
            </div>
            <div className="text-xs font-semibold">{pts}</div>
          </div>
        ))}
      </div>

      {/* AI Performance Analysis Card */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-primary">
            <Sparkles className="h-5 w-5 text-primary" /> AI Diagnostic & Study Recommendations
          </div>
          {aiBusy && <span className="flex items-center gap-1.5 text-xs text-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating Grok analysis...</span>}
        </div>

        {analysis?.ai_summary ? (
          <div className="rounded-xl bg-card border p-4 text-sm text-foreground leading-relaxed">
            <p className="font-semibold text-primary text-xs uppercase tracking-wider mb-1">Mentor Evaluation:</p>
            {analysis.ai_summary}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Detailed diagnostic is being prepared...</div>
        )}

        {/* Strengths & Weaknesses */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-destructive flex items-center gap-1.5">
              <Target className="h-4 w-4" /> Focus Areas (Low Accuracy)
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(analysis?.weak_topics ?? []).length > 0 ? (
                analysis.weak_topics.map((t: string) => (
                  <span key={t} className="rounded-lg bg-destructive/10 text-destructive text-xs font-semibold px-2.5 py-1">
                    {t}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">No weak topics flagged</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-success/20 bg-success/5 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-success flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Mastered Concepts
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(analysis?.strong_topics ?? []).length > 0 ? (
                analysis.strong_topics.map((t: string) => (
                  <span key={t} className="rounded-lg bg-success/10 text-success text-xs font-semibold px-2.5 py-1">
                    {t}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Continue practice across all chapters</span>
              )}
            </div>
          </div>
        </div>

        {/* 7-Day Plan */}
        {analysis?.study_plan && (
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> 7-Day Targeted Revision Schedule
            </div>
            <div className="space-y-1.5 text-xs text-foreground leading-relaxed pl-1">
              {analysis.study_plan.split("\n").filter(Boolean).map((line: string, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span>{line.replace(/^[•\s-]+/, "")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Subject-wise breakdown */}
      {Object.keys(subjects).length > 0 && (
        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold">Subject-Wise Breakdown</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(subjects).map(([s, v]: any) => {
              const att = v.correct + v.wrong;
              const acc = att ? Math.round((v.correct / att) * 100) : 0;
              return (
                <div key={s} className="rounded-xl border p-4 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold capitalize text-foreground">{s}</span>
                    <span className="font-bold text-sm text-primary">{acc}% Accuracy</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${acc}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span className="text-success font-medium">{v.correct} Correct</span>
                    <span className="text-destructive font-medium">{v.wrong} Wrong</span>
                    <span>{v.unattempted} Skipped</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chapter-wise breakdown */}
      {Object.keys(chapters).length > 0 && (
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 font-display text-lg font-bold">Chapter-Wise Accuracy</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b pb-2">
                <tr>
                  <th className="pb-2 text-left">Chapter / Topic</th>
                  <th className="pb-2 text-right">Correct</th>
                  <th className="pb-2 text-right">Wrong</th>
                  <th className="pb-2 text-right">Skipped</th>
                  <th className="pb-2 text-right">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                {Object.entries(chapters).map(([c, v]: any) => {
                  const att = v.correct + v.wrong;
                  const acc = att ? Math.round((v.correct / att) * 100) : 0;
                  return (
                    <tr key={c} className="hover:bg-muted/30">
                      <td className="py-2.5 font-medium">{c}</td>
                      <td className="py-2.5 text-right font-semibold text-success">+{v.correct}</td>
                      <td className="py-2.5 text-right font-semibold text-destructive">-{v.wrong}</td>
                      <td className="py-2.5 text-right text-muted-foreground">{v.unattempted}</td>
                      <td className="py-2.5 text-right font-bold text-foreground">{acc}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Question-by-Question Review */}
      {review.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" /> Question-by-Question Detailed Review
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review all {review.length} questions, your selected choices, correct answers, and full step-by-step solutions.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground mr-1">Filter:</span>
              <span className="rounded-lg bg-success/10 text-success text-xs font-bold px-2.5 py-1">
                ✓ {attempt.correct_count} Correct
              </span>
              <span className="rounded-lg bg-destructive/10 text-destructive text-xs font-bold px-2.5 py-1">
                ✗ {attempt.wrong_count} Wrong
              </span>
              <span className="rounded-lg bg-muted text-muted-foreground text-xs font-bold px-2.5 py-1">
                — {attempt.unattempted_count} Skipped
              </span>
            </div>
          </div>

          <div className="space-y-6 pt-2">
            {review.map((item, idx) => {
              const q = item.questions;
              const isCorrect = item.is_correct === true;
              const isWrong = item.selected_option && !isCorrect;
              const isSkipped = !item.selected_option;
              const letters = ["A", "B", "C", "D"];
              const timeM = Math.floor((item.time_spent_seconds || 0) / 60);
              const timeS = (item.time_spent_seconds || 0) % 60;

              let opts: Array<{ key: string; text: string; image_url?: string }> = [];
              if (Array.isArray(q.options)) {
                opts = letters.map((k, i) => {
                  const match = (q.options as any[]).find((o: any) => o?.key === k);
                  if (match) return { key: k, text: match.text || `Option ${k}`, image_url: match.image_url };
                  const raw = (q.options as any[])[i];
                  return { key: k, text: typeof raw === "string" ? raw : `Option ${k}` };
                });
              }

              return (
                <div
                  key={q.id || idx}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isCorrect
                      ? "border-success/30 bg-success/5"
                      : isWrong
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border bg-card"
                  }`}
                >
                  {/* Question header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-background text-xs font-bold shadow-xs border">
                        Q{q.order_index}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        {q.subject}{q.chapter ? ` · ${q.chapter}` : ""}
                      </span>
                      {item.time_spent_seconds > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium bg-background px-2 py-0.5 rounded-md border">
                          <Clock className="h-3 w-3 text-muted-foreground" /> {timeM > 0 ? `${timeM}m ${timeS}s` : `${timeS}s`}
                        </span>
                      )}
                    </div>

                    <div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                          isCorrect
                            ? "bg-success/15 text-success border border-success/30"
                            : isWrong
                            ? "bg-destructive/15 text-destructive border border-destructive/30"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                      >
                        {isCorrect ? "Correct (+4)" : isWrong ? "Incorrect (-1)" : "Not Attempted (0)"}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Question text */}
                    {q.question_text && (
                      <p className="text-sm font-medium text-foreground leading-relaxed whitespace-pre-wrap">
                        {q.question_text}
                      </p>
                    )}

                    {/* Question image */}
                    {q.question_image_url && (
                      <div className="max-w-2xl">
                        <ExamImage
                          src={q.question_image_url}
                          alt={`Question ${q.order_index}`}
                          maxHeightClass="max-h-[360px] sm:max-h-[440px]"
                        />
                      </div>
                    )}

                    {/* Options list */}
                    {opts.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {opts.map((op) => {
                          const isCorrectOpt = q.correct_option === op.key;
                          const isStudentOpt = item.selected_option === op.key;
                          const isWrongStudentOpt = isStudentOpt && !isCorrectOpt;

                          return (
                            <div
                              key={op.key}
                              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                                isCorrectOpt
                                  ? "border-success bg-success/15 ring-2 ring-success/30 font-semibold"
                                  : isWrongStudentOpt
                                  ? "border-destructive bg-destructive/15 ring-2 ring-destructive/30"
                                  : "border-border bg-background"
                              }`}
                            >
                              <span
                                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold border ${
                                  isCorrectOpt
                                    ? "bg-success text-white border-success"
                                    : isWrongStudentOpt
                                    ? "bg-destructive text-white border-destructive"
                                    : "bg-secondary text-foreground"
                                }`}
                              >
                                {op.key}
                              </span>

                              <div className="min-w-0 flex-1 pt-0.5 text-xs sm:text-sm">
                                {op.image_url && (
                                  <ExamImage
                                    src={op.image_url}
                                    alt={`Option ${op.key}`}
                                    maxHeightClass="max-h-28"
                                    showZoomButton={false}
                                    containerClassName="p-1 mb-1.5 border-0 bg-transparent"
                                  />
                                )}
                                <span>{op.text}</span>
                                {isCorrectOpt && (
                                  <span className="block mt-1 text-[11px] font-bold text-success">
                                    ✓ Correct Option
                                  </span>
                                )}
                                {isWrongStudentOpt && (
                                  <span className="block mt-1 text-[11px] font-bold text-destructive">
                                    ✗ Your Selected Answer
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Quick status bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background border p-3 text-xs">
                      <div className="flex items-center gap-4">
                        <span>
                          Your Answer:{" "}
                          <b className={isCorrect ? "text-success" : isWrong ? "text-destructive" : "text-muted-foreground"}>
                            {item.selected_option ? `Option (${item.selected_option})` : "Skipped"}
                          </b>
                        </span>
                        <span>
                          Correct Answer: <b className="text-success">Option ({q.correct_option})</b>
                        </span>
                      </div>
                    </div>

                    {/* Explanation / Solution block */}
                    {(q.solution_text || q.solution_image_url || q.solution_video_url) && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                          <BookOpen className="h-4 w-4" /> Explanation & Solution
                        </div>

                        {q.solution_text && (
                          <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                            {q.solution_text}
                          </p>
                        )}

                        {q.solution_image_url && (
                          <div className="max-w-2xl">
                            <ExamImage
                              src={q.solution_image_url}
                              alt={`Solution ${q.order_index}`}
                              maxHeightClass="max-h-80"
                            />
                          </div>
                        )}

                        {q.solution_video_url && (
                          <a
                            href={q.solution_video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-3.5 py-2 text-xs font-semibold hover:bg-primary/90 transition shadow-xs"
                          >
                            <PlayCircle className="h-4 w-4" /> Watch Video Solution on YouTube
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom navigation */}
      <div className="flex gap-3 pt-2">
        <Button asChild variant="outline" className="flex-1 h-11"><Link to="/app/tests">Attempt More Tests</Link></Button>
        <Button asChild className="flex-1 h-11"><Link to="/app">Back to Dashboard</Link></Button>
      </div>
    </div>
  );
}
