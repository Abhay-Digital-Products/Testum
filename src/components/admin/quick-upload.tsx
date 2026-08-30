import { useMemo, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, Zap, CheckCircle2, AlertTriangle,
  ImageIcon, Key, Layers, Eye, ChevronRight,
  ChevronLeft, Upload, RefreshCw, X, Pencil,
} from "lucide-react";

const KEYS = ["A", "B", "C", "D"] as const;

/* ─────────────────── Parsers ─────────────────── */

/**
 * Extract a question number from a URL filename.
 * Skips date-like numbers (≥6 digits) and time-like numbers (≥5 digits),
 * preferring the LAST short number found in the filename stem.
 */
export function numberFromUrl(url: string): number | null {
  const clean = url.split("?")[0].split("#")[0];
  const file = clean.substring(clean.lastIndexOf("/") + 1);
  // Remove extension
  const stem = file.replace(/\.[^.]+$/, "");
  // Find all numeric groups; prefer those ≤ 4 digits (real Q numbers, not dates)
  const allNums = [...stem.matchAll(/\d+/g)].map((m) => Number(m[0]));
  const shortNums = allNums.filter((n) => n <= 9999 && n >= 1);
  if (shortNums.length > 0) return shortNums[shortNums.length - 1]; // last short number
  return null; // caller will fall back to sequential
}

export function parseUrls(raw: string): string[] {
  const matches = raw.replace(/[\u200e\u200f\u202a-\u202e]/g, "").match(/https?:\/\/\S+/gi) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const url = m.replace(/[),.;]+$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function parseAnswerKey(raw: string): Record<number, string> {
  const text = raw.replace(/[\u200e\u200f\u202a-\u202e]/g, "").toUpperCase();
  const out: Record<number, string> = {};
  const numbered = [...text.matchAll(/(\d+)\s*[).:\ \-]?\s*([ABCD])(?![A-Z])/g)];
  if (numbered.length) {
    for (const m of numbered) out[Number(m[1])] = m[2];
    return out;
  }
  const letters = text.match(/[ABCD]/g) ?? [];
  letters.forEach((l, i) => (out[i + 1] = l));
  return out;
}

export function parseSubjectRanges(raw: string): Array<{ subject: string; from: number; to: number }> {
  const out: Array<{ subject: string; from: number; to: number }> = [];
  for (const part of raw.split(",")) {
    const m = part.trim().match(/^([a-zA-Z]+)\s*:\s*(\d+)\s*[-–]\s*(\d+)$/);
    if (m) out.push({ subject: m[1].toLowerCase(), from: Number(m[2]), to: Number(m[3]) });
  }
  return out;
}

function subjectFor(n: number, ranges: ReturnType<typeof parseSubjectRanges>, fallback: string) {
  return ranges.find((r) => n >= r.from && n <= r.to)?.subject ?? fallback;
}

type Row = { n: number; url: string; answer?: string; subject: string; solution?: string };

const STEPS = [
  { id: "questions", label: "Images",     icon: ImageIcon },
  { id: "answers",   label: "Answer Key", icon: Key },
  { id: "settings",  label: "Settings",   icon: Layers },
  { id: "review",    label: "Review",     icon: Eye },
] as const;
type Step = (typeof STEPS)[number]["id"];

/* ─────────────────── Component ─────────────────── */

export function QuickUpload({
  testId,
  defaultSubject = "physics",
  existingIndexes = [],
  onSaved,
}: {
  testId: string;
  defaultSubject?: string;
  existingIndexes?: number[];
  onSaved: () => void;
}) {
  const [open, setOpen]           = useState(false);
  const [step, setStep]           = useState<Step>("questions");
  const [urlsRaw, setUrlsRaw]     = useState("");
  const [keyRaw, setKeyRaw]       = useState("");
  const [solutionsRaw, setSolutionsRaw] = useState("");
  const [rangesRaw, setRangesRaw] = useState("physics:1-45, chemistry:46-90, biology:91-180");
  const [chapter, setChapter]     = useState("");
  const [startAt, setStartAt]     = useState("");
  const [busy, setBusy]           = useState(false);
  const [progress, setProgress]   = useState(0);
  const [dragOver, setDragOver]   = useState(false);
  /** Manual answer overrides from the review table */
  const [answerOverrides, setAnswerOverrides] = useState<Record<number, string>>({});
  const [editingRow, setEditingRow] = useState<number | null>(null);

  const resetAll = () => {
    setStep("questions"); setUrlsRaw(""); setKeyRaw(""); setSolutionsRaw("");
    setChapter(""); setStartAt(""); setProgress(0); setAnswerOverrides({}); setEditingRow(null);
  };
  const handleClose = (v: boolean) => { if (!busy) { setOpen(v); if (!v) resetAll(); } };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const urls = parseUrls(e.clipboardData.getData("text"));
    if (urls.length > 0) { setUrlsRaw((p) => (p ? p + "\n" + urls.join("\n") : urls.join("\n"))); e.preventDefault(); }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const urls = parseUrls(e.dataTransfer.getData("text"));
    if (urls.length > 0) setUrlsRaw((p) => (p ? p + "\n" + urls.join("\n") : urls.join("\n")));
  }, []);

  /* ── Derived rows (no overrides applied yet) ── */
  const { rows: baseRows, duplicates } = useMemo(() => {
    const urls    = parseUrls(urlsRaw);
    const key     = parseAnswerKey(keyRaw);
    const solUrls = parseUrls(solutionsRaw);
    const ranges  = parseSubjectRanges(rangesRaw);
    const offset  = startAt.trim() ? Number(startAt) - 1 : 0;

    const solByN: Record<number, string> = {};
    solUrls.forEach((u, i) => { const n = numberFromUrl(u); solByN[n ?? i + 1] = u; });

    const seen = new Set<number>(); const dup: number[] = [];
    const rows: Row[] = urls.map((url, i) => {
      const detected = numberFromUrl(url);
      const n = (detected ?? i + 1) + (detected ? 0 : offset);
      if (seen.has(n)) dup.push(n); seen.add(n);
      return { n, url, answer: key[n], subject: subjectFor(n, ranges, defaultSubject), solution: solByN[n] };
    });
    rows.sort((a, b) => a.n - b.n);
    return { rows, duplicates: dup };
  }, [urlsRaw, keyRaw, solutionsRaw, rangesRaw, startAt, defaultSubject]);

  /* Apply manual overrides on top */
  const rows: Row[] = useMemo(
    () => baseRows.map((r) => ({ ...r, answer: answerOverrides[r.n] ?? r.answer })),
    [baseRows, answerOverrides],
  );

  const missingAnswers = rows.filter((r) => !r.answer).map((r) => r.n);
  const clashes        = rows.filter((r) => existingIndexes.includes(r.n)).map((r) => r.n);
  const answeredCount  = rows.filter((r) => r.answer).length;
  const readyToUpload  = rows.length > 0 && missingAnswers.length === 0 && duplicates.length === 0;
  const urlCount       = parseUrls(urlsRaw).length;

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const canNext = () => {
    if (step === "questions") return urlCount > 0;
    if (step === "answers")   return keyRaw.trim().length > 0;
    return true;
  };
  const goNext = () => { const n = STEPS[stepIdx + 1]; if (n) setStep(n.id); };
  const goBack = () => { const p = STEPS[stepIdx - 1]; if (p) setStep(p.id); };

  /* ── Upload ── */
  const submit = async () => {
    if (!rows.length) return toast.error("Paste some image URLs first");
    if (missingAnswers.length) return toast.error(`Missing answer for Q${missingAnswers.slice(0, 5).join(", Q")}${missingAnswers.length > 5 ? "…" : ""}`);
    if (duplicates.length) return toast.error(`Duplicate question numbers: ${[...new Set(duplicates)].join(", ")}`);
    setBusy(true); setProgress(0);
    try {
      if (clashes.length) {
        const { error } = await supabase.from("questions").delete().eq("test_id", testId).in("order_index", clashes);
        if (error) throw error;
      }
      const payload = rows.map((r) => ({
        test_id: testId, order_index: r.n, subject: r.subject, chapter: chapter.trim() || null,
        question_image_url: r.url, question_text: null, option_type: "text" as const,
        options: KEYS.map((k) => ({ key: k, text: k })), correct_option: r.answer!,
        solution_image_url: r.solution ?? null,
      }));
      const CHUNK = 100;
      for (let i = 0; i < payload.length; i += CHUNK) {
        const { error } = await supabase.from("questions").insert(payload.slice(i, i + CHUNK) as any);
        if (error) throw error;
        setProgress(i + Math.min(CHUNK, payload.length - i));
      }
      toast.success(`${payload.length} questions uploaded`);
      setOpen(false); resetAll(); onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="default">
          <Zap className="mr-1.5 h-4 w-4" /> Fast Upload
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-2xl flex flex-col overflow-hidden p-0 gap-0 rounded-2xl sm:rounded-3xl shadow-2xl">

        {/* ── Header ── */}
        <div className="shrink-0 border-b px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="font-display text-lg font-bold flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                <Zap className="h-4 w-4" />
              </div>
              Fast Question Upload
            </DialogTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => handleClose(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Step pills */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => {
              const isActive = s.id === step;
              const isDone   = i < stepIdx;
              const StepIcon = s.icon;
              return (
                <div key={s.id} className="flex items-center gap-1.5 flex-1">
                  <button
                    type="button"
                    onClick={() => (isDone || isActive) ? setStep(s.id) : undefined}
                    className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all truncate ${
                      isActive ? "bg-primary text-primary-foreground"
                      : isDone  ? "bg-success/10 text-success cursor-pointer hover:bg-success/20"
                      :           "bg-muted text-muted-foreground cursor-default"
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <StepIcon className="h-3 w-3 shrink-0" />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`h-px flex-1 rounded-full transition-colors ${isDone ? "bg-success/30" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {/* Step 1 — Images */}
          {step === "questions" && (
            <div className="space-y-3 animate-in fade-in-50 slide-in-from-right-2 duration-200">
              <div className="rounded-xl border bg-secondary/40 p-3 text-xs text-muted-foreground leading-relaxed">
                Paste all question image URLs (any order). The question number is detected from the filename —{" "}
                <code className="rounded bg-card border px-1 text-foreground font-mono">/12.jpg</code> → Q12.
                Date-based filenames (e.g. <code className="rounded bg-card border px-1 font-mono">IMG-20260816-…</code>) are handled sequentially.
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`relative rounded-xl border-2 border-dashed transition-all duration-200 ${
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <Textarea
                  value={urlsRaw}
                  onChange={(e) => setUrlsRaw(e.target.value)}
                  onPaste={handlePaste}
                  rows={10}
                  className="font-mono text-xs border-0 bg-transparent focus-visible:ring-0 resize-none"
                  placeholder={"Paste image links here:\nhttps://i.postimg.cc/k44RbL82/1.jpg\nhttps://i.postimg.cc/pyNm3TS8/2.jpg\n…"}
                />
                {dragOver && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-primary/5">
                    <div className="flex flex-col items-center gap-2 text-primary">
                      <Upload className="h-7 w-7" />
                      <span className="font-semibold text-sm">Drop URLs here</span>
                    </div>
                  </div>
                )}
              </div>

              {urlCount > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-3 py-2 animate-in fade-in-50">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  <span className="text-sm font-semibold text-success">{urlCount} image URLs detected</span>
                  <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs rounded-lg" onClick={() => setUrlsRaw("")}>
                    <RefreshCw className="mr-1 h-3 w-3" /> Clear
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Answer Key */}
          {step === "answers" && (
            <div className="space-y-3 animate-in fade-in-50 slide-in-from-right-2 duration-200">
              <div className="rounded-xl border bg-secondary/40 p-3 text-xs text-muted-foreground leading-relaxed">
                Paste the answer key in any format:
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {[
                    ["Numbered", "1) A, 2) B, 3) D"],
                    ["Dotted",   "1.A 2.B 3.D"],
                    ["Spaced",   "A B C D A B"],
                    ["Compact",  "ABCDA…"],
                  ].map(([l, ex]) => (
                    <div key={l} className="rounded-lg border bg-card px-2 py-1.5">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground">{l}</div>
                      <code className="text-xs font-mono text-foreground">{ex}</code>
                    </div>
                  ))}
                </div>
              </div>

              <Textarea
                value={keyRaw}
                onChange={(e) => setKeyRaw(e.target.value)}
                rows={8}
                className="font-mono text-xs"
                placeholder="1) A, 2) B, 3) D, 4) A, 5) C…"
                autoFocus
              />

              {rows.length > 0 && (
                <div className="rounded-xl border bg-card p-3 space-y-2 animate-in fade-in-50">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>{rows.length} questions · {answeredCount} answered</span>
                    <span className={answeredCount === rows.length ? "text-success" : "text-warning"}>
                      {Math.round((answeredCount / rows.length) * 100)}% matched
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${answeredCount === rows.length ? "bg-success" : "bg-warning"}`}
                      style={{ width: rows.length ? `${(answeredCount / rows.length) * 100}%` : "0%" }}
                    />
                  </div>
                  {missingAnswers.length > 0 && (
                    <div className="flex items-start gap-2 text-xs text-warning rounded-lg bg-warning/8 p-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                      Missing: Q{missingAnswers.slice(0, 15).join(", Q")}{missingAnswers.length > 15 ? ` +${missingAnswers.length - 15} more` : ""}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Settings */}
          {step === "settings" && (
            <div className="space-y-4 animate-in fade-in-50 slide-in-from-right-2 duration-200">
              <div className="rounded-xl border bg-secondary/40 p-3 text-xs text-muted-foreground leading-relaxed">
                Set subject ranges and optional metadata. Leave defaults for NEET PCB (Physics 1-45, Chemistry 46-90, Biology 91-180).
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Subject ranges by question number</Label>
                <Input value={rangesRaw} onChange={(e) => setRangesRaw(e.target.value)} className="font-mono text-xs" />
                <p className="text-[11px] text-muted-foreground">Example: <code>physics:1-45, chemistry:46-90, biology:91-180</code></p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Chapter (optional)</Label>
                  <Input value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="e.g. Kinematics" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Start numbering at</Label>
                  <Input value={startAt} onChange={(e) => setStartAt(e.target.value)} inputMode="numeric" placeholder="1" />
                  <p className="text-[11px] text-muted-foreground">Only needed if filenames have no numbers</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Solution image URLs (optional)</Label>
                <Textarea
                  value={solutionsRaw}
                  onChange={(e) => setSolutionsRaw(e.target.value)}
                  rows={4}
                  className="font-mono text-xs"
                  placeholder="Paste solution image links here (same numbering as questions)"
                />
              </div>
            </div>
          )}

          {/* Step 4 — Review + inline answer editing */}
          {step === "review" && (
            <div className="space-y-4 animate-in fade-in-50 slide-in-from-right-2 duration-200">
              {/* Summary tiles */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Questions",  value: rows.length,                              tint: "bg-primary/8 text-primary" },
                  { label: "Answered",   value: answeredCount,                            tint: answeredCount === rows.length ? "bg-success/10 text-success" : "bg-warning/10 text-warning" },
                  { label: "With Sol.",  value: rows.filter((r) => r.solution).length,    tint: "bg-muted text-muted-foreground" },
                  { label: "Replacing",  value: clashes.length,                           tint: clashes.length > 0 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground" },
                ].map(({ label, value, tint }) => (
                  <div key={label} className={`rounded-xl border p-3 text-center ${tint}`}>
                    <div className="font-display text-2xl font-bold tabular-nums">{value}</div>
                    <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</div>
                  </div>
                ))}
              </div>

              {/* Error banners */}
              {!readyToUpload && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1.5 text-xs text-destructive">
                  {missingAnswers.length > 0 && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        Missing answers: Q{missingAnswers.slice(0, 12).join(", Q")}
                        {missingAnswers.length > 12 ? ` +${missingAnswers.length - 12} more` : ""}
                        {" "}<span className="font-semibold underline">— click any row below to set the answer</span>
                      </span>
                    </div>
                  )}
                  {duplicates.length > 0 && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      Duplicate numbers: {[...new Set(duplicates)].join(", ")}
                    </div>
                  )}
                </div>
              )}

              {clashes.length > 0 && (
                <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
                  <b>{clashes.length}</b> question{clashes.length > 1 ? "s" : ""} already exist and will be <b>replaced</b>.
                </div>
              )}

              {/* Preview table with inline answer editing */}
              <div className="rounded-xl border overflow-hidden">
                <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Preview
                    <span className="ml-2 font-normal normal-case text-muted-foreground/70">— click a row to change its answer</span>
                  </span>
                  {rows.length > 0 && <span className="text-xs text-muted-foreground">Q{rows[0].n} – Q{rows[rows.length - 1].n}</span>}
                </div>

                <div className="max-h-64 overflow-y-auto divide-y">
                  {rows.map((r) => {
                    const isEditing = editingRow === r.n;
                    return (
                      <div
                        key={r.n}
                        className={`transition-colors ${isEditing ? "bg-primary/5" : !r.answer ? "bg-destructive/5 hover:bg-destructive/8" : "hover:bg-muted/40"}`}
                      >
                        {/* Row summary */}
                        <div
                          className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                          onClick={() => setEditingRow(isEditing ? null : r.n)}
                        >
                          <span className="w-9 font-mono text-[11px] font-bold text-muted-foreground shrink-0">Q{r.n}</span>
                          <span className={`w-12 text-[11px] capitalize font-medium shrink-0 ${
                            r.subject === "physics"   ? "text-info" :
                            r.subject === "chemistry" ? "text-success" : "text-warning"
                          }`}>{r.subject.slice(0, 4)}</span>
                          <span className="flex-1 truncate text-[11px] font-mono text-muted-foreground">{r.url.split("/").pop()?.split("?")[0]}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {r.answer ? (
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-success/15 text-xs font-extrabold text-success">
                                {r.answer}
                              </span>
                            ) : (
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-destructive/15 text-xs font-extrabold text-destructive">
                                ?
                              </span>
                            )}
                            <Pencil className={`h-3.5 w-3.5 transition-colors ${isEditing ? "text-primary" : "text-muted-foreground/40"}`} />
                          </div>
                        </div>

                        {/* Inline answer picker */}
                        {isEditing && (
                          <div className="flex items-center gap-2 px-3 pb-2.5 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                            <span className="text-[11px] text-muted-foreground font-medium mr-1">Set answer:</span>
                            {KEYS.map((k) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => {
                                  setAnswerOverrides((prev) => ({ ...prev, [r.n]: k }));
                                  setEditingRow(null);
                                }}
                                className={`h-9 w-9 rounded-xl text-sm font-bold transition-all border ${
                                  r.answer === k
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-card border-border hover:border-primary hover:text-primary"
                                }`}
                              >
                                {k}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setAnswerOverrides((prev) => { const n = { ...prev }; delete n[r.n]; return n; });
                                setEditingRow(null);
                              }}
                              className="ml-auto text-[11px] text-muted-foreground hover:text-destructive font-medium"
                            >
                              Clear
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Upload progress */}
              {busy && (
                <div className="space-y-1.5 animate-in fade-in-50">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Uploading…</span>
                    <span>{progress} / {rows.length}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: rows.length ? `${(progress / rows.length) * 100}%` : "0%" }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t px-5 py-3 flex items-center justify-between gap-3 bg-secondary/20">
          <Button variant="outline" size="sm" className="rounded-xl gap-1" onClick={goBack} disabled={stepIdx === 0 || busy}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <span className="text-xs text-muted-foreground font-medium">{stepIdx + 1} / {STEPS.length}</span>
          {step !== "review" ? (
            <Button size="sm" className="rounded-xl gap-1" onClick={goNext} disabled={!canNext()}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={busy || !readyToUpload} className="rounded-xl gap-1.5 px-5">
              {busy
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                : <><Upload className="h-4 w-4" /> Upload {rows.length} Questions</>
              }
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
