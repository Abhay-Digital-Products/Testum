import jsPDF from "jspdf";
import logoAsset from "@/assets/testum-logo.png.asset.json";
import { fetchImageBase64 } from "@/lib/image-proxy.functions";
import {
  getOptionText,
  hasAttemptedAnswer,
  isAnswerCorrect,
  isOptionSelected,
  normalizeCorrectOption,
  normalizeOptionKey,
  normalizeQuestionOptions,
} from "@/lib/exam-options";

/* ─── Types ──────────────────────────────────────────── */
type RGB = [number, number, number];
type Stat = {
  total: number;
  correct: number;
  wrong: number;
  unattempted: number;
  timeSpent?: number;
};

export type QuestionReview = {
  order_index: number;
  subject: string;
  chapter?: string | null;
  question_text?: string | null;
  question_image_url?: string | null;
  option_type?: string | null;
  options?: unknown;
  correct_option: string;
  selected_option?: string | null;
  is_correct?: boolean | null;
  time_spent_seconds?: number;
  solution_text?: string | null;
  solution_image_url?: string | null;
  solution_video_url?: string | null;
};

export type ResultPdfInput = {
  studentName: string;
  studentClass?: string | null;
  testTitle: string;
  submittedAt: string;
  score: number;
  totalMax: number;
  correct: number;
  wrong: number;
  unattempted: number;
  marksCorrect?: number;
  marksWrong?: number;
  timeSpentSeconds: number;
  durationMinutes: number;
  subjects: Record<string, Stat>;
  chapters: Record<string, Stat>;
  aiSummary?: string | null;
  weakTopics?: string[] | null;
  strongTopics?: string[] | null;
  studyPlan?: string | null;
  questions?: QuestionReview[];
};

export type PdfProgressCallback = (step: string, percent: number) => void;

/* ─── Brand Palette (Matches site theme exactly) ─────── */
const PRIMARY: RGB = [37, 99, 235]; // Royal Blue #2563EB
const PRIMARY_L: RGB = [79, 140, 255]; // Lighter blue for accents
const DARK: RGB = [15, 23, 42]; // Slate 900
const GREY: RGB = [100, 116, 139]; // Slate 500
const GREY_L: RGB = [148, 163, 184]; // Slate 400
const LIGHT_BG: RGB = [248, 250, 252]; // Slate 50
const BORDER: RGB = [226, 232, 240]; // Slate 200

const GREEN: RGB = [16, 185, 129]; // Emerald 500
const GREEN_BG: RGB = [236, 253, 245]; // Emerald 50
const RED: RGB = [239, 68, 68]; // Rose 500
const RED_BG: RGB = [254, 242, 242]; // Rose 50
const AMBER: RGB = [245, 158, 11]; // Amber 500
const AMBER_BG: RGB = [255, 251, 235]; // Amber 50
const INDIGO_BG: RGB = [238, 242, 255]; // Indigo 50
const INDIGO_BD: RGB = [199, 210, 254]; // Indigo 200

const WHITE: RGB = [255, 255, 255];

/* ─── High-Performance Parallel Image Loader & Cache ───────── */
type LoadedImage = { data: string; w: number; h: number; format: string };
const globalImageCache = new Map<string, LoadedImage>();

async function fetchSingleImageWithTimeout(
  url: string,
  timeoutMs = 2400,
): Promise<LoadedImage | null> {
  if (!url || typeof url !== "string") return null;
  if (globalImageCache.has(url)) return globalImageCache.get(url)!;

  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));

  const loadTask = async (): Promise<LoadedImage | null> => {
    // 1. Direct Image Element + Canvas (fastest & browser cached)
    try {
      const res = await new Promise<LoadedImage | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const w = img.naturalWidth || 600;
            const h = img.naturalHeight || 400;
            const canvas = document.createElement("canvas");
            const targetW = Math.min(w, 680);
            const targetH = Math.round((h / w) * targetW) || h;
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const jpeg = canvas.toDataURL("image/jpeg", 0.82);
              resolve({ data: jpeg, w: canvas.width, h: canvas.height, format: "JPEG" });
              return;
            }
          } catch {
            // Canvas security or CORS restriction
          }
          resolve(null);
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
      if (res) return res;
    } catch {}

    // 2. Direct fetch with AbortController
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(url, { mode: "cors", signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const blob = await res.blob();
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (b64 && b64.startsWith("data:")) {
          const img = new Image();
          const meta = await new Promise<{ w: number; h: number }>((resolve) => {
            img.onload = () => resolve({ w: img.naturalWidth || 600, h: img.naturalHeight || 400 });
            img.onerror = () => resolve({ w: 600, h: 400 });
            img.src = b64;
          });
          return { data: b64, w: meta.w, h: meta.h, format: b64.includes("png") ? "PNG" : "JPEG" };
        }
      }
    } catch {}

    // 3. Server Proxy fallback for cross-origin restricted URLs
    try {
      const proxied = await fetchImageBase64({ data: { url } });
      if (proxied && proxied.startsWith("data:")) {
        const img = new Image();
        const meta = await new Promise<{ w: number; h: number }>((resolve) => {
          img.onload = () => resolve({ w: img.naturalWidth || 600, h: img.naturalHeight || 400 });
          img.onerror = () => resolve({ w: 600, h: 400 });
          img.src = proxied;
        });
        return { data: proxied, w: meta.w, h: meta.h, format: "JPEG" };
      }
    } catch {}

    return null;
  };

  const result = await Promise.race([loadTask(), timeoutPromise]);
  if (result) {
    globalImageCache.set(url, result);
  }
  return result;
}

/**
 * Prefetches all test images in parallel batches with progress notification
 */
async function prefetchAllImages(
  urls: string[],
  onProgress?: PdfProgressCallback,
): Promise<Map<string, LoadedImage>> {
  const uniqueUrls = Array.from(new Set(urls.filter((u) => Boolean(u) && typeof u === "string")));
  const results = new Map<string, LoadedImage>();
  const total = uniqueUrls.length;
  if (total === 0) return results;

  const concurrency = 16;
  let completed = 0;

  for (let i = 0; i < uniqueUrls.length; i += concurrency) {
    const chunk = uniqueUrls.slice(i, i + concurrency);
    const loadedChunk = await Promise.all(
      chunk.map(async (u) => {
        const img = await fetchSingleImageWithTimeout(u);
        return { url: u, img };
      }),
    );
    for (const item of loadedChunk) {
      if (item.img) results.set(item.url, item.img);
    }
    completed += chunk.length;
    if (onProgress) {
      const percent = Math.min(80, Math.round((completed / total) * 80));
      onProgress(`Downloading images (${Math.min(completed, total)}/${total})...`, percent);
    }
  }

  return results;
}

/* ─── Main PDF Generator ──────────────────────────────── */
export async function downloadResultPdf(input: ResultPdfInput, onProgress?: PdfProgressCallback) {
  if (onProgress) onProgress("Preparing exam data...", 5);

  // 1. Collect all unique image URLs upfront (no limit cap so all questions are included)
  const allUrls: string[] = [];
  if (logoAsset?.url) allUrls.push(logoAsset.url);

  for (const q of input.questions ?? []) {
    if (q.question_image_url) allUrls.push(q.question_image_url);
    if (q.solution_image_url) allUrls.push(q.solution_image_url);
    if (Array.isArray(q.options)) {
      for (const opt of q.options as any[]) {
        if (opt?.image_url) allUrls.push(opt.image_url);
      }
    }
  }

  const imageMap = await prefetchAllImages(allUrls, onProgress);
  const logo = logoAsset?.url ? (imageMap.get(logoAsset.url) ?? null) : null;

  if (onProgress) onProgress("Generating PDF report...", 85);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(); // 595.28 pt
  const H = doc.internal.pageSize.getHeight(); // 841.89 pt
  const M = 36; // Margins
  let y = 0;

  /* Ensure enough space remains on page; otherwise add new page */
  const ensure = (need: number) => {
    if (y + need > H - 52) {
      doc.addPage();
      drawPageBg();
      y = M + 12;
    }
  };

  /* Subtle off-white background on every page */
  const drawPageBg = () => {
    doc.setFillColor(252, 253, 255);
    doc.rect(0, 0, W, H, "F");
  };

  drawPageBg();

  /* ── 1. HEADER BANNER (Page 1) ────────────────────────── */
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 88, "F");
  doc.setFillColor(...PRIMARY_L);
  doc.setGState(doc.GState({ opacity: 0.2 }));
  doc.rect(W * 0.55, 0, W * 0.45, 88, "F");
  doc.setGState(doc.GState({ opacity: 1 }));

  // Decorative accents
  doc.setFillColor(...WHITE);
  doc.setGState(doc.GState({ opacity: 0.08 }));
  doc.circle(W - 30, -10, 80, "F");
  doc.circle(W - 80, 60, 50, "F");
  doc.setGState(doc.GState({ opacity: 1 }));

  // Logo
  if (logo) {
    try {
      doc.addImage(logo.data, logo.format || "PNG", M, 17, 50, 50);
    } catch {
      /* ignore */
    }
  }

  const txtX = M + (logo ? 62 : 0);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("TESTUM", txtX, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(205, 225, 255);
  doc.text("Official Performance & Diagnostic Analysis Report", txtX, 55);

  doc.setFontSize(7.5);
  doc.setTextColor(185, 210, 255);
  doc.text(
    "Generated: " +
      new Date(input.submittedAt || Date.now()).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    W - M,
    42,
    { align: "right" },
  );
  doc.text("testum.in  ·  NEET CBT Exam Simulation", W - M, 56, { align: "right" });

  y = 104;

  /* ── 2. TEST & STUDENT CARD ─────────────────────────── */
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(M, y, W - M * 2, 54, 8, 8, "FD");

  // Left blue accent bar
  doc.setFillColor(...PRIMARY);
  doc.roundedRect(M, y, 5, 54, 4, 4, "F");

  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.text(input.testTitle, M + 16, y + 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  const studentLine = `Student: ${input.studentName}${input.studentClass ? `   |   Class: ${input.studentClass}` : ""}   |   Duration: ${input.durationMinutes} min`;
  doc.text(studentLine, M + 16, y + 34);

  const submittedDate = new Date(input.submittedAt || Date.now()).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  doc.text("Submitted: " + submittedDate, M + 16, y + 46);

  y += 65;

  /* ── 3. PRIMARY METRIC CARDS ────────────────────────── */
  const computedCorrect = (input.questions ?? []).filter((q) => {
    if (!hasAttemptedAnswer(q)) return false;
    if (q.is_correct === true) return true;
    const selected = normalizeOptionKey(q.selected_option);
    const correct = normalizeCorrectOption(q.correct_option);
    return Boolean(selected && correct && selected === correct);
  }).length;

  const computedWrong = (input.questions ?? []).filter((q) => {
    if (!hasAttemptedAnswer(q)) return false;
    if (q.is_correct === false) return true;
    const selected = normalizeOptionKey(q.selected_option);
    const correct = normalizeCorrectOption(q.correct_option);
    return Boolean(selected && correct && selected !== correct);
  }).length;

  const computedUnattempted = (input.questions ?? []).filter((q) => !hasAttemptedAnswer(q)).length;
  const storedAttempted = input.correct + input.wrong;
  const derivedAttempted = computedCorrect + computedWrong;
  const useComputed =
    (input.questions?.length ?? 0) > 0 &&
    (derivedAttempted > storedAttempted ||
      (input.correct === 0 && input.wrong === 0 && derivedAttempted > 0));

  const marksCorrect = input.marksCorrect ?? 4;
  const marksWrong = input.marksWrong ?? -1;
  const finalCorrect = useComputed ? computedCorrect : input.correct;
  const finalWrong = useComputed ? computedWrong : input.wrong;
  const finalUnattempted = useComputed ? computedUnattempted : input.unattempted;
  const finalScore = useComputed
    ? finalCorrect * marksCorrect + finalWrong * marksWrong
    : input.score;

  const attempted = finalCorrect + finalWrong;
  const accuracy = attempted ? Math.round((finalCorrect / attempted) * 100) : 0;
  const percent = input.totalMax ? Math.round((finalScore / input.totalMax) * 100) : 0;
  const minSpent = Math.floor(input.timeSpentSeconds / 60);

  const metrics: Array<{ label: string; value: string; sub: string; color: RGB; accentBg: RGB }> = [
    {
      label: "FINAL SCORE",
      value: `${Math.round(finalScore)}/${input.totalMax}`,
      sub: `${percent}% of maximum`,
      color: PRIMARY,
      accentBg: INDIGO_BG,
    },
    {
      label: "ACCURACY RATE",
      value: `${accuracy}%`,
      sub: `${finalCorrect}/${attempted} correct`,
      color: accuracy >= 75 ? GREEN : accuracy >= 50 ? AMBER : RED,
      accentBg: accuracy >= 75 ? GREEN_BG : accuracy >= 50 ? AMBER_BG : RED_BG,
    },
    {
      label: "TIME USED",
      value: `${minSpent} min`,
      sub: `of ${input.durationMinutes} min`,
      color: DARK,
      accentBg: LIGHT_BG,
    },
    {
      label: "ATTEMPT RATIO",
      value: `${attempted}/${attempted + finalUnattempted}`,
      sub: `${finalUnattempted} skipped`,
      color: DARK,
      accentBg: LIGHT_BG,
    },
  ];

  const mw = (W - M * 2 - 15) / 4;
  metrics.forEach((m, i) => {
    const x = M + i * (mw + 5);
    doc.setFillColor(...m.accentBg);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, y, mw, 58, 7, 7, "FD");

    // Bottom accent line
    doc.setFillColor(...m.color);
    doc.roundedRect(x + 6, y + 51, mw - 12, 3, 1.5, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(m.label, x + 8, y + 14);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...m.color);
    doc.text(m.value, x + 8, y + 34);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GREY_L);
    doc.text(m.sub, x + 8, y + 45);
  });
  y += 68;

  /* ── 4. ANSWER BREAKDOWN ROW ────────────────────────── */
  const bw = (W - M * 2 - 10) / 3;
  const breakdown = [
    {
      label: "CORRECT ANSWERS",
      count: finalCorrect,
      score: `+${finalCorrect * marksCorrect} Marks`,
      color: GREEN,
      bg: GREEN_BG,
      border: GREEN,
    },
    {
      label: "INCORRECT ANSWERS",
      count: finalWrong,
      score: `${finalWrong * marksWrong < 0 ? "" : "+"}${finalWrong * marksWrong} Marks`,
      color: RED,
      bg: RED_BG,
      border: RED,
    },
    {
      label: "SKIPPED / UNATTEMPTED",
      count: finalUnattempted,
      score: "0 Marks",
      color: GREY,
      bg: LIGHT_BG,
      border: BORDER,
    },
  ];

  breakdown.forEach((b, i) => {
    const x = M + i * (bw + 5);
    doc.setFillColor(...b.bg);
    doc.setDrawColor(...b.border);
    doc.roundedRect(x, y, bw, 42, 7, 7, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...b.color);
    doc.text(b.label, x + 10, y + 14);

    doc.setFontSize(18);
    doc.text(String(b.count), x + 10, y + 34);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...b.color);
    doc.text(b.score, x + bw - 10, y + 34, { align: "right" });
  });
  y += 52;

  /* ── Helper: Section Heading ────────────────────────── */
  const heading = (text: string, color: RGB = PRIMARY) => {
    ensure(38);
    doc.setFillColor(...color);
    doc.roundedRect(M, y - 2, 4, 18, 2, 2, "F");
    doc.setFillColor(color[0], color[1], color[2]);
    doc.setGState(doc.GState({ opacity: 0.07 }));
    doc.rect(M, y - 2, W - M * 2, 18, "F");
    doc.setGState(doc.GState({ opacity: 1 }));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...color);
    doc.text(text, M + 10, y + 11);
    y += 24;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
  };

  /* ── Helper: Paragraph ──────────────────────────────── */
  const paragraph = (text: string, indent = 0) => {
    const lines = doc.splitTextToSize(text, W - M * 2 - indent);
    for (const line of lines) {
      ensure(14);
      doc.text(line, M + indent, y);
      y += 12;
    }
    y += 3;
  };

  /* ── Helper: Progress bar ───────────────────────────── */
  const progressBar = (
    x: number,
    barY: number,
    barW: number,
    val: number,
    total: number,
    color: RGB,
  ) => {
    const pct = total ? Math.min(1, Math.max(0, val / total)) : 0;
    doc.setFillColor(...BORDER);
    doc.roundedRect(x, barY, barW, 5, 2.5, 2.5, "F");
    if (pct > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(x, barY, barW * pct, 5, 2.5, 2.5, "F");
    }
  };

  /* ── 5. AI ANALYSIS SECTION ─────────────────────────── */
  if (input.aiSummary || input.studyPlan || (input.weakTopics?.length ?? 0) > 0) {
    heading("AI Diagnostic Analysis & Recommendations");

    if (input.aiSummary) {
      const lines = doc.splitTextToSize(input.aiSummary, W - M * 2 - 24);
      const boxH = lines.length * 13 + 28;
      ensure(boxH + 10);

      doc.setFillColor(...INDIGO_BG);
      doc.setDrawColor(...INDIGO_BD);
      doc.roundedRect(M, y, W - M * 2, boxH, 8, 8, "FD");

      // Left bar
      doc.setFillColor(...PRIMARY);
      doc.roundedRect(M, y, 4, boxH, 4, 4, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...PRIMARY);
      doc.text("NEET MENTOR VERDICT", M + 14, y + 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      let ly = y + 26;
      for (const line of lines) {
        doc.text(line, M + 14, ly);
        ly += 13;
      }
      y += boxH + 12;
    }

    // Weak / Strong Topics
    const weakList = input.weakTopics ?? [];
    const strongList = input.strongTopics ?? [];

    if (weakList.length > 0 || strongList.length > 0) {
      ensure(52);
      const chipW = (W - M * 2 - 8) / 2;

      // Weak
      doc.setFillColor(...RED_BG);
      doc.setDrawColor(254, 202, 202);
      doc.roundedRect(M, y, chipW, 46, 7, 7, "FD");
      doc.setFillColor(...RED);
      doc.roundedRect(M, y, 4, 46, 4, 4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...RED);
      doc.text("FOCUS AREAS (Low Accuracy)", M + 10, y + 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...DARK);
      const weakTxt = doc.splitTextToSize(weakList.join(" · ") || "None flagged", chipW - 20);
      doc.text(weakTxt.slice(0, 2), M + 10, y + 27);

      // Strong
      const sx = M + chipW + 8;
      doc.setFillColor(...GREEN_BG);
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(sx, y, chipW, 46, 7, 7, "FD");
      doc.setFillColor(...GREEN);
      doc.roundedRect(sx, y, 4, 46, 4, 4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...GREEN);
      doc.text("MASTERED TOPICS (Strong)", sx + 10, y + 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...DARK);
      const strongTxt = doc.splitTextToSize(strongList.join(" · ") || "All balanced", chipW - 20);
      doc.text(strongTxt.slice(0, 2), sx + 10, y + 27);
      y += 56;
    }

    // 7-Day Study Plan
    if (input.studyPlan) {
      ensure(60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...PRIMARY);
      doc.text("7-DAY TARGETED ACTION PLAN:", M, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      for (const line of input.studyPlan.split("\n")) {
        if (line.trim()) paragraph("• " + line.trim().replace(/^[•\s-]+/, ""), 10);
      }
      y += 6;
    }
  }

  /* ── 6. SUBJECT-WISE BREAKDOWN ──────────────────────── */
  const subjectEntries = Object.entries(input.subjects);
  if (subjectEntries.length > 0) {
    heading("Subject-wise Performance Breakdown");

    const COLS = {
      name: M + 10,
      bar: M + 130,
      c: W - M - 145,
      w: W - M - 105,
      s: W - M - 65,
      acc: W - M - 10,
    };
    const barW = COLS.c - COLS.bar - 8;

    // Table header
    doc.setFillColor(...PRIMARY);
    doc.setGState(doc.GState({ opacity: 0.07 }));
    doc.rect(M, y - 7, W - M * 2, 19, "F");
    doc.setGState(doc.GState({ opacity: 1 }));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text("SUBJECT", COLS.name, y + 5);
    doc.text("ACCURACY", COLS.bar, y + 5);
    doc.text("✓", COLS.c, y + 5);
    doc.text("✗", COLS.w, y + 5);
    doc.text("—", COLS.s, y + 5);
    doc.text("%", COLS.acc, y + 5, { align: "right" });
    y += 19;

    for (const [name, s] of subjectEntries) {
      ensure(24);
      const att = s.correct + s.wrong;
      const acc = att ? Math.round((s.correct / att) * 100) : 0;
      const barColor: RGB = acc >= 75 ? GREEN : acc >= 50 ? AMBER : RED;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      doc.text(name.charAt(0).toUpperCase() + name.slice(1), COLS.name, y + 4);

      progressBar(COLS.bar, y - 2, barW, s.correct, s.total || att + s.unattempted, barColor);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...GREEN);
      doc.text(String(s.correct), COLS.c, y + 4);
      doc.setTextColor(...RED);
      doc.text(String(s.wrong), COLS.w, y + 4);
      doc.setTextColor(...GREY);
      doc.text(String(s.unattempted), COLS.s, y + 4);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...barColor);
      doc.text(`${acc}%`, COLS.acc, y + 4, { align: "right" });

      doc.setDrawColor(...BORDER);
      doc.line(M, y + 10, W - M, y + 10);
      y += 20;
    }
    y += 10;
  }

  /* ── 7. CHAPTER-WISE BREAKDOWN ──────────────────────── */
  const chapterEntries = Object.entries(input.chapters);
  if (chapterEntries.length > 0) {
    heading("Chapter-wise Diagnostics & Accuracy");

    const COLS = { name: M + 10, c: W - M - 145, w: W - M - 105, s: W - M - 65, acc: W - M - 10 };

    doc.setFillColor(...PRIMARY);
    doc.setGState(doc.GState({ opacity: 0.07 }));
    doc.rect(M, y - 7, W - M * 2, 19, "F");
    doc.setGState(doc.GState({ opacity: 1 }));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text("CHAPTER / TOPIC", COLS.name, y + 5);
    doc.text("✓", COLS.c, y + 5);
    doc.text("✗", COLS.w, y + 5);
    doc.text("—", COLS.s, y + 5);
    doc.text("ACC", COLS.acc, y + 5, { align: "right" });
    y += 19;

    for (const [name, s] of chapterEntries) {
      ensure(22);
      const att = s.correct + s.wrong;
      const acc = att ? Math.round((s.correct / att) * 100) : 0;
      const barColor: RGB = acc >= 75 ? GREEN : acc >= 50 ? AMBER : RED;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.text(doc.splitTextToSize(name, 200)[0], COLS.name, y + 4);

      doc.setTextColor(...GREEN);
      doc.text(String(s.correct), COLS.c, y + 4);
      doc.setTextColor(...RED);
      doc.text(String(s.wrong), COLS.w, y + 4);
      doc.setTextColor(...GREY);
      doc.text(String(s.unattempted), COLS.s, y + 4);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...barColor);
      doc.text(`${acc}%`, COLS.acc, y + 4, { align: "right" });

      doc.setDrawColor(...BORDER);
      doc.line(M, y + 10, W - M, y + 10);
      y += 17;
    }
    y += 10;
  }

  /* ── 8. QUESTION-BY-QUESTION REVIEW (ALL QUESTIONS) ─── */
  const qs = (input.questions ?? []).slice().sort((a, b) => a.order_index - b.order_index);

  if (qs.length > 0) {
    ensure(50);
    heading("Detailed Question Review & Solutions");

    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    paragraph(
      `Complete review of all ${qs.length} questions including question diagrams, your response, verified correct answer, and step-by-step solutions.`,
    );

    for (let qIdx = 0; qIdx < qs.length; qIdx++) {
      const q = qs[qIdx];
      const selected = normalizeOptionKey(q.selected_option);
      const correctOpt = normalizeCorrectOption(q.correct_option) ?? "";
      const hasAttempted = hasAttemptedAnswer(q);
      const isSkipped = !hasAttempted;
      const isCorrect =
        hasAttempted && (q.is_correct === true || isAnswerCorrect(selected, correctOpt));
      const isWrong = hasAttempted && !isCorrect;
      const statusColor: RGB = isCorrect ? GREEN : isWrong ? RED : GREY;
      const statusLabel = isCorrect
        ? `CORRECT (+${marksCorrect})`
        : isWrong
          ? `WRONG (${marksWrong})`
          : "NOT ATTEMPTED (0)";
      const timeStr =
        q.time_spent_seconds && q.time_spent_seconds > 0
          ? `${Math.floor(q.time_spent_seconds / 60)}m ${q.time_spent_seconds % 60}s`
          : "—";

      ensure(90);

      /* ── Question Header Strip ── */
      doc.setFillColor(...statusColor);
      doc.setGState(doc.GState({ opacity: 0.09 }));
      doc.roundedRect(M, y - 6, W - M * 2, 26, 5, 5, "F");
      doc.setGState(doc.GState({ opacity: 1 }));

      doc.setFillColor(...statusColor);
      doc.roundedRect(M, y - 6, 5, 26, 4, 4, "F");

      // Q Number
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...DARK);
      doc.text(`Q${q.order_index}`, M + 12, y + 10);

      // Subject · Chapter
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...GREY);
      const subjLabel = `${(q.subject || "").toUpperCase()}${q.chapter ? `  ·  ${q.chapter}` : ""}`;
      const truncated = doc.splitTextToSize(subjLabel, W - M * 2 - 220)[0] ?? "";
      doc.text(truncated, M + 36, y + 10);

      // Time spent
      doc.setFontSize(7);
      doc.setTextColor(...GREY_L);
      doc.text(`⏱ ${timeStr}`, W - M - 90, y + 10);

      // Status badge
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...statusColor);
      doc.text(statusLabel, W - M - 8, y + 10, { align: "right" });

      y += 30;

      /* ── Question Text ── */
      if (q.question_text) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...DARK);
        paragraph(q.question_text);
      }

      /* ── Question Image (Full width, auto aspect ratio) ── */
      if (q.question_image_url) {
        const img = imageMap.get(q.question_image_url);
        if (img) {
          const maxW = W - M * 2;
          const scale = maxW / img.w;
          const rawH = img.h * scale;
          const capH = Math.min(rawH, 280);
          const capW = rawH > 280 ? (img.w / img.h) * capH : maxW;
          ensure(capH + 14);
          try {
            doc.addImage(img.data, img.format || "JPEG", M, y, capW, capH);
          } catch (e) {
            console.warn("jsPDF addImage failed for question", q.order_index, e);
          }
          y += capH + 10;
        }
      }

      /* ── Options List with Explicit Answer Highlighting ── */
      const optionsList = normalizeQuestionOptions(q.options).map((opt) => ({
        ...opt,
        text: opt.text ?? getOptionText(q.options, opt.key),
      }));

      if (optionsList.length > 0) {
        ensure(12);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...GREY);
        doc.text("OPTIONS:", M + 8, y);
        y += 10;

        for (const opt of optionsList) {
          const optKey = normalizeOptionKey(opt.key) ?? "";
          const isOptCorrect = isOptionSelected(correctOpt, optKey);
          const isOptChosen = isOptionSelected(selected, optKey);
          const isWrongChoice = isOptChosen && !isOptCorrect;

          let bg: RGB | null = null;
          let bd: RGB = BORDER;
          let tc: RGB = DARK;
          let suffix = "";

          if (isOptCorrect && isOptChosen) {
            bg = GREEN_BG;
            bd = GREEN;
            tc = GREEN;
            suffix = "  ✓  Your Selection  (Correct)";
          } else if (isOptCorrect) {
            bg = GREEN_BG;
            bd = GREEN;
            tc = GREEN;
            suffix = "  ✓  Correct Option";
          } else if (isWrongChoice) {
            bg = RED_BG;
            bd = RED;
            tc = RED;
            suffix = "  ✗  Your Selected Answer  (Incorrect)";
          }

          const label = `  (${opt.key})  ${opt.text}${suffix}`;
          const lines = doc.splitTextToSize(label, W - M * 2 - 20);
          const rowH = lines.length * 12 + 12;

          ensure(rowH + 4);
          if (bg) {
            doc.setFillColor(...bg);
            doc.setDrawColor(...bd);
            doc.roundedRect(M + 6, y - 7, W - M * 2 - 6, rowH, 4, 4, "FD");
          } else {
            doc.setDrawColor(...BORDER);
            doc.roundedRect(M + 6, y - 7, W - M * 2 - 6, rowH, 4, 4, "D");
          }

          doc.setFont("helvetica", isOptCorrect || isWrongChoice ? "bold" : "normal");
          doc.setFontSize(8);
          doc.setTextColor(...tc);
          for (let li = 0; li < lines.length; li++) {
            doc.text(lines[li], M + 14, y + li * 12);
          }
          y += rowH + 3;

          // Option Image if any
          if (opt.image_url) {
            const optImg = imageMap.get(opt.image_url);
            if (optImg) {
              const oMaxW = Math.min(W - M * 2 - 28, 220);
              const oH = Math.min((optImg.h / optImg.w) * oMaxW, 100);
              const oW = (optImg.w / optImg.h) * oH;
              ensure(oH + 8);
              try {
                doc.addImage(optImg.data, optImg.format || "JPEG", M + 14, y, oW, oH);
                y += oH + 6;
              } catch (e) {
                console.warn("jsPDF addImage failed for option image", e);
              }
            }
          }
        }
      }

      /* ── Response Verdict Summary Strip ── */
      ensure(26);
      y += 4;
      const summaryParts: string[] = [];
      if (!isSkipped) summaryParts.push(`Your Choice: Option (${selected ?? "-"})`);
      summaryParts.push(`Correct Answer: Option (${correctOpt || "-"})`);
      if (isCorrect) summaryParts.push(`Verdict: CORRECT (+${marksCorrect})`);
      else if (isWrong) summaryParts.push(`Verdict: INCORRECT (${marksWrong})`);
      else summaryParts.push("Verdict: NOT ATTEMPTED (0)");

      const summaryBg: RGB = isCorrect ? GREEN_BG : isWrong ? RED_BG : LIGHT_BG;
      const summaryBd: RGB = isCorrect ? GREEN : isWrong ? RED : BORDER;
      const summaryTc: RGB = isCorrect ? GREEN : isWrong ? RED : GREY;
      doc.setFillColor(...summaryBg);
      doc.setDrawColor(...summaryBd);
      doc.roundedRect(M, y - 5, W - M * 2, 20, 5, 5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...summaryTc);
      doc.text(summaryParts.join("   |   "), M + 10, y + 8);
      y += 24;

      /* ── Step-by-Step Solution & Diagram ── */
      if (q.solution_text || q.solution_image_url || q.solution_video_url) {
        ensure(28);
        doc.setFillColor(...INDIGO_BG);
        doc.setDrawColor(...INDIGO_BD);
        doc.roundedRect(M, y - 3, W - M * 2, 20, 5, 5, "FD");
        doc.setFillColor(...PRIMARY);
        doc.roundedRect(M, y - 3, 5, 20, 4, 4, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...PRIMARY);
        doc.text("EXPLANATION & SOLUTION", M + 12, y + 10);
        y += 24;

        if (q.solution_text) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...DARK);
          paragraph(q.solution_text, 8);
        }

        if (q.solution_image_url) {
          const sImg = imageMap.get(q.solution_image_url);
          if (sImg) {
            const sw = Math.min(W - M * 2 - 8, 360);
            const sh = Math.min((sImg.h / sImg.w) * sw, 240);
            const fsw = sh < (sImg.h / sImg.w) * sw ? (sImg.w / sImg.h) * sh : sw;
            ensure(sh + 14);
            try {
              doc.addImage(sImg.data, sImg.format || "JPEG", M + 8, y, fsw, sh);
            } catch (e) {
              console.warn("jsPDF addImage failed for solution", q.order_index, e);
            }
            y += sh + 10;
          }
        }

        if (q.solution_video_url) {
          ensure(16);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(...PRIMARY);
          doc.textWithLink("▶  Watch Video Solution Online", M + 10, y, {
            url: q.solution_video_url,
          });
          y += 16;
        }
      }

      /* ── Divider between questions ── */
      ensure(14);
      doc.setDrawColor(...BORDER);
      doc.line(M, y + 5, W - M, y + 5);
      y += 18;
    }
  }

  /* ── 9. FOOTER ON ALL PAGES ─────────────────────────── */
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    doc.setFillColor(...PRIMARY);
    doc.setGState(doc.GState({ opacity: 0.07 }));
    doc.rect(0, H - 38, W, 38, "F");
    doc.setGState(doc.GState({ opacity: 1 }));

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GREY);
    doc.text("Testum  ·  India's Most Affordable NEET CBT Test Series  ·  testum.in", M, H - 18);
    doc.text(`Page ${p} of ${totalPages}`, W - M, H - 18, { align: "right" });
  }

  if (onProgress) onProgress("Saving file...", 98);

  /* ── 10. SAVE & DOWNLOAD ────────────────────────────── */
  const safe = input.testTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`testum-report-${safe}.pdf`);

  if (onProgress) onProgress("Complete!", 100);
}
