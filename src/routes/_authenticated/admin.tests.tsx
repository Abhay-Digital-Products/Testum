import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  ListChecks,
  Search,
  Copy,
  Upload,
  Lock,
  Loader2,
  ImageIcon,
  Sparkles,
  Calendar,
  BookOpen,
  Clock,
  ShieldCheck,
  FileText,
  X,
  ExternalLink,
} from "lucide-react";
import { QuickUpload } from "@/components/admin/quick-upload";

export const Route = createFileRoute("/_authenticated/admin/tests")({
  head: () => ({ meta: [{ title: "Admin - Tests & Questions - Testum" }] }),
  component: AdminTests,
});

const SUBJECTS = ["physics", "chemistry", "biology"] as const;
const KEYS = ["A", "B", "C", "D"] as const;
type Key = (typeof KEYS)[number];

function AdminTests() {
  const [series, setSeries] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeTest, setActiveTest] = useState<any | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [tab, setTab] = useState<"series" | "tests" | "questions">("series");
  const [qFilter, setQFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [editSeries, setEditSeries] = useState<any | null>(null);
  const [editTest, setEditTest] = useState<any | null>(null);

  const load = async () => {
    const { data: s } = await supabase
      .from("test_series")
      .select("*")
      .order("created_at", { ascending: false });
    setSeries(s ?? []);
    const { data: t } = await supabase
      .from("tests")
      .select("*, test_series(title, kind, plan_code, subject)")
      .order("created_at", { ascending: false });
    setTests(t ?? []);
    const { data: qs } = await supabase.from("questions").select("test_id");
    const map: Record<string, number> = {};
    for (const q of qs ?? []) map[q.test_id] = (map[q.test_id] ?? 0) + 1;
    setCounts(map);
  };
  useEffect(() => {
    load();
  }, []);

  const loadQuestions = async (test: any) => {
    setActiveTest(test);
    const { data } = await supabase
      .from("questions")
      .select("*")
      .eq("test_id", test.id)
      .order("order_index");
    setQuestions(data ?? []);
    setTab("questions");
  };

  const duplicateQuestion = async (q: any) => {
    const nextIdx = Math.max(0, ...questions.map((item) => item.order_index)) + 1;
    const { id, created_at, updated_at, ...rest } = q;
    const { error } = await supabase.from("questions").insert({ ...rest, order_index: nextIdx });
    if (error) return toast.error(error.message);
    toast.success("Duplicated as question #" + nextIdx);
    if (activeTest) loadQuestions(activeTest);
  };

  const visibleQuestions = useMemo(() => {
    const t = qFilter.trim().toLowerCase();
    return questions.filter((q) => {
      if (subjectFilter !== "all" && q.subject !== subjectFilter) return false;
      if (!t) return true;
      return [q.chapter, q.question_text, String(q.order_index)].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(t),
      );
    });
  }, [questions, qFilter, subjectFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Tests & Questions Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage Test Series, individual Tests (Paid or 100% Free), Syllabus, and Question Bank.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="series">1. Test Series ({series.length})</TabsTrigger>
          <TabsTrigger value="tests">2. Tests ({tests.length})</TabsTrigger>
          <TabsTrigger value="questions" disabled={!activeTest}>
            3. Questions {activeTest ? "(" + questions.length + ")" : ""}
          </TabsTrigger>
        </TabsList>

        {/* SERIES */}
        <TabsContent value="series" className="mt-4 space-y-3">
          <SeriesForm onSaved={load} />
          <div className="space-y-2">
            {series.length === 0 && (
              <p className="text-sm text-muted-foreground">No series created yet.</p>
            )}
            {series.map((s) => {
              const isFreeSeries = s.plan_code === "free" || !s.plan_code;
              return (
                <div
                  key={s.id}
                  className="rounded-2xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:shadow-xs transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-base">{s.title}</span>
                      <span
                        className={
                          "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                          (isFreeSeries
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-primary/10 text-primary border border-primary/20")
                        }
                      >
                        {isFreeSeries ? "100% Free Series" : s.kind + " plan"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Kind: <b className="capitalize">{s.kind}</b> · Subject:{" "}
                      <b className="capitalize">{s.subject}</b>
                      {s.description && " · " + s.description}
                    </div>
                  </div>
                  <div className="flex items-center shrink-0 gap-2 flex-wrap">
                    {s.planner_pdf_url ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-xl text-xs gap-1 font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800 hover:bg-purple-100 cursor-pointer"
                        >
                          <a href={s.planner_pdf_url} target="_blank" rel="noopener noreferrer">
                            <FileText className="h-3.5 w-3.5" /> View Planner PDF ↗
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditSeries(s)}
                          className="h-8 rounded-xl text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Change Planner PDF"
                        >
                          Replace
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditSeries(s)}
                        className="h-8 rounded-xl text-xs gap-1.5 font-semibold text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/40 hover:bg-purple-100 cursor-pointer"
                        title="Upload Planner PDF for this series"
                      >
                        <Upload className="h-3.5 w-3.5" /> Attach Planner PDF
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditSeries(s)}
                      title="Edit Series Details"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (confirm("Delete this series and all its tests?")) {
                          const { error } = await supabase
                            .from("test_series")
                            .delete()
                            .eq("id", s.id);
                          if (error) return toast.error(error.message);
                          toast.success("Series deleted");
                          load();
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {editSeries && (
            <SeriesForm
              existing={editSeries}
              onSaved={() => {
                setEditSeries(null);
                load();
              }}
              onClose={() => setEditSeries(null)}
            />
          )}
        </TabsContent>

        {/* TESTS */}
        <TabsContent value="tests" className="mt-4 space-y-3">
          <TestForm series={series} onSaved={load} />
          <div className="space-y-2">
            {tests.length === 0 && <p className="text-sm text-muted-foreground">No tests yet.</p>}
            {tests.map((t) => {
              const added = counts[t.id] ?? 0;
              const complete = added >= t.total_questions;
              const isStandalone = !t.series_id || !t.test_series;
              const isFree = isStandalone || t.is_free || t.test_series?.plan_code === "free";
              return (
                <div key={t.id} className="rounded-2xl border bg-card p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-semibold text-base">{t.title}</span>
                        {isStandalone ? (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                            STANDALONE FREE
                          </span>
                        ) : isFree ? (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                            100% FREE
                          </span>
                        ) : (
                          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
                            PAID ({t.test_series?.kind ?? "Plan"})
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        Series:{" "}
                        <b className="text-foreground">
                          {t.test_series?.title ?? "Standalone (No Series)"}
                        </b>{" "}
                        · {t.duration_minutes}m · +{t.marks_correct}/{t.marks_wrong}
                        {t.opens_at && " · Opens: " + new Date(t.opens_at).toLocaleString("en-IN")}
                      </div>

                      {t.syllabus && (
                        <div className="mt-1.5 flex items-start gap-1 text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border">
                          <BookOpen className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                          <span>
                            <b>Syllabus:</b> {t.syllabus}
                          </span>
                        </div>
                      )}

                      <div
                        className={
                          "mt-2 inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold " +
                          (complete
                            ? "bg-success/10 text-success"
                            : "bg-amber-500/10 text-amber-600")
                        }
                      >
                        {added}/{t.total_questions} questions {complete ? "ready" : "pending"}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="outline" size="sm" onClick={() => loadQuestions(t)}>
                        <ListChecks className="mr-1 h-3.5 w-3.5" />
                        Questions
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditTest(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (confirm("Delete this test?")) {
                            const { error } = await supabase.from("tests").delete().eq("id", t.id);
                            if (error) return toast.error(error.message);
                            toast.success("Test deleted");
                            load();
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {editTest && (
            <TestForm
              series={series}
              existing={editTest}
              onSaved={() => {
                setEditTest(null);
                load();
              }}
              onClose={() => setEditTest(null)}
            />
          )}
        </TabsContent>

        {/* QUESTIONS */}
        <TabsContent value="questions" className="mt-4 space-y-3">
          {activeTest && (
            <div className="rounded-2xl border bg-primary/5 p-3 text-sm flex items-center justify-between">
              <div>
                Managing questions for <b>{activeTest.title}</b> — {questions.length}/
                {activeTest.total_questions} added
              </div>
              <Button size="sm" variant="ghost" onClick={() => setTab("tests")}>
                ← Back to Tests
              </Button>
            </div>
          )}
          {activeTest && (
            <div className="flex flex-wrap gap-2">
              <QuickUpload
                testId={activeTest.id}
                defaultSubject={
                  activeTest.test_series?.subject && activeTest.test_series.subject !== "mixed"
                    ? activeTest.test_series.subject
                    : (Array.isArray(activeTest.subject_scope) && activeTest.subject_scope[0]) ||
                      "physics"
                }
                existingIndexes={questions.map((q) => q.order_index)}
                onSaved={() => loadQuestions(activeTest)}
              />
              <QuestionForm
                testId={activeTest.id}
                nextIndex={Math.max(0, ...questions.map((q) => q.order_index)) + 1}
                onSaved={() => loadQuestions(activeTest)}
              />
              <BulkImport testId={activeTest.id} onSaved={() => loadQuestions(activeTest)} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={qFilter}
                onChange={(e) => setQFilter(e.target.value)}
                placeholder="Search chapter, text or number"
                className="pl-9"
              />
            </div>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {visibleQuestions.length === 0 && (
              <p className="text-sm text-muted-foreground">No questions match.</p>
            )}
            {visibleQuestions.map((q) => (
              <div key={q.id} className="rounded-2xl border bg-card p-4">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-sm font-bold">
                    {q.order_index}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {q.subject}
                      {q.chapter ? " · " + q.chapter : ""}
                    </div>
                    {q.question_image_url && (
                      <img
                        src={q.question_image_url}
                        alt={"Question " + q.order_index}
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        loading="lazy"
                        className="mt-2 max-h-28 rounded-lg border object-contain bg-muted/20"
                      />
                    )}
                    <div className="mt-2 text-xs">
                      Correct: <b className="text-success">{q.correct_option}</b> · {q.option_type}{" "}
                      options
                      {q.solution_image_url || q.solution_text
                        ? " · solution added"
                        : " · no solution"}
                      {q.solution_video_url ? " · 🎥 video" : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(q)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => duplicateQuestion(q)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (confirm("Delete question?")) {
                          const { error } = await supabase
                            .from("questions")
                            .delete()
                            .eq("id", q.id);
                          if (error) return toast.error(error.message);
                          toast.success("Deleted");
                          loadQuestions(activeTest);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {editing && activeTest && (
            <QuestionForm
              testId={activeTest.id}
              nextIndex={editing.order_index}
              existing={editing}
              onSaved={() => {
                setEditing(null);
                loadQuestions(activeTest);
              }}
              onClose={() => setEditing(null)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Series Form (with Planner PDF Upload) ---------------- */

function SeriesForm({
  existing,
  onSaved,
  onClose,
}: {
  existing?: any;
  onSaved: () => void;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(!!existing);
  const [kind, setKind] = useState(existing?.kind ?? "chapter");
  const [subject, setSubject] = useState(existing?.subject ?? "mixed");
  const [planCode, setPlanCode] = useState(existing ? (existing.plan_code ?? "free") : "chapter");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [plannerPdfUrl, setPlannerPdfUrl] = useState(existing?.planner_pdf_url ?? "");
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [busy, setBusy] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const close = (o: boolean) => {
    setOpen(o);
    if (!o) onClose?.();
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return toast.error("Please select a valid PDF file");
    }

    if (file.size > 25 * 1024 * 1024) {
      return toast.error("PDF size should be under 25MB");
    }

    setUploadingPdf(true);
    try {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `planner_${Date.now()}_${sanitizedName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("planners")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("planners").getPublicUrl(uploadData.path);

      setPlannerPdfUrl(publicData.publicUrl);
      toast.success("Planner PDF uploaded successfully!");
    } catch (err: any) {
      toast.error("Upload failed: " + (err.message || err));
    } finally {
      setUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload: any = {
      kind,
      subject,
      title: title.trim(),
      description: description.trim() || null,
      plan_code: planCode === "free" ? null : planCode,
      planner_pdf_url: plannerPdfUrl.trim() || null,
    };
    let error;
    if (existing) {
      ({ error } = await supabase.from("test_series").update(payload).eq("id", existing.id));
    } else {
      const { data: u } = await supabase.auth.getUser();
      ({ error } = await supabase
        .from("test_series")
        .insert({ ...payload, created_by: u.user?.id }));
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Series updated" : "Series created");
    if (!existing) {
      setTitle("");
      setDescription("");
      setPlannerPdfUrl("");
    }
    close(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      {!existing && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-1 h-4 w-4" />
            New Test Series
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Test Series" : "Create Test Series"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category / Kind</Label>
              <Select
                value={kind}
                onValueChange={(v: any) => {
                  setKind(v);
                  if (planCode !== "free") setPlanCode(v);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chapter">Chapter-wise</SelectItem>
                  <SelectItem value="part">Part syllabus</SelectItem>
                  <SelectItem value="full">Full syllabus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Select value={subject} onValueChange={(v: any) => setSubject(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                  <SelectItem value="mixed">Mixed (PCB)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-sm font-semibold">Access / Payment Requirement</Label>
            <Select value={planCode} onValueChange={setPlanCode}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">✨ 100% Free Series (No plan needed)</SelectItem>
                <SelectItem value="chapter">Chapter Plan (Unlocked by Chapter / Combo)</SelectItem>
                <SelectItem value="part">Part Plan (Unlocked by Part / Combo)</SelectItem>
                <SelectItem value="full">Full Mock Plan (Unlocked by Full / Combo)</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {planCode === "free"
                ? "All tests in this series will be accessible to all students for free."
                : "Students must have an active entitlement to attempt tests in this series."}
            </p>
          </div>

          <div>
            <Label>Series Title</Label>
            <Input
              className="mt-1"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Physics · Chapter-wise Master Series"
            />
          </div>

          <div>
            <Label>Description (Optional)</Label>
            <Textarea
              className="mt-1"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Syllabus overview or batch notes..."
            />
          </div>

          {/* Planner PDF Upload Section */}
          <div className="rounded-2xl border bg-muted/20 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" /> Series Study Planner PDF
              </Label>
              {plannerPdfUrl && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                  PDF Attached
                </span>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Upload the complete study plan / test schedule PDF for this series so students can
              view and download it directly.
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                onChange={handlePdfUpload}
                className="hidden"
                id="series-planner-pdf"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => pdfInputRef.current?.click()}
                disabled={uploadingPdf}
                className="h-9 rounded-xl text-xs gap-1.5 font-semibold cursor-pointer shrink-0"
              >
                {uploadingPdf ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading PDF…
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 text-primary" /> Upload Planner PDF
                  </>
                )}
              </Button>

              {plannerPdfUrl && (
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    asChild
                    className="h-9 rounded-xl text-xs gap-1 font-semibold truncate cursor-pointer"
                  >
                    <a href={plannerPdfUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> View PDF
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setPlannerPdfUrl("")}
                    className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10 cursor-pointer"
                    title="Remove PDF"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Direct URL input fallback */}
            <div>
              <Input
                value={plannerPdfUrl}
                onChange={(e) => setPlannerPdfUrl(e.target.value)}
                placeholder="Or paste direct PDF link (e.g. Google Drive, CDN)..."
                className="h-8 text-xs rounded-lg"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="submit" disabled={busy || uploadingPdf} className="cursor-pointer">
              {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {existing ? "Save changes" : "Create Series"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Test Form (with Syllabus, Date & Free Toggle) ---------------- */

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TestForm({
  series,
  existing,
  onSaved,
  onClose,
}: {
  series: any[];
  existing?: any;
  onSaved: () => void;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(!!existing);
  const [seriesId, setSeriesId] = useState(existing?.series_id ? existing.series_id : "standalone");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [duration, setDuration] = useState(existing?.duration_minutes ?? 180);
  const [totalQ, setTotalQ] = useState(existing?.total_questions ?? 180);
  const [mc, setMc] = useState(Number(existing?.marks_correct ?? 4));
  const [mw, setMw] = useState(Number(existing?.marks_wrong ?? -1));
  const [opensAt, setOpensAt] = useState(toLocalInput(existing?.opens_at));
  const [syllabus, setSyllabus] = useState(existing?.syllabus ?? "");
  const [isFree, setIsFree] = useState(Boolean(existing?.is_free ?? true));
  const [scope, setScope] = useState<string[]>(
    existing?.subject_scope ?? ["physics", "chemistry", "biology"],
  );
  const [busy, setBusy] = useState(false);

  const close = (o: boolean) => {
    setOpen(o);
    if (!o) onClose?.();
  };
  const toggleScope = (s: string) =>
    setScope((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scope.length === 0) return toast.error("Pick at least one subject");
    setBusy(true);

    const isStandalone = !seriesId || seriesId === "standalone";
    const payload: any = {
      series_id: isStandalone ? null : seriesId,
      title: title.trim(),
      duration_minutes: duration,
      total_questions: totalQ,
      marks_correct: mc,
      marks_wrong: mw,
      opens_at: new Date(opensAt).toISOString(),
      syllabus: syllabus.trim() || null,
      is_free: isStandalone ? true : isFree,
      subject_scope: scope,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existing) {
      ({ error } = await supabase.from("tests").update(payload).eq("id", existing.id));
    } else {
      const { data: u } = await supabase.auth.getUser();
      ({ error } = await supabase.from("tests").insert({ ...payload, created_by: u.user?.id }));
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Test updated" : "Test created successfully");
    if (!existing) setTitle("");
    close(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      {!existing && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-1 h-4 w-4" />
            New Test
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Test" : "Create New Test"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-1">
          {/* Series Selection */}
          <div>
            <Label className="text-sm font-semibold">Test Category & Series</Label>
            <Select
              value={seriesId}
              onValueChange={(id) => {
                setSeriesId(id);
                if (id === "standalone") {
                  setIsFree(true);
                } else {
                  const s = series.find((item) => item.id === id);
                  if (
                    s &&
                    (!s.plan_code ||
                      s.plan_code === "free" ||
                      s.title?.toLowerCase().includes("free"))
                  ) {
                    setIsFree(true);
                  }
                }
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select test series" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standalone">
                  ✨ Standalone Free Test (No Series / 100% Free Practice)
                </SelectItem>
                {series.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title} ({s.kind} - {!s.plan_code || s.plan_code === "free" ? "Free" : "Paid"}
                    )
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {!seriesId || seriesId === "standalone"
                ? "This test will appear as a standalone test in the Free Practice Tests section."
                : "This test will appear under its respective category series."}
            </p>
          </div>

          {/* Test Title */}
          <div>
            <Label className="text-sm font-semibold">Test Title</Label>
            <Input
              className="mt-1"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="NEET Full Mock Test - 01"
            />
          </div>

          {/* Free Test Checkbox / Toggle */}
          <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-50/60 p-3.5 flex items-start gap-3">
            <input
              type="checkbox"
              id="isFreeTestCheckbox"
              checked={isFree}
              onChange={(e) => setIsFree(e.target.checked)}
              className="mt-1 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="isFreeTestCheckbox" className="text-xs leading-relaxed cursor-pointer">
              <span className="font-bold text-emerald-800 block text-sm">
                Make this test 100% Free
              </span>
              Check this to make this test available to all students for free without purchasing a
              plan. It will appear under the Free Tests tab.
            </label>
          </div>

          {/* Syllabus / Topics covered */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-primary" /> Test Syllabus & Covered Topics
            </Label>
            <Textarea
              className="mt-1 text-xs"
              rows={3}
              value={syllabus}
              onChange={(e) => setSyllabus(e.target.value)}
              placeholder="e.g. Physics: Kinematics, Laws of Motion&#10;Chemistry: Chemical Bonding, Periodic Table&#10;Biology: Cell Structure and Function"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Students see this syllabus on the test browser card and instructions screen before
              starting.
            </p>
          </div>

          {/* Scheduled Date (Opens at) */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" /> Scheduled Date & Time (Opens At)
            </Label>
            <Input
              type="datetime-local"
              className="mt-1 text-sm"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
            />
          </div>

          {/* Test Parameters */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Duration (Minutes)</Label>
              <Input
                type="number"
                className="mt-1"
                value={duration}
                onChange={(e) => setDuration(+e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Total Questions</Label>
              <Input
                type="number"
                className="mt-1"
                value={totalQ}
                onChange={(e) => setTotalQ(+e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Marks for Correct (+)</Label>
              <Input
                type="number"
                className="mt-1"
                value={mc}
                onChange={(e) => setMc(+e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Marks for Wrong (-)</Label>
              <Input
                type="number"
                className="mt-1"
                value={mw}
                onChange={(e) => setMw(+e.target.value)}
              />
            </div>
          </div>

          {/* Subject Scope */}
          <div>
            <Label className="text-xs font-semibold">Subjects included</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SUBJECTS.map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={scope.includes(s) ? "default" : "outline"}
                  className="capitalize text-xs h-8"
                  onClick={() => toggleScope(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {existing ? "Save changes" : "Create Test"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Question Form & Bulk Import ---------------- */

function optValue(options: any, k: Key, type: string) {
  const o = Array.isArray(options) ? options.find((x: any) => x?.key === k) : null;
  return (type === "image" ? o?.image_url : o?.text) ?? "";
}

function QuestionForm({
  testId,
  nextIndex,
  existing,
  onSaved,
  onClose,
}: {
  testId: string;
  nextIndex: number;
  existing?: any;
  onSaved: () => void;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(!!existing);
  const [orderIndex, setOrderIndex] = useState(existing?.order_index ?? nextIndex);
  const [subject, setSubject] = useState(existing?.subject ?? "physics");
  const [chapter, setChapter] = useState(existing?.chapter ?? "");
  const [qImg, setQImg] = useState(existing?.question_image_url ?? "");
  const [qText, setQText] = useState(existing?.question_text ?? "");
  const [optionType, setOptionType] = useState<"image" | "text">(existing?.option_type ?? "text");
  const [opts, setOpts] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        KEYS.map((k) => [k, existing ? optValue(existing.options, k, existing.option_type) : ""]),
      ) as Record<string, string>,
  );
  const [correct, setCorrect] = useState<Key>((existing?.correct_option as Key) ?? "A");
  const [solImg, setSolImg] = useState(existing?.solution_image_url ?? "");
  const [solText, setSolText] = useState(existing?.solution_text ?? "");
  const [solVideo, setSolVideo] = useState(existing?.solution_video_url ?? "");
  const [busy, setBusy] = useState(false);
  const [keepOpen, setKeepOpen] = useState(true);

  useEffect(() => {
    if (!existing) setOrderIndex(nextIndex);
  }, [nextIndex, existing]);
  const close = (o: boolean) => {
    setOpen(o);
    if (!o) onClose?.();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qImg && !qText) return toast.error("Add a question image URL or text");
    setBusy(true);
    const options = KEYS.map((k) =>
      optionType === "image" ? { key: k, image_url: opts[k] } : { key: k, text: opts[k] },
    );
    const payload: any = {
      test_id: testId,
      order_index: orderIndex,
      subject,
      chapter: chapter || null,
      question_image_url: qImg || null,
      question_text: qText || null,
      option_type: optionType,
      options,
      correct_option: correct,
      solution_image_url: solImg || null,
      solution_text: solText || null,
      solution_video_url: solVideo.trim() || null,
    };
    const { error } = existing
      ? await supabase.from("questions").update(payload).eq("id", existing.id)
      : await supabase.from("questions").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Question updated" : "Question " + orderIndex + " added");
    if (!existing) {
      setQImg("");
      setQText("");
      setOpts({ A: "", B: "", C: "", D: "" });
      setSolImg("");
      setSolText("");
      setSolVideo("");
      setOrderIndex(orderIndex + 1);
      if (!keepOpen) close(false);
    } else close(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      {!existing && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-1 h-4 w-4" />
            Add Question
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit question #" + existing.order_index : "Add question #" + orderIndex}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Order #</Label>
              <Input
                type="number"
                value={orderIndex}
                onChange={(e) => setOrderIndex(+e.target.value)}
              />
            </div>
            <div>
              <Label>Subject</Label>
              <Select value={subject} onValueChange={(v: any) => setSubject(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chapter</Label>
              <Input
                value={chapter ?? ""}
                onChange={(e) => setChapter(e.target.value)}
                placeholder="Kinematics"
              />
            </div>
          </div>

          <div>
            <Label>Question image URL</Label>
            <Input
              value={qImg ?? ""}
              onChange={(e) => setQImg(e.target.value)}
              placeholder="https://cdn.example.com/q1.png"
            />
          </div>
          {qImg && <img src={qImg} alt="Question preview" className="max-h-40 rounded-lg border" />}
          <div>
            <Label>Or question text</Label>
            <Textarea value={qText ?? ""} onChange={(e) => setQText(e.target.value)} rows={2} />
          </div>

          <div>
            <Label>Option type</Label>
            <Select value={optionType} onValueChange={(v: any) => setOptionType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="image">Image URLs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {KEYS.map((k) => (
              <div
                key={k}
                className={
                  "rounded-xl border p-2.5 " + (correct === k ? "border-success bg-success/5" : "")
                }
              >
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Option {k}</Label>
                  <button
                    type="button"
                    onClick={() => setCorrect(k)}
                    className={
                      "rounded-md px-2 py-0.5 text-[11px] font-semibold " +
                      (correct === k
                        ? "bg-success text-white"
                        : "bg-secondary text-muted-foreground")
                    }
                  >
                    {correct === k ? "Correct" : "Mark correct"}
                  </button>
                </div>
                <Input
                  required
                  className="mt-1.5"
                  value={opts[k]}
                  onChange={(e) => setOpts((p) => ({ ...p, [k]: e.target.value }))}
                  placeholder={optionType === "image" ? "https://…" : "Option text"}
                />
                {optionType === "image" && opts[k] && (
                  <img
                    src={opts[k]}
                    alt={"Option " + k}
                    className="mt-1.5 max-h-16 rounded border"
                  />
                )}
              </div>
            ))}
          </div>

          <div>
            <Label>Solution image URL (optional)</Label>
            <Input value={solImg ?? ""} onChange={(e) => setSolImg(e.target.value)} />
          </div>
          <div>
            <Label>Solution text (optional)</Label>
            <Textarea value={solText ?? ""} onChange={(e) => setSolText(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Video solution - YouTube link (optional)</Label>
            <Input
              value={solVideo ?? ""}
              onChange={(e) => setSolVideo(e.target.value)}
              placeholder="https://youtu.be/xxxxxxxxxxx"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Shown to students in the result analysis of this test.
            </p>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
            {!existing && (
              <label className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={keepOpen}
                  onChange={(e) => setKeepOpen(e.target.checked)}
                />
                Keep open to add the next question
              </label>
            )}
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {existing ? "Save changes" : "Save question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Bulk Import ---------------- */

const SAMPLE = `[
  {
    "order_index": 1,
    "subject": "physics",
    "chapter": "Kinematics",
    "question_image_url": "https://cdn.example.com/q1.png",
    "option_type": "text",
    "options": ["10 m/s", "20 m/s", "30 m/s", "40 m/s"],
    "correct_option": "B",
    "solution_image_url": "https://cdn.example.com/s1.png"
  }
]`;

function BulkImport({ testId, onSaved }: { testId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return toast.error("That isn't valid JSON");
    }
    if (!Array.isArray(parsed) || parsed.length === 0)
      return toast.error("Provide a non-empty JSON array");

    const rows: any[] = [];
    for (const [i, q] of parsed.entries()) {
      const key = String(q.correct_option ?? "").toUpperCase();
      if (!KEYS.includes(key as Key))
        return toast.error("Item " + (i + 1) + ": correct_option must be A, B, C or D");
      if (!q.question_image_url && !q.question_text)
        return toast.error("Item " + (i + 1) + ": needs a question image URL or text");
      const type = q.option_type === "image" ? "image" : "text";
      const arr = Array.isArray(q.options) ? q.options : [];
      if (arr.length !== 4)
        return toast.error("Item " + (i + 1) + ": options must be an array of 4 values");
      rows.push({
        test_id: testId,
        order_index: Number(q.order_index ?? i + 1),
        subject: q.subject ?? "physics",
        chapter: q.chapter ?? null,
        question_image_url: q.question_image_url ?? null,
        question_text: q.question_text ?? null,
        option_type: type,
        options: KEYS.map((k, idx) =>
          type === "image"
            ? { key: k, image_url: String(arr[idx]) }
            : { key: k, text: String(arr[idx]) },
        ),
        correct_option: key,
        solution_image_url: q.solution_image_url ?? null,
        solution_text: q.solution_text ?? null,
        solution_video_url: q.solution_video_url ?? null,
      });
    }

    setBusy(true);
    const { error } = await supabase.from("questions").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(rows.length + " questions imported");
    setRaw("");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-1 h-4 w-4" />
          Bulk import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk import questions</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste a JSON array. Each item needs 4 options and a correct option (A–D).
          </p>
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={14}
            className="font-mono text-xs"
            placeholder={SAMPLE}
          />
          <div className="flex items-center gap-2 rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
            <ImageIcon className="h-4 w-4 shrink-0" />
            Question and option images are referenced by URL - host them anywhere public.
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRaw(SAMPLE)}>
              Insert sample
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Import
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
